import { randomBytes, randomInt } from 'crypto';
import express from 'express';
import { MARKETPLACE_CATEGORIES } from '../src/data/categories.ts';
import { KYRGYZSTAN_LOCATIONS } from '../src/data/locations.ts';
import type { CategoryId, Listing, PromoteTier, UserProfile } from '../src/types/marketplace.ts';
import { createStorage, IMAGE_ROUTE_PREFIX } from './storage.ts';
import { getDb } from './db.ts';
import { createRepo, type Repo } from './repo.ts';
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
import {
  displayName,
  ensureWebhook,
  isValidNonce,
  telegramApi,
  TG_LOGIN_TTL_MS,
  type TgUser,
  WEBHOOK_PATH,
  webhookSecret
} from './telegramBot.ts';
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
  // Photos stay in Vercel Blob (or local files); everything else lives in Postgres
  const storage = createStorage();
  const app = express();
  // Vercel functions reject request bodies over 4.5 MB
  app.use(express.json({ limit: '4mb' }));

  let repoPromise: Promise<Repo> | null = null;
  const repo = (): Promise<Repo> => {
    repoPromise ??= getDb(storage)
      .then(createRepo)
      .catch((err) => {
        repoPromise = null;
        throw err;
      });
    return repoPromise;
  };

  const getListingOr404 = async (id: string): Promise<Listing> => {
    const listing = await (await repo()).getListing(id);
    if (!listing) throw new HttpError(404, 'Listing not found');
    return listing;
  };

  /** Find or create the user and return what the client needs after sign-in. */
  const signIn = async (profile: UserProfile) => {
    const r = await repo();
    const user = await r.ensureUser(profile);
    return { user, favorites: await r.getFavorites(user.id), token: createSessionToken(user.id) };
  };

  /* ---------------- listings ---------------- */

  app.get(
    '/api/listings',
    wrap(async (_req, res) => {
      res.json({ listings: await (await repo()).listListings() });
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

      // Upload photos first; keep only the ones that succeed
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

      await (await repo()).insertListing(newListing);
      // The manage key is only ever sent here, to the poster
      res.status(201).json({ listing: newListing, manageKey: createListingKey(id) });
    })
  );

  app.post(
    '/api/listings/:id/view',
    wrap(async (req, res) => {
      const views = await (await repo()).incrementViews(req.params.id);
      if (views === null) throw new HttpError(404, 'Listing not found');
      res.json({ views });
    })
  );

  app.patch(
    '/api/listings/:id/status',
    wrap(async (req, res) => {
      const status = req.body?.status === 'sold' ? 'sold' : 'active';
      assertCanManage(req, await getListingOr404(req.params.id));
      const listing = await (await repo()).setStatus(req.params.id, status);
      if (!listing) throw new HttpError(404, 'Listing not found');
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
      assertCanManage(req, await getListingOr404(req.params.id));
      const listing = await (await repo()).setPromoteTier(req.params.id, tier);
      if (!listing) throw new HttpError(404, 'Listing not found');
      res.json({ listing });
    })
  );

  app.delete(
    '/api/listings/:id',
    wrap(async (req, res) => {
      const found = await getListingOr404(req.params.id);
      assertCanManage(req, found);
      if (!(await (await repo()).deleteListing(found.id))) throw new HttpError(404, 'Listing not found');
      try {
        await storage.deleteImages(found.images);
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

  // In demo mode the code is shown on screen, so anyone could sign in as any
  // number. On the live site phone sign-in is therefore off until real SMS
  // delivery is configured (PHONE_DEMO_LOGIN=1 re-enables it on purpose).
  const isProduction = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';
  const phoneLoginEnabled = !isSmsDemoMode(sms) || !isProduction || process.env.PHONE_DEMO_LOGIN === '1';
  const assertPhoneLogin = () => {
    if (!phoneLoginEnabled) throw new HttpError(404, 'Phone sign-in is not available yet');
  };

  // What the sign-in screen can offer
  app.get('/api/auth/config', (_req, res) => {
    res.json({
      googleClientId: getGoogleClientId(),
      telegramBot: getTelegramBotName(),
      phoneLogin: phoneLoginEnabled,
      smsDemo: isSmsDemoMode(sms)
    });
  });

  app.post(
    '/api/auth/send-otp',
    wrap(async (req, res) => {
      assertPhoneLogin();
      const digits = kgPhoneDigits(req.body?.phone);
      if (!digits) throw new HttpError(400, 'Invalid phone number');

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const now = Date.now();
      const r = await repo();
      const saved = await r.saveOtp({
        phone: digits,
        codeHash: hashOtp(digits, code),
        expiresAt: now + OTP_TTL_MS,
        now,
        day: new Date(now).toISOString().slice(0, 10),
        resendMs: OTP_RESEND_MS,
        maxPerDay: OTP_MAX_PER_DAY
      });
      if (!saved) throw new HttpError(429, 'Please wait before requesting a new code');

      if (sms) {
        try {
          await sms.send(digits, `AlMart: ваш код ${code}. Никому его не сообщайте.`);
        } catch (err) {
          console.error(err);
          // Not delivered: cancel this code and give back the resend/daily allowance
          await r.cancelOtp(digits, now).catch(() => undefined);
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
      assertPhoneLogin();
      const digits = kgPhoneDigits(req.body?.phone);
      const code = str(req.body?.code);
      if (!digits || !/^\d{6}$/.test(code)) throw new HttpError(400, 'Invalid phone or code');

      const r = await repo();
      const now = Date.now();
      const rec = await r.getOtp(digits);
      if (!rec || rec.expiresAt < now || rec.attempts >= OTP_MAX_ATTEMPTS) {
        throw new HttpError(401, 'Code expired, request a new one');
      }
      if (!otpMatches(digits, code, rec.codeHash)) {
        await r.addOtpAttempt(digits);
        throw new HttpError(401, 'Invalid code');
      }
      // One-time: the code cannot be used again (keep limits for the day)
      if (!(await r.consumeOtp(digits, rec.codeHash, now, OTP_MAX_ATTEMPTS))) {
        throw new HttpError(401, 'Code expired, request a new one');
      }
      res.json(
        await signIn({
          id: `phone-${digits}`,
          name: `Колдонуучу ${digits.slice(-4)}`,
          phone: formatPhone(digits),
          authMethod: 'phone',
          joinedAt: String(new Date().getFullYear())
        })
      );
    })
  );

  app.post(
    '/api/auth/google',
    wrap(async (req, res) => {
      if (!getGoogleClientId()) throw new HttpError(404, 'Google sign-in is not configured');
      const identity = await verifyGoogleIdToken(str(req.body?.credential));
      if (!identity) throw new HttpError(401, 'Invalid Google credential');
      res.json(
        await signIn({
          id: `google-${identity.sub}`,
          name: identity.name.slice(0, 80),
          email: identity.email,
          authMethod: 'google',
          joinedAt: String(new Date().getFullYear())
        })
      );
    })
  );

  const telegramProfile = (telegramId: string, name: string): UserProfile => ({
    id: `telegram-${telegramId}`,
    name,
    authMethod: 'telegram',
    joinedAt: String(new Date().getFullYear())
  });

  app.post(
    '/api/auth/telegram',
    wrap(async (req, res) => {
      if (!getTelegramBotName()) throw new HttpError(404, 'Telegram sign-in is not configured');
      const identity = verifyTelegramAuth(req.body);
      if (!identity) throw new HttpError(401, 'Invalid Telegram login data');
      res.json(await signIn(telegramProfile(identity.id, identity.name)));
    })
  );

  /* ---------- sign-in through the Telegram bot ---------- */

  // 1. The page asks for a one-time login link
  app.post(
    '/api/auth/telegram-bot/start',
    wrap(async (_req, res) => {
      const bot = getTelegramBotName();
      if (!bot) throw new HttpError(404, 'Telegram sign-in is not configured');
      await ensureWebhook();
      const nonce = randomBytes(16).toString('base64url');
      if (!(await (await repo()).createTgLogin(nonce, Date.now(), TG_LOGIN_TTL_MS, 500))) {
        throw new HttpError(429, 'Too many pending logins');
      }
      res.json({ nonce, url: `https://t.me/${bot}?start=login_${nonce}` });
    })
  );

  // 2. The page polls until the user confirms in Telegram
  app.post(
    '/api/auth/telegram-bot/poll',
    wrap(async (req, res) => {
      const nonce = req.body?.nonce;
      if (!isValidNonce(nonce)) throw new HttpError(400, 'Invalid nonce');
      const r = await repo();
      const rec = await r.getTgLogin(nonce);
      if (!rec || Date.now() - rec.createdAt > TG_LOGIN_TTL_MS) {
        res.json({ status: 'expired' });
        return;
      }
      if (rec.status !== 'confirmed') {
        res.json({ status: 'pending' });
        return;
      }
      // One-time: the confirmation is consumed by a single DELETE ... RETURNING
      const claimed = await r.claimTgLogin(nonce);
      if (!claimed) {
        res.json({ status: 'expired' });
        return;
      }
      res.json({ status: 'ok', ...(await signIn(telegramProfile(claimed.telegramId, claimed.name))) });
    })
  );

  // 3. Telegram calls this when the user writes to the bot or presses a button
  app.post(
    WEBHOOK_PATH,
    wrap(async (req, res) => {
      if (!getTelegramBotName() || req.get('x-telegram-bot-api-secret-token') !== webhookSecret()) {
        throw new HttpError(401, 'Unauthorized');
      }
      const update = (req.body || {}) as {
        message?: { chat?: { id: number }; from?: TgUser; text?: string };
        callback_query?: { id: string; from: TgUser; data?: string; message?: { chat: { id: number }; message_id: number } };
      };

      try {
        const msg = update.message;
        const startMatch = /^\/start login_([A-Za-z0-9_-]{16,40})$/.exec(msg?.text?.trim() || '');
        if (msg?.chat && startMatch) {
          // The link is checked when the user presses Confirm
          await telegramApi('sendMessage', {
            chat_id: msg.chat.id,
            text:
              'Вход на сайт AlMart (tezbazar.vercel.app).\n\n' +
              'Нажмите «Подтвердить», только если вы сами только что нажали «Войти через Telegram» на сайте.',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Подтвердить вход', callback_data: `ok:${startMatch[1]}` },
                  { text: 'Отмена', callback_data: 'no' }
                ]
              ]
            }
          });
        } else if (msg?.chat && msg.text?.startsWith('/start')) {
          await telegramApi('sendMessage', {
            chat_id: msg.chat.id,
            text: 'Это бот для входа на AlMart. Откройте сайт https://tezbazar.vercel.app и нажмите «Войти через Telegram».'
          });
        }

        const cb = update.callback_query;
        if (cb) {
          const okMatch = /^ok:([A-Za-z0-9_-]{16,40})$/.exec(cb.data || '');
          let reply = 'Вход отменён.';
          if (okMatch) {
            const confirmed = await (await repo()).confirmTgLogin(
              okMatch[1],
              String(cb.from.id),
              displayName(cb.from),
              Date.now() - TG_LOGIN_TTL_MS
            );
            reply = confirmed
              ? '✅ Готово! Вернитесь на сайт AlMart — вы уже вошли.'
              : 'Ссылка для входа устарела. Нажмите «Войти через Telegram» на сайте ещё раз.';
          }
          await telegramApi('answerCallbackQuery', { callback_query_id: cb.id });
          if (cb.message) {
            await telegramApi('editMessageText', {
              chat_id: cb.message.chat.id,
              message_id: cb.message.message_id,
              text: reply
            });
          }
        }
      } catch (err) {
        // Never make Telegram retry the same update forever
        console.error('Telegram webhook error', err);
      }
      res.json({ ok: true });
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
      await (await repo()).setFavorites(userId, favorites);
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
