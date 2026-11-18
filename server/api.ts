import { randomInt } from 'crypto';
import express from 'express';
import { MARKETPLACE_CATEGORIES } from '../src/data/categories.ts';
import { KYRGYZSTAN_LOCATIONS } from '../src/data/locations.ts';
import type { CategoryId, Listing, PromoteTier, UserProfile } from '../src/types/marketplace.ts';
import { createStorage, IMAGE_ROUTE_PREFIX, type StoreData } from './storage.ts';
import {
  createListingKey,
  createSessionToken,
  hashOtp,
  otpMatches,
  verifyListingKey,
  verifySessionToken
} from './auth.ts';
import { getGoogleClientId, verifyGoogleIdToken } from './google.ts';
import { getTelegramBotName, verifyTelegramAuth } from './telegram.ts';
import { createSmsSender, isSmsDemoMode } from './sms.ts';

const CATEGORY_IDS = new Set<string>(MARKETPLACE_CATEGORIES.map((c) => c.id));
const LOCATION_IDS = new Set<string>(KYRGYZSTAN_LOCATIONS.map((l) => l.id));
// The client compresses photos to <=300k chars; allow headroom but reject raw camera files
const MAX_IMAGE_DATA_URL_CHARS = 600_000;

/** Safely read a trimmed string from untrusted JSON input. */
function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

type AsyncHandler = (req: express.Request, res: express.Response) => Promise<void>;
/** Express 4 does not catch rejected promises; forward them to the error handler. */
const wrap =
  (fn: AsyncHandler): express.RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/** User id from `Authorization: Bearer <session token>`, or null. */
function sessionUserId(req: express.Request): string | null {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? verifySessionToken(match[1]) : null;
}

/**
 * The caller may change a listing if they are signed in as its seller,
 * or present the listing's manage key (returned once when it was posted).
 */
function assertCanManage(req: express.Request, listing: Listing) {
  const uid = sessionUserId(req);
  if (uid && listing.sellerId === uid) return;
  const key = req.get('x-listing-key');
  if (verifyListingKey(listing.id, key)) return;
  throw new HttpError(uid || key ? 403 : 401, 'Not allowed to manage this listing');
}

