import type { Listing, PromoteTier, UserProfile } from '../src/types/marketplace.ts';
import type { Db } from './db.ts';

/**
 * All data access for the API. Every change is one SQL statement (atomic in
 * Postgres), so two requests on different server instances cannot overwrite
 * each other's changes the way the old read-whole-file / write-whole-file did.
 */

type ListingRow = {
  id: string;
  seller_id: string;
  created_at: string | Date;
  status: string;
  promote_tier: string;
  views: number;
  data: Omit<Listing, 'id' | 'sellerId' | 'createdAt' | 'status' | 'promoteTier' | 'views'>;
};

const LISTING_COLS = 'id, seller_id, created_at, status, promote_tier, views, data';

function toListing(r: ListingRow): Listing {
  return {
    ...r.data,
    id: r.id,
    sellerId: r.seller_id,
    createdAt: new Date(r.created_at).toISOString(),
    status: r.status === 'sold' ? 'sold' : 'active',
    promoteTier: (r.promote_tier as PromoteTier) || 'none',
    views: Number(r.views) || 0
  };
}

export function createRepo(db: Db) {
  return {
    /* ---------------- listings ---------------- */

    async listListings(): Promise<Listing[]> {
      const rows = await db.query<ListingRow>(`SELECT ${LISTING_COLS} FROM listings ORDER BY created_at DESC LIMIT 2000`);
      return rows.map(toListing);
    },

    async getListing(id: string): Promise<Listing | null> {
      const [row] = await db.query<ListingRow>(`SELECT ${LISTING_COLS} FROM listings WHERE id = $1`, [id]);
      return row ? toListing(row) : null;
    },

    async insertListing(l: Listing): Promise<void> {
      const { id, sellerId, createdAt, status, promoteTier, views, ...data } = l;
      await db.query(
        `INSERT INTO listings (id, seller_id, created_at, status, promote_tier, views, data) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, sellerId, createdAt, status, promoteTier, views, JSON.stringify(data)]
      );
    },

    async incrementViews(id: string): Promise<number | null> {
      const [row] = await db.query<{ views: number }>(`UPDATE listings SET views = views + 1 WHERE id = $1 RETURNING views`, [id]);
      return row ? Number(row.views) : null;
    },

    async setStatus(id: string, status: 'active' | 'sold'): Promise<Listing | null> {
      const [row] = await db.query<ListingRow>(`UPDATE listings SET status = $2 WHERE id = $1 RETURNING ${LISTING_COLS}`, [id, status]);
      return row ? toListing(row) : null;
    },

    async setPromoteTier(id: string, tier: PromoteTier): Promise<Listing | null> {
      const [row] = await db.query<ListingRow>(`UPDATE listings SET promote_tier = $2 WHERE id = $1 RETURNING ${LISTING_COLS}`, [
        id,
        tier
      ]);
      return row ? toListing(row) : null;
    },

    async deleteListing(id: string): Promise<boolean> {
      const rows = await db.query(`DELETE FROM listings WHERE id = $1 RETURNING id`, [id]);
      return rows.length > 0;
    },

    /* ---------------- users & favorites ---------------- */

    /** Create the user on first sign-in; afterwards return the stored profile unchanged. */
    async ensureUser(profile: UserProfile): Promise<UserProfile> {
      await db.query(`INSERT INTO users (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [profile.id, JSON.stringify(profile)]);
      const [row] = await db.query<{ data: UserProfile }>(`SELECT data FROM users WHERE id = $1`, [profile.id]);
      return row?.data ?? profile;
    },

    async getFavorites(userId: string): Promise<string[]> {
      const [row] = await db.query<{ ids: string[] }>(`SELECT ids FROM favorites WHERE user_id = $1`, [userId]);
      return Array.isArray(row?.ids) ? row.ids : [];
    },

    async setFavorites(userId: string, ids: string[]): Promise<void> {
      await db.query(
        `INSERT INTO favorites (user_id, ids) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET ids = EXCLUDED.ids`,
        [userId, JSON.stringify(ids)]
      );
    },

    /* ---------------- SMS codes ---------------- */

    /**
     * Store a new code unless the number is still in its resend window or out of
     * today's quota. Returns false when the request must be refused.
     */
    async saveOtp(o: {
      phone: string;
      codeHash: string;
      expiresAt: number;
      now: number;
      day: string;
      resendMs: number;
      maxPerDay: number;
    }): Promise<boolean> {
      const rows = await db.query(
        `INSERT INTO otps (phone, code_hash, expires_at, attempts, last_sent_at, day, sent_today)
         VALUES ($1, $2, $3, 0, $4, $5, 1)
         ON CONFLICT (phone) DO UPDATE SET
           code_hash = EXCLUDED.code_hash,
           expires_at = EXCLUDED.expires_at,
           attempts = 0,
           last_sent_at = EXCLUDED.last_sent_at,
           sent_today = CASE WHEN otps.day = EXCLUDED.day THEN otps.sent_today + 1 ELSE 1 END,
           day = EXCLUDED.day
         WHERE otps.last_sent_at <= $4::bigint - $6::bigint
           AND (otps.day <> EXCLUDED.day OR otps.sent_today < $7::int)
         RETURNING phone`,
        [o.phone, o.codeHash, o.expiresAt, o.now, o.day, o.resendMs, o.maxPerDay]
      );
      // Occasional cleanup of finished records from previous days
      if (Math.random() < 0.05) {
        await db.query(`DELETE FROM otps WHERE expires_at < $1 AND day <> $2`, [o.now, o.day]).catch(() => undefined);
      }
      return rows.length > 0;
    },

    /** Undo a code whose SMS could not be delivered (gives back the resend/daily allowance). */
    async cancelOtp(phone: string, sentAt: number): Promise<void> {
      await db.query(
        `UPDATE otps SET expires_at = 0, last_sent_at = 0, sent_today = GREATEST(sent_today - 1, 0)
         WHERE phone = $1 AND last_sent_at = $2`,
        [phone, sentAt]
      );
    },

    async getOtp(phone: string) {
      const [row] = await db.query<{ code_hash: string; expires_at: string | number; attempts: number }>(
        `SELECT code_hash, expires_at, attempts FROM otps WHERE phone = $1`,
        [phone]
      );
      return row ? { codeHash: row.code_hash, expiresAt: Number(row.expires_at), attempts: Number(row.attempts) } : null;
    },

    async addOtpAttempt(phone: string): Promise<void> {
      await db.query(`UPDATE otps SET attempts = attempts + 1 WHERE phone = $1`, [phone]);
    },

    /** Use the code exactly once; false if someone else consumed or it expired meanwhile. */
    async consumeOtp(phone: string, codeHash: string, now: number, maxAttempts: number): Promise<boolean> {
      const rows = await db.query(
        `UPDATE otps SET expires_at = 0
         WHERE phone = $1 AND code_hash = $2 AND expires_at >= $3 AND attempts < $4
         RETURNING phone`,
        [phone, codeHash, now, maxAttempts]
      );
      return rows.length > 0;
    },

    /* ---------------- Telegram bot logins ---------------- */

    async createTgLogin(nonce: string, now: number, ttlMs: number, maxPending: number): Promise<boolean> {
      await db.query(`DELETE FROM tg_logins WHERE created_at < $1`, [now - ttlMs]);
      const [{ n }] = await db.query<{ n: string | number }>(`SELECT count(*) AS n FROM tg_logins`);
      if (Number(n) >= maxPending) return false;
      await db.query(`INSERT INTO tg_logins (nonce, created_at, status) VALUES ($1, $2, 'pending')`, [nonce, now]);
      return true;
    },

    async getTgLogin(nonce: string) {
      const [row] = await db.query<{ created_at: string | number; status: string }>(
        `SELECT created_at, status FROM tg_logins WHERE nonce = $1`,
        [nonce]
      );
      return row ? { createdAt: Number(row.created_at), status: row.status } : null;
    },

    async confirmTgLogin(nonce: string, telegramId: string, name: string, minCreatedAt: number): Promise<boolean> {
      const rows = await db.query(
        `UPDATE tg_logins SET status = 'confirmed', telegram_id = $2, name = $3
         WHERE nonce = $1 AND status = 'pending' AND created_at >= $4
         RETURNING nonce`,
        [nonce, telegramId, name, minCreatedAt]
      );
      return rows.length > 0;
    },

    /** Take the confirmation exactly once. */
    async claimTgLogin(nonce: string): Promise<{ telegramId: string; name: string } | null> {
      const [row] = await db.query<{ telegram_id: string; name: string | null }>(
        `DELETE FROM tg_logins WHERE nonce = $1 AND status = 'confirmed' AND telegram_id IS NOT NULL
         RETURNING telegram_id, name`,
        [nonce]
      );
      return row ? { telegramId: row.telegram_id, name: row.name || 'Telegram' } : null;
    }
  };
}

export type Repo = ReturnType<typeof createRepo>;
