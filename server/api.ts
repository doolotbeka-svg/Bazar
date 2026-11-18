import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { SEED_LISTINGS } from '../src/data/seedListings.ts';
import { MARKETPLACE_CATEGORIES } from '../src/data/categories.ts';
import { KYRGYZSTAN_LOCATIONS } from '../src/data/locations.ts';
import type { CategoryId, Listing, PromoteTier, UserProfile } from '../src/types/marketplace.ts';

const CATEGORY_IDS = new Set<string>(MARKETPLACE_CATEGORIES.map((c) => c.id));
const LOCATION_IDS = new Set<string>(KYRGYZSTAN_LOCATIONS.map((l) => l.id));

/** Safely read a trimmed string from untrusted JSON input. */
function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// On Vercel the deployment filesystem is read-only; only /tmp is writable.
// NOTE: /tmp is per-instance and temporary, so data there is NOT durable.
const DATA_DIR = process.env.VERCEL ? path.join("/tmp", "tezbazar") : path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

interface StoreData {
  listings: Listing[];
  favoritesByUser: Record<string, string[]>;
  users: Record<string, UserProfile>;
}

function ensureStore(): StoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial: StoreData = {
      listings: SEED_LISTINGS,
      favoritesByUser: {},
      users: {}
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as StoreData;
    // Only re-seed when the file is corrupted. An empty array is a valid state
    // (e.g. every listing was deleted) and must not bring the demo data back.
    if (!Array.isArray(parsed.listings)) {
      parsed.listings = SEED_LISTINGS;
    }
    return {
      listings: parsed.listings,
      favoritesByUser: parsed.favoritesByUser || {},
      users: parsed.users || {}
    };
  } catch {
    return {
      listings: SEED_LISTINGS,
      favoritesByUser: {},
      users: {}
    };
  }
}

function saveStore(data: StoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/** Express app with all /api routes. Used by the local server and the Vercel function. */
export function createApiApp() {
  const app = express();
  // Vercel functions reject request bodies over 4.5 MB
  app.use(express.json({ limit: '4mb' }));

  // Ensure initial seeded data exists
  ensureStore();

  // API: Get all listings
  app.get('/api/listings', (_req, res) => {
    const store = ensureStore();
    res.json({ listings: store.listings });
  });

  // API: Create a new listing
  app.post('/api/listings', (req, res) => {
    const store = ensureStore();
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
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }
    if (price === null && !negotiable) {
      res.status(400).json({ error: 'Price required unless negotiable' });
      return;
    }

    const images = Array.isArray(body.images)
      ? body.images
          .filter(
            (img): img is string =>
              typeof img === 'string' &&
              (img.startsWith('data:image/') || img.startsWith('/src/assets/'))
          )
          .slice(0, 10)
      : [];

    const newListing: Listing = {
      id: `kg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
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
      sellerId: str(body.sellerId) || 'guest',
      sellerSince: str(body.sellerSince) || String(new Date().getFullYear()),
      createdAt: new Date().toISOString(),
      views: 1,
      promoteTier: 'none',
      status: 'active'
    };

    store.listings.unshift(newListing);
    saveStore(store);
    res.status(201).json({ listing: newListing });
  });

  // API: Increment view counter
  app.post('/api/listings/:id/view', (req, res) => {
    const store = ensureStore();
    const listing = store.listings.find((item) => item.id === req.params.id);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    listing.views += 1;
    saveStore(store);
    res.json({ views: listing.views });
  });

  // API: Update listing status (active / sold)
  app.patch('/api/listings/:id/status', (req, res) => {
    const store = ensureStore();
    const listing = store.listings.find((item) => item.id === req.params.id);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    const status = req.body?.status === 'sold' ? 'sold' : 'active';
    listing.status = status;
    saveStore(store);
    res.json({ listing });
  });

  // API: Promote listing (vip / top / none)
  app.post('/api/listings/:id/promote', (req, res) => {
    const store = ensureStore();
    const listing = store.listings.find((item) => item.id === req.params.id);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    const tier = req.body?.tier as PromoteTier;
    if (tier !== 'vip' && tier !== 'top' && tier !== 'none') {
      res.status(400).json({ error: 'Invalid promotion tier' });
      return;
    }
    listing.promoteTier = tier;
    saveStore(store);
    res.json({ listing });
  });

  // API: Delete listing
  app.delete('/api/listings/:id', (req, res) => {
    const store = ensureStore();
    const prevLength = store.listings.length;
    store.listings = store.listings.filter((item) => item.id !== req.params.id);
    if (store.listings.length === prevLength) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    saveStore(store);
    res.json({ ok: true });
  });

  // API: Phone SMS verification (demo OTP flow with 1234)
  app.post('/api/auth/send-otp', (req, res) => {
    const phone = String(req.body?.phone || '').trim();
    if (!phone) {
      res.status(400).json({ error: 'Phone required' });
      return;
    }
    res.json({ sent: true, phone });
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const phone = String(req.body?.phone || '').trim();
    const code = String(req.body?.code || '').trim();
    if (code !== '1234') {
      res.status(401).json({ error: 'Invalid OTP code' });
      return;
    }
    const store = ensureStore();
    const cleanDigits = phone.replace(/\D/g, '');
    const userId = `phone-${cleanDigits}`;
    const existing = store.users[userId];
    const user: UserProfile = existing || {
      id: userId,
      name: `Колдонуучу ${cleanDigits.slice(-4)}`,
      phone,
      authMethod: 'phone',
      joinedAt: '2026'
    };
    store.users[userId] = user;
    saveStore(store);
    res.json({ user, favorites: store.favoritesByUser[userId] || [] });
  });

  app.post('/api/auth/google', (req, res) => {
    const email = String(req.body?.email || '').trim();
    const name = String(req.body?.name || 'Google User').trim();
    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }
    const store = ensureStore();
    const userId = `google-${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const existing = store.users[userId];
    const user: UserProfile = existing || {
      id: userId,
      name,
      email,
      authMethod: 'google',
      joinedAt: '2026'
    };
    store.users[userId] = user;
    saveStore(store);
    res.json({ user, favorites: store.favoritesByUser[userId] || [] });
  });

  app.post('/api/favorites/sync', (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    const favorites: string[] = Array.isArray(req.body?.favorites)
      ? (req.body.favorites as unknown[]).filter((f): f is string => typeof f === 'string').slice(0, 500)
      : [];
    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }
    const store = ensureStore();
    store.favoritesByUser[userId] = favorites;
    saveStore(store);
    res.json({ favorites });
  });

  // Unknown API routes must return JSON 404, not the SPA index.html
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Malformed JSON / oversized bodies -> clean JSON error instead of an HTML stack trace
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