/** Express app with all /api routes. Used by the local server and the Vercel function. */
export function createApiApp() {
  const storage = createStorage();
  const app = express();
  // Vercel functions reject request bodies over 4.5 MB
  app.use(express.json({ limit: '4mb' }));

  /* ---------------- store access ---------------- */

  // Short read cache so a page load (several requests) costs one storage read
  let cache: { data: StoreData; at: number } | null = null;
  const CACHE_MS = 3000;

  // View counters are buffered and flushed at most once a minute, so that every
  // page view does not rewrite the whole store (each write is a paid Blob op).
  const pendingViews = new Map<string, number>();
  let lastViewFlush = Date.now();
  const VIEW_FLUSH_MS = 60_000;

  const applyPendingViews = (data: StoreData) => {
    for (const [id, n] of pendingViews) {
      const listing = data.listings.find((l) => l.id === id);
      if (listing) listing.views += n;
    }
    pendingViews.clear();
    lastViewFlush = Date.now();
  };

  const read = async (): Promise<StoreData> => {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
    const data = await storage.load();
    cache = { data, at: Date.now() };
    return data;
  };

  // Serialize read-modify-write cycles within this instance
  let queue: Promise<unknown> = Promise.resolve();
  const mutate = <T>(fn: (data: StoreData) => T | Promise<T>): Promise<T> => {
    const run = queue.then(async () => {
      const data = await storage.load(); // always fresh before writing
      const result = await fn(data);
      applyPendingViews(data);
      await storage.save(data);
      cache = { data, at: Date.now() };
      return result;
    });
    queue = run.catch(() => undefined);
    return run;
  };

  /** Show buffered (not yet saved) views in responses. */
  const withPendingViews = (listings: Listing[]): Listing[] =>
    pendingViews.size === 0
      ? listings
      : listings.map((l) => (pendingViews.has(l.id) ? { ...l, views: l.views + pendingViews.get(l.id)! } : l));

  const findOr404 = (data: StoreData, id: string): Listing => {
    const listing = data.listings.find((item) => item.id === id);
    if (!listing) throw new HttpError(404, 'Listing not found');
    return listing;
  };

  /* ---------------- routes ---------------- */

  app.get(
    '/api/listings',
    wrap(async (_req, res) => {
      const data = await read();
      res.json({ listings: withPendingViews(data.listings) });
    })
  );

  app.post(
    '/api/listings',
    wrap(async (req, res) => {
      const body = (req.body || {}) as Record<string, unknown>;
      const titleKgIn = str(body.titleKg);
      const titleRuIn = str(body.titleRu);
      const descKgIn = str(body.descriptionKg);
      const descRuIn = str(body.descriptionRu);
      const phoneIn = str(body.phone);
      const category = body.category as CategoryId;
      const locationId = str(body.locationId);
      const negotiable = Boolean(body.negotiable);
      const price =
        typeof body.price === 'number' && Number.isFinite(body.price) && body.price > 0
          ? Math.round(body.price)
          : null;

      if (
        !CATEGORY_IDS.has(category) ||
        (!titleKgIn && !titleRuIn) ||
        !LOCATION_IDS.has(locationId) ||
        phoneIn.replace(/\D/g, '').length !== 12
      ) {
        throw new HttpError(400, 'Missing or invalid required fields');
      }
      if (price === null && !negotiable) {
        throw new HttpError(400, 'Price required unless negotiable');
      }

      // The seller is whoever is signed in; a client-supplied sellerId is ignored
      const sellerId = sessionUserId(req) || 'guest';
      const id = `kg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

      // Upload photos first (outside the store lock); keep only the ones that succeed
      const rawImages = Array.isArray(body.images)
        ? body.images.filter((img): img is string => typeof img === 'string').slice(0, 10)
        : [];
      const images: string[] = [];
      for (const [i, img] of rawImages.entries()) {
        if (img.startsWith('/src/assets/')) {
          images.push(img);
        } else if (img.startsWith('data:image/') && img.length <= MAX_IMAGE_DATA_URL_CHARS) {
          try {
            images.push(await storage.saveImage(id, i, img));
          } catch (err) {
            console.error('Image upload failed', err);
          }
        }
      }

      const newListing: Listing = {
        id,
        category,
        titleKg: (titleKgIn || titleRuIn).slice(0, 140),
        titleRu: titleRuIn ? titleRuIn.slice(0, 140) : undefined,
        descriptionKg: (descKgIn || descRuIn).slice(0, 3000),
        descriptionRu: descRuIn ? descRuIn.slice(0, 3000) : undefined,
        price,
        currency: body.currency === 'USD' ? 'USD' : 'KGS',
        negotiable,
        locationId,
        images,
        phone: phoneIn,
        hasWhatsapp: body.hasWhatsapp !== false,
        sellerName: (str(body.sellerName) || 'Сатуучу').slice(0, 80),
        sellerId,
        sellerSince: str(body.sellerSince) || String(new Date().getFullYear()),
        createdAt: new Date().toISOString(),
        views: 1,
        promoteTier: 'none',
        status: 'active'
      };

      await mutate((data) => {
        data.listings.unshift(newListing);
      });
      // The manage key is only ever sent here, to the poster
      res.status(201).json({ listing: newListing, manageKey: createListingKey(id) });
    })
  );

  app.post(
    '/api/listings/:id/view',
    wrap(async (req, res) => {
      const data = await read();
      const listing = findOr404(data, req.params.id);
      pendingViews.set(listing.id, (pendingViews.get(listing.id) || 0) + 1);
      if (Date.now() - lastViewFlush > VIEW_FLUSH_MS) {
        await mutate(() => undefined); // flushes pending views
      }
      res.json({ views: withPendingViews([listing])[0].views });
    })
  );

  app.patch(
    '/api/listings/:id/status',
    wrap(async (req, res) => {
      const status = req.body?.status === 'sold' ? 'sold' : 'active';
      const listing = await mutate((data) => {
        const found = findOr404(data, req.params.id);
        assertCanManage(req, found);
        found.status = status;
        return found;
      });
      res.json({ listing });
    })
  );

  app.post(
    '/api/listings/:id/promote',
    wrap(async (req, res) => {
      const tier = req.body?.tier as PromoteTier;
      if (tier !== 'vip' && tier !== 'top' && tier !== 'none') {
        throw new HttpError(400, 'Invalid promotion tier');
      }
      const listing = await mutate((data) => {
        const found = findOr404(data, req.params.id);
        assertCanManage(req, found);
        found.promoteTier = tier;
        return found;
      });
      res.json({ listing });
    })
  );

  app.delete(
    '/api/listings/:id',
    wrap(async (req, res) => {
      const removed = await mutate((data) => {
        const found = findOr404(data, req.params.id);
        assertCanManage(req, found);
        data.listings = data.listings.filter((item) => item !== found);
        return found;
      });
      pendingViews.delete(removed.id);
      try {
        await storage.deleteImages(removed.images);
      } catch (err) {
        console.error('Image cleanup failed', err);
      }
      res.json({ ok: true });
    })
  );

  // Uploaded photos live in a private Blob store and are streamed through here
  app.get(
    `${IMAGE_ROUTE_PREFIX}*`,
    wrap(async (req, res) => {
      const pathname = String((req.params as Record<string, string>)[0] || '');
      if (!/^images\/[A-Za-z0-9-]+\.(jpg|png|webp|gif)$/.test(pathname)) {
        throw new HttpError(404, 'Not found');
      }
      const image = await storage.getImage(pathname);
      if (!image) throw new HttpError(404, 'Not found');
      res.setHeader('Content-Type', image.contentType);
      // Browsers may cache for a day; the Vercel CDN only for an hour, so photos
      // of a deleted listing stop being served soon after deletion.
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=3600');
      image.stream.on('error', () => res.destroy()).pipe(res);
    })
  );

  /* ---------------- sign-in ---------------- */

  const sms = createSmsSender();
  const OTP_TTL_MS = 5 * 60 * 1000;
  const OTP_RESEND_MS = 60 * 1000;
  const OTP_MAX_ATTEMPTS = 5;
  const OTP_MAX_PER_DAY = 5;

  /** Normalized Kyrgyz mobile number (996XXXXXXXXX) or null. */
  const kgPhoneDigits = (value: unknown): string | null => {
    const digits = str(value).replace(/\D/g, '');
    return /^996\d{9}$/.test(digits) ? digits : null;
  };

  const formatPhone = (d: string) => `+${d.slice(0, 3)} (${d.slice(3, 6)}) ${d.slice(6, 8)}-${d.slice(8, 10)}-${d.slice(10)}`;

  // What the sign-in screen can offer
  app.get('/api/auth/config', (_req, res) => {
    res.json({
      googleClientId: getGoogleClientId(),
      telegramBot: getTelegramBotName(),
      smsDemo: isSmsDemoMode(sms)
    });
  });

  app.post(
    '/api/auth/send-otp',
    wrap(async (req, res) => {
      const digits = kgPhoneDigits(req.body?.phone);
      if (!digits) throw new HttpError(400, 'Invalid phone number');

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const now = Date.now();
      const today = new Date(now).toISOString().slice(0, 10);

      await mutate((data) => {
        const prev = data.otps[digits];
        if (prev && now - prev.lastSentAt < OTP_RESEND_MS) {
          throw new HttpError(429, 'Please wait before requesting a new code');
        }
        const sentToday = prev && prev.day === today ? prev.sentToday : 0;
        if (sentToday >= OTP_MAX_PER_DAY) throw new HttpError(429, 'Too many codes today');
        // Drop expired records so the store does not grow forever
        for (const [phone, rec] of Object.entries(data.otps)) {
          if (rec.expiresAt < now && rec.day !== today) delete data.otps[phone];
        }
        data.otps[digits] = {
          codeHash: hashOtp(digits, code),
          expiresAt: now + OTP_TTL_MS,
          attempts: 0,
          lastSentAt: now,
          day: today,
          sentToday: sentToday + 1
        };
      });

      if (sms) {
        try {
          await sms.send(digits, `AlMart: ваш код ${code}. Никому его не сообщайте.`);
        } catch (err) {
          console.error(err);
          // Not delivered: cancel this code and give back the resend/daily allowance
          await mutate((data) => {
            const rec = data.otps[digits];
            if (rec && rec.lastSentAt === now) {
              rec.expiresAt = 0;
              rec.lastSentAt = 0;
              rec.sentToday = Math.max(0, rec.sentToday - 1);
            }
          }).catch(() => undefined);
          throw new HttpError(502, 'SMS could not be sent');
        }
      }
      // Demo / gateway test mode: nothing reaches the phone, so the code is shown on screen
      res.json(isSmsDemoMode(sms) ? { sent: true, demoCode: code } : { sent: true });
    })
  );

  app.post(
    '/api/auth/verify-otp',
    wrap(async (req, res) => {
      const digits = kgPhoneDigits(req.body?.phone);
      const code = str(req.body?.code);
      if (!digits || !/^\d{6}$/.test(code)) throw new HttpError(400, 'Invalid phone or code');

      const outcome = await mutate((data) => {
        const rec = data.otps[digits];
        if (!rec || rec.expiresAt < Date.now() || rec.attempts >= OTP_MAX_ATTEMPTS) {
          return { error: 'expired' as const };
        }
        if (!otpMatches(digits, code, rec.codeHash)) {
          rec.attempts += 1;
          return { error: 'wrong' as const };
        }
        // One-time: the code cannot be used again (keep limits for the day)
        rec.expiresAt = 0;
        const userId = `phone-${digits}`;
        const user: UserProfile = data.users[userId] || {
          id: userId,
          name: `Колдонуучу ${digits.slice(-4)}`,
          phone: formatPhone(digits),
          authMethod: 'phone',
          joinedAt: String(new Date().getFullYear())
        };
        data.users[userId] = user;
        return { user, favorites: data.favoritesByUser[userId] || [], token: createSessionToken(userId) };
      });

      if ('error' in outcome) {
        throw new HttpError(401, outcome.error === 'expired' ? 'Code expired, request a new one' : 'Invalid code');
      }
      res.json(outcome);
    })
  );

  app.post(
    '/api/auth/google',
    wrap(async (req, res) => {
      if (!getGoogleClientId()) throw new HttpError(404, 'Google sign-in is not configured');
      const identity = await verifyGoogleIdToken(str(req.body?.credential));
      if (!identity) throw new HttpError(401, 'Invalid Google credential');
      const userId = `google-${identity.sub}`;
      const result = await mutate((data) => {
        const user: UserProfile = data.users[userId] || {
          id: userId,
          name: identity.name.slice(0, 80),
          email: identity.email,
          authMethod: 'google',
          joinedAt: String(new Date().getFullYear())
        };
        data.users[userId] = user;
        return { user, favorites: data.favoritesByUser[userId] || [], token: createSessionToken(userId) };
      });
      res.json(result);
    })
  );

  app.post(
    '/api/auth/telegram',
    wrap(async (req, res) => {
      if (!getTelegramBotName()) throw new HttpError(404, 'Telegram sign-in is not configured');
      const identity = verifyTelegramAuth(req.body);
      if (!identity) throw new HttpError(401, 'Invalid Telegram login data');
      const userId = `telegram-${identity.id}`;
      const result = await mutate((data) => {
        const user: UserProfile = data.users[userId] || {
          id: userId,
          name: identity.name,
          authMethod: 'telegram',
          joinedAt: String(new Date().getFullYear())
        };
        data.users[userId] = user;
        return { user, favorites: data.favoritesByUser[userId] || [], token: createSessionToken(userId) };
      });
      res.json(result);
    })
  );

  app.post(
    '/api/favorites/sync',
    wrap(async (req, res) => {
      const userId = sessionUserId(req);
      if (!userId) throw new HttpError(401, 'Sign in required');
      const favorites: string[] = Array.isArray(req.body?.favorites)
        ? (req.body.favorites as unknown[]).filter((f): f is string => typeof f === 'string').slice(0, 500)
        : [];
      await mutate((data) => {
        data.favoritesByUser[userId] = favorites;
      });
      res.json({ favorites });
    })
  );

  // Unknown API routes must return JSON 404, not the SPA index.html
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Malformed JSON / oversized bodies / handler errors -> clean JSON error
  app.use(
    (err: Error & { status?: number }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (res.headersSent) return next(err);
      const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
      if (status === 500) console.error(err);
      res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
    }
  );

  return app;
}
