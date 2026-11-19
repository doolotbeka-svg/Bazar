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
    status: r.status === 'sold' || r.status === 'blocked' ? r.status : 'active',
    promoteTier: (r.promote_tier as PromoteTier) || 'none',
    views: Number(r.views) || 0
  };
}

export function createRepo(db: Db) {
  return {
    /* ---------------- listings ---------------- */

    /** Public feed: everything except listings hidden by a moderator. */
    async listListings(): Promise<Listing[]> {
      const rows = await db.query<ListingRow>(
        `SELECT ${LISTING_COLS} FROM listings WHERE status <> 'blocked' ORDER BY created_at DESC LIMIT 2000`
      );
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

    /** Seller's own change; a listing blocked by a moderator cannot be re-activated this way. */
    async setStatus(id: string, status: 'active' | 'sold'): Promise<Listing | null> {
      const [row] = await db.query<ListingRow>(
        `UPDATE listings SET status = $2 WHERE id = $1 AND status <> 'blocked' RETURNING ${LISTING_COLS}`,
        [id, status]
      );
      return row ? toListing(row) : null;
    },

    async setPromoteTier(id: string, tier: PromoteTier): Promise<Listing | null> {
      const [row] = await db.query<ListingRow>(
        `UPDATE listings SET promote_tier = $2 WHERE id = $1 AND status <> 'blocked' RETURNING ${LISTING_COLS}`,
        [id, tier]
      );
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

/* ======================= moderation & admin ======================= */

export type ReportRow = {
  id: string;
  listingId: string;
  reason: string;
  comment: string;
  reporter: string;
  status: string;
  createdAt: string;
  listingTitle: string | null;
  listingStatus: string | null;
};

export type AdminUserRow = {
  id: string;
  name: string;
  authMethod: string;
  email?: string;
  phone?: string;
  createdAt: string;
  blocked: boolean;
  listings: number;
};

export function createAdminRepo(db: Db) {
  return {
    async stats() {
      const [row] = await db.query<Record<string, string | number>>(
        `SELECT
           (SELECT count(*) FROM listings) AS listings,
           (SELECT count(*) FROM listings WHERE status = 'active') AS active,
           (SELECT count(*) FROM listings WHERE status = 'blocked') AS blocked,
           (SELECT count(*) FROM listings WHERE created_at > now() - interval '1 day') AS new_today,
           (SELECT count(*) FROM users) AS users,
           (SELECT count(*) FROM users WHERE blocked) AS blocked_users,
           (SELECT count(*) FROM reports WHERE status = 'open') AS open_reports`
      );
      return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
    },

    /* ---- listings ---- */

    async listListings(q: string, status: string): Promise<(Listing & { openReports: number })[]> {
      const params: unknown[] = [];
      const where: string[] = [];
      if (status && status !== 'all') {
        params.push(status);
        where.push(`l.status = $${params.length}`);
      }
      if (q) {
        params.push(`%${q}%`);
        const p = `$${params.length}`;
        where.push(
          `(l.id ILIKE ${p} OR l.seller_id ILIKE ${p} OR l.data->>'titleKg' ILIKE ${p} OR l.data->>'titleRu' ILIKE ${p} OR l.data->>'phone' ILIKE ${p} OR l.data->>'sellerName' ILIKE ${p})`
        );
      }
      const rows = await db.query<ListingRow & { open_reports: string | number }>(
        `SELECT l.id, l.seller_id, l.created_at, l.status, l.promote_tier, l.views, l.data,
                (SELECT count(*) FROM reports r WHERE r.listing_id = l.id AND r.status = 'open') AS open_reports
         FROM listings l ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY l.created_at DESC LIMIT 500`,
        params
      );
      return rows.map((r) => ({ ...toListing(r), openReports: Number(r.open_reports) }));
    },

    async getListing(id: string): Promise<Listing | null> {
      const [row] = await db.query<ListingRow>(`SELECT ${LISTING_COLS} FROM listings WHERE id = $1`, [id]);
      return row ? toListing(row) : null;
    },

    async deleteListing(id: string): Promise<boolean> {
      const rows = await db.query(`DELETE FROM listings WHERE id = $1 RETURNING id`, [id]);
      return rows.length > 0;
    },

    /** Replace everything an admin may edit (views and creation date are kept separately). */
    async saveListing(l: Listing): Promise<Listing | null> {
      const { id, sellerId: _s, createdAt: _c, status, promoteTier, views, ...data } = l;
      const [row] = await db.query<ListingRow>(
        `UPDATE listings SET status = $2, promote_tier = $3, views = $4, data = $5 WHERE id = $1 RETURNING ${LISTING_COLS}`,
        [id, status, promoteTier, views, JSON.stringify(data)]
      );
      return row ? toListing(row) : null;
    },

    /* ---- reports ---- */

    async createReport(listingId: string, reason: string, comment: string, reporter: string): Promise<'ok' | 'duplicate' | 'limit'> {
      const [{ n }] = await db.query<{ n: string | number }>(
        `SELECT count(*) AS n FROM reports WHERE reporter = $1 AND created_at > now() - interval '1 day'`,
        [reporter]
      );
      if (Number(n) >= 20) return 'limit';
      const rows = await db.query(
        `INSERT INTO reports (listing_id, reason, comment, reporter) VALUES ($1, $2, $3, $4)
         ON CONFLICT (listing_id, reporter) WHERE status = 'open' DO NOTHING RETURNING id`,
        [listingId, reason, comment, reporter]
      );
      return rows.length ? 'ok' : 'duplicate';
    },

    async listReports(status: string): Promise<ReportRow[]> {
      const rows = await db.query<Record<string, unknown>>(
        `SELECT r.id, r.listing_id, r.reason, r.comment, r.reporter, r.status, r.created_at,
                COALESCE(l.data->>'titleRu', l.data->>'titleKg') AS listing_title, l.status AS listing_status
         FROM reports r LEFT JOIN listings l ON l.id = r.listing_id
         ${status === 'all' ? '' : 'WHERE r.status = $1'}
         ORDER BY r.created_at DESC LIMIT 500`,
        status === 'all' ? [] : [status]
      );
      return rows.map((r) => ({
        id: String(r.id),
        listingId: String(r.listing_id),
        reason: String(r.reason),
        comment: String(r.comment ?? ''),
        reporter: String(r.reporter),
        status: String(r.status),
        createdAt: new Date(r.created_at as string).toISOString(),
        listingTitle: (r.listing_title as string | null) ?? null,
        listingStatus: (r.listing_status as string | null) ?? null
      }));
    },

    async setReportStatus(id: string, status: 'open' | 'resolved' | 'rejected'): Promise<boolean> {
      // Re-opening a report could clash with a newer open one from the same person
      const rows = await db.query(`UPDATE reports SET status = $2 WHERE id = $1 RETURNING id`, [id, status]).catch(() => []);
      return rows.length > 0;
    },

    /** Close every open report about a listing (after it was handled). */
    async resolveReportsFor(listingId: string): Promise<void> {
      await db.query(`UPDATE reports SET status = 'resolved' WHERE listing_id = $1 AND status = 'open'`, [listingId]);
    },

    /* ---- users ---- */

    async listUsers(q: string): Promise<AdminUserRow[]> {
      const params: unknown[] = [];
      let where = '';
      if (q) {
        params.push(`%${q}%`);
        where = `WHERE u.id ILIKE $1 OR u.data->>'name' ILIKE $1 OR u.data->>'email' ILIKE $1 OR u.data->>'phone' ILIKE $1`;
      }
      const rows = await db.query<{ id: string; data: UserProfile; created_at: string; blocked: boolean; listings: string | number }>(
        `SELECT u.id, u.data, u.created_at, u.blocked,
                (SELECT count(*) FROM listings l WHERE l.seller_id = u.id) AS listings
         FROM users u ${where} ORDER BY u.created_at DESC LIMIT 500`,
        params
      );
      return rows.map((r) => ({
        id: r.id,
        name: r.data?.name || r.id,
        authMethod: r.data?.authMethod || '',
        email: r.data?.email,
        phone: r.data?.phone,
        createdAt: new Date(r.created_at).toISOString(),
        blocked: Boolean(r.blocked),
        listings: Number(r.listings)
      }));
    },

    async isUserBlocked(id: string): Promise<boolean> {
      const [row] = await db.query<{ blocked: boolean }>(`SELECT blocked FROM users WHERE id = $1`, [id]);
      return Boolean(row?.blocked);
    },

    /** Block/unblock an account; blocking also hides all of its listings. */
    async setUserBlocked(id: string, blocked: boolean): Promise<boolean> {
      const rows = await db.query(`UPDATE users SET blocked = $2 WHERE id = $1 RETURNING id`, [id, blocked]);
      if (rows.length && blocked) {
        await db.query(`UPDATE listings SET status = 'blocked' WHERE seller_id = $1`, [id]);
      }
      return rows.length > 0;
    },

    async listingsOfSeller(sellerId: string): Promise<Listing[]> {
      const rows = await db.query<ListingRow>(`SELECT ${LISTING_COLS} FROM listings WHERE seller_id = $1`, [sellerId]);
      return rows.map(toListing);
    },

    /* ---- admins ---- */

    async listAdmins(): Promise<{ userId: string; addedBy: string; createdAt: string; name: string | null }[]> {
      const rows = await db.query<{ user_id: string; added_by: string; created_at: string; name: string | null }>(
        `SELECT a.user_id, a.added_by, a.created_at, u.data->>'name' AS name
         FROM admins a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at`
      );
      return rows.map((r) => ({
        userId: r.user_id,
        addedBy: r.added_by,
        createdAt: new Date(r.created_at).toISOString(),
        name: r.name
      }));
    },

    async isDbAdmin(userId: string): Promise<boolean> {
      const rows = await db.query(`SELECT 1 FROM admins WHERE user_id = $1`, [userId]);
      return rows.length > 0;
    },

    async addAdmin(userId: string, addedBy: string): Promise<void> {
      await db.query(`INSERT INTO admins (user_id, added_by) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`, [userId, addedBy]);
    },

    async removeAdmin(userId: string): Promise<void> {
      await db.query(`DELETE FROM admins WHERE user_id = $1`, [userId]);
    },

    /* ---- site settings (announcement banner) ---- */

    async getSetting(key: string): Promise<string | null> {
      const [row] = await db.query<{ value: string }>(`SELECT value FROM meta WHERE key = $1`, [`setting:${key}`]);
      return row?.value ?? null;
    },

    async setSetting(key: string, value: string): Promise<void> {
      await db.query(
        `INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [`setting:${key}`, value]
      );
    }
  };
}

export type AdminRepo = ReturnType<typeof createAdminRepo>;
