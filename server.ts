import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { SEED_LISTINGS } from './src/data/seedListings.ts';
import type { Listing, PromoteTier, UserProfile } from './src/types/marketplace.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

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
    if (!Array.isArray(parsed.listings) || parsed.listings.length === 0) {
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

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
    const body = req.body as Partial<Listing>;
    if (!body.category || (!body.titleKg && !body.titleRu) || !body.locationId || !body.phone) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const newListing: Listing = {
      id: `kg-${Date.now().toString(36)}`,
      category: body.category,
      titleKg: (body.titleKg || body.titleRu || '').trim().slice(0, 140),
      titleRu: body.titleRu ? body.titleRu.trim().slice(0, 140) : undefined,
      descriptionKg: (body.descriptionKg || body.descriptionRu || '').trim().slice(0, 3000),
      descriptionRu: body.descriptionRu ? body.descriptionRu.trim().slice(0, 3000) : undefined,
      price: body.negotiable && !body.price ? null : typeof body.price === 'number' ? body.price : null,
      currency: body.currency === 'USD' ? 'USD' : 'KGS',
      negotiable: Boolean(body.negotiable),
      locationId: body.locationId,
      images: Array.isArray(body.images) ? body.images.slice(0, 10) : [],
      phone: body.phone.trim(),
      hasWhatsapp: body.hasWhatsapp !== false,
      sellerName: (body.sellerName || 'Сатуучу').trim().slice(0, 80),
      sellerId: body.sellerId || 'guest',
      sellerSince: body.sellerSince || '2026',
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
    const favorites = Array.isArray(req.body?.favorites) ? (req.body.favorites as string[]) : [];
    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }
    const store = ensureStore();
    store.favoritesByUser[userId] = favorites;
    saveStore(store);
    res.json({ favorites });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TezBazar server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
