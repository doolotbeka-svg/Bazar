import { SEED_LISTINGS } from '../src/data/seedListings.ts';
import type { Storage, StoreData } from './storage.ts';

/**
 * PostgreSQL access.
 *  - On Vercel: Neon serverless Postgres via DATABASE_URL (or POSTGRES_URL).
 *  - Locally without a URL: PGlite (Postgres compiled to WASM), stored in .data/pglite.
 * Every write is a single SQL statement, so concurrent requests on different
 * server instances can no longer overwrite each other's changes.
 */

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

async function connect(): Promise<Db> {
  const url = databaseUrl();
  if (url) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    return { query: async (text, params = []) => (await sql.query(text, params)) as never[] };
  }
  if (process.env.VERCEL) {
    throw new Error('DATABASE_URL is not set: connect a Neon Postgres database to the Vercel project');
  }
  // Local development / tests (dynamic import keeps PGlite out of the Vercel bundle)
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR ?? '.data/pglite';
  if (dir !== 'memory') {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir, { recursive: true }); // PGlite does not create parent folders
  }
  const pg = dir === 'memory' ? new PGlite() : new PGlite(dir);
  return { query: async (text, params = []) => (await pg.query(text, params)).rows as never[] };
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (key text PRIMARY KEY, value text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS listings (
     id text PRIMARY KEY,
     seller_id text NOT NULL,
     created_at timestamptz NOT NULL,
     status text NOT NULL DEFAULT 'active',
     promote_tier text NOT NULL DEFAULT 'none',
     views integer NOT NULL DEFAULT 0,
     data jsonb NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS listings_created_idx ON listings (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS listings_seller_idx ON listings (seller_id)`,
  `CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS favorites (user_id text PRIMARY KEY, ids jsonb NOT NULL DEFAULT '[]'::jsonb)`,
  `CREATE TABLE IF NOT EXISTS otps (
     phone text PRIMARY KEY,
     code_hash text NOT NULL,
     expires_at bigint NOT NULL,
     attempts integer NOT NULL DEFAULT 0,
     last_sent_at bigint NOT NULL,
     day text NOT NULL,
     sent_today integer NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS tg_logins (
     nonce text PRIMARY KEY,
     created_at bigint NOT NULL,
     status text NOT NULL DEFAULT 'pending',
     telegram_id text,
     name text
   )`,
  // Moderation
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS reports (
     id bigserial PRIMARY KEY,
     listing_id text NOT NULL,
     reason text NOT NULL,
     comment text NOT NULL DEFAULT '',
     reporter text NOT NULL,
     status text NOT NULL DEFAULT 'open',
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at DESC)`,
  // One open report per listing per person
  `CREATE UNIQUE INDEX IF NOT EXISTS reports_open_once ON reports (listing_id, reporter) WHERE status = 'open'`,
  `CREATE TABLE IF NOT EXISTS admins (
     user_id text PRIMARY KEY,
     added_by text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   )`
];

/** Copy the old single-JSON store (Vercel Blob / local file) into the tables, once. */
async function importLegacyStore(db: Db, legacy: Storage | null) {
  // Only the instance that inserts this row performs the import
  const won = await db.query(
    `INSERT INTO meta (key, value) VALUES ('legacy_import', 'started') ON CONFLICT (key) DO NOTHING RETURNING key`
  );
  if (won.length === 0) return;
  try {
    await copyLegacyRows(db, legacy);
  } catch (err) {
    // Let the next cold start try again (all inserts are idempotent)
    await db.query(`DELETE FROM meta WHERE key = 'legacy_import'`).catch(() => undefined);
    throw err;
  }
}

async function copyLegacyRows(db: Db, legacy: Storage | null) {
  let store: StoreData | null = null;
  if (legacy) {
    try {
      store = await legacy.load();
    } catch (err) {
      console.error('Legacy store could not be read, starting from demo listings', err);
    }
  }
  const listings = store?.listings ?? SEED_LISTINGS;

  for (const l of listings) {
    const { views, status, promoteTier, ...rest } = l;
    await db.query(
      `INSERT INTO listings (id, seller_id, created_at, status, promote_tier, views, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
      [l.id, l.sellerId, l.createdAt, status, promoteTier, views, JSON.stringify(rest)]
    );
  }
  for (const [id, user] of Object.entries(store?.users ?? {})) {
    await db.query(`INSERT INTO users (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [id, JSON.stringify(user)]);
  }
  for (const [userId, ids] of Object.entries(store?.favoritesByUser ?? {})) {
    await db.query(`INSERT INTO favorites (user_id, ids) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`, [
      userId,
      JSON.stringify(ids)
    ]);
  }
  await db.query(`UPDATE meta SET value = 'done' WHERE key = 'legacy_import'`);
  console.log(`Imported ${listings.length} listings into Postgres`);
}

let ready: Promise<Db> | null = null;

/** Connect, create tables if needed and import the legacy store on first run. */
export function getDb(legacy: Storage | null): Promise<Db> {
  ready ??= (async () => {
    const db = await connect();
    for (const stmt of SCHEMA) await db.query(stmt);
    await importLegacyStore(db, legacy);
    return db;
  })().catch((err) => {
    ready = null; // retry on the next request
    throw err;
  });
  return ready;
}
