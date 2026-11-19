import type express from 'express';
import { MARKETPLACE_CATEGORIES } from '../src/data/categories.ts';
import { KYRGYZSTAN_LOCATIONS } from '../src/data/locations.ts';
import type { CategoryId, Listing, ListingStatus, PromoteTier } from '../src/types/marketplace.ts';
import { HttpError, sessionUserId, str, wrap } from './http.ts';
import type { AdminRepo } from './repo.ts';
import type { Storage } from './storage.ts';

/**
 * Admin panel API (/api/admin/*), used by the page at /#admin.
 *
 * Who is an admin:
 *  - accounts listed in the ADMIN_USER_IDS environment variable (comma separated,
 *    e.g. "telegram-123456789"); these cannot be removed from the panel;
 *  - accounts added from the panel by another admin (stored in the admins table).
 */

const CATEGORY_IDS = new Set<string>(MARKETPLACE_CATEGORIES.map((c) => c.id));
const LOCATION_IDS = new Set<string>(KYRGYZSTAN_LOCATIONS.map((l) => l.id));
const STATUSES = new Set<ListingStatus>(['active', 'sold', 'blocked']);
const TIERS = new Set<PromoteTier>(['none', 'vip', 'top']);

export function envAdminIds(): string[] {
  return (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

interface Deps {
  adminRepo: () => Promise<AdminRepo>;
  storage: Storage;
}

export function registerAdminRoutes(app: express.Express, { adminRepo, storage }: Deps) {
  const isAdmin = async (userId: string) => {
    if (envAdminIds().includes(userId)) return true;
    const a = await adminRepo();
    return (await a.isDbAdmin(userId)) && !(await a.isUserBlocked(userId));
  };

  /** Signed-in admin's id, or an HTTP error. */
  const requireAdmin = async (req: express.Request): Promise<string> => {
    const uid = sessionUserId(req);
    if (!uid) throw new HttpError(401, 'Sign in required');
    if (!(await isAdmin(uid))) throw new HttpError(403, 'Admins only');
    return uid;
  };

  // Every admin response is private
  app.use('/api/admin', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Tells the page who is signed in and whether they are an admin (never fails)
  app.get(
    '/api/admin/me',
    wrap(async (req, res) => {
      const uid = sessionUserId(req);
      res.json({ userId: uid, isAdmin: uid ? await isAdmin(uid) : false });
    })
  );

  app.get(
    '/api/admin/stats',
    wrap(async (req, res) => {
      await requireAdmin(req);
      res.json({ stats: await (await adminRepo()).stats() });
    })
  );

  /* ---------------- listings ---------------- */

  app.get(
    '/api/admin/listings',
    wrap(async (req, res) => {
      await requireAdmin(req);
      const listings = await (await adminRepo()).listListings(str(req.query.q).slice(0, 100), str(req.query.status));
      res.json({ listings });
    })
  );

  app.patch(
    '/api/admin/listings/:id',
    wrap(async (req, res) => {
      await requireAdmin(req);
      const a = await adminRepo();
      const current = await a.getListing(req.params.id);
      if (!current) throw new HttpError(404, 'Listing not found');
      const b = (req.body || {}) as Record<string, unknown>;

      // Start from the stored listing and apply only valid fields that were sent
      const next: Listing = { ...current };
      const text = (key: 'titleKg' | 'titleRu' | 'descriptionKg' | 'descriptionRu' | 'sellerName', max: number) => {
        if (typeof b[key] === "string") (next as unknown as Record<string, unknown>)[key] = str(b[key]).slice(0, max) || undefined;
      };
      text('titleKg', 140);
      text('titleRu', 140);
      text('descriptionKg', 3000);
      text('descriptionRu', 3000);
      text('sellerName', 80);
      if (!next.titleKg && !next.titleRu) throw new HttpError(400, 'A title is required');
      next.titleKg = next.titleKg || next.titleRu || '';
      next.descriptionKg = next.descriptionKg || next.descriptionRu || '';
      next.sellerName = next.sellerName || 'Сатуучу';

      if ('price' in b) {
        if (b.price === null || b.price === '') next.price = null;
        else if (typeof b.price === 'number' && Number.isFinite(b.price) && b.price >= 0) next.price = Math.round(b.price);
        else throw new HttpError(400, 'Invalid price');
      }
      if (b.currency === 'KGS' || b.currency === 'USD') next.currency = b.currency;
      if (typeof b.negotiable === 'boolean') next.negotiable = b.negotiable;
      if (typeof b.hasWhatsapp === 'boolean') next.hasWhatsapp = b.hasWhatsapp;
      if (typeof b.category === 'string') {
        if (!CATEGORY_IDS.has(b.category)) throw new HttpError(400, 'Invalid category');
        next.category = b.category as CategoryId;
      }
      if (typeof b.locationId === 'string') {
        if (!LOCATION_IDS.has(b.locationId)) throw new HttpError(400, 'Invalid location');
        next.locationId = b.locationId;
      }
      if (typeof b.phone === 'string') {
        if (str(b.phone).replace(/\D/g, '').length !== 12) throw new HttpError(400, 'Invalid phone');
        next.phone = str(b.phone);
      }
      if (typeof b.status === 'string') {
        if (!STATUSES.has(b.status as ListingStatus)) throw new HttpError(400, 'Invalid status');
        next.status = b.status as ListingStatus;
      }
      if (typeof b.promoteTier === 'string') {
        if (!TIERS.has(b.promoteTier as PromoteTier)) throw new HttpError(400, 'Invalid promotion tier');
        next.promoteTier = b.promoteTier as PromoteTier;
      }
      if (typeof b.views === 'number' && Number.isInteger(b.views) && b.views >= 0 && b.views < 1e9) next.views = b.views;

      // Photos can only be removed or reordered here, not added
      let removedImages: string[] = [];
      if (Array.isArray(b.images)) {
        const kept = b.images.filter((img): img is string => typeof img === 'string' && current.images.includes(img));
        removedImages = current.images.filter((img) => !kept.includes(img));
        next.images = Array.from(new Set(kept));
      }

      const saved = await a.saveListing(next);
      if (!saved) throw new HttpError(404, 'Listing not found');
      if (removedImages.length) {
        storage.deleteImages(removedImages).catch((err) => console.error('Image cleanup failed', err));
      }
      res.json({ listing: saved });
    })
  );

  app.delete(
    '/api/admin/listings/:id',
    wrap(async (req, res) => {
      await requireAdmin(req);
      const a = await adminRepo();
      const found = await a.getListing(req.params.id);
      if (!found) throw new HttpError(404, 'Listing not found');
      await a.resolveReportsFor(found.id);
      await a.deleteListing(found.id);
      storage.deleteImages(found.images).catch((err) => console.error('Image cleanup failed', err));
      res.json({ ok: true });
    })
  );

  /* ---------------- reports ---------------- */

  app.get(
    '/api/admin/reports',
    wrap(async (req, res) => {
      await requireAdmin(req);
      const status = str(req.query.status) || 'open';
      if (!['open', 'resolved', 'rejected', 'all'].includes(status)) throw new HttpError(400, 'Invalid status');
      res.json({ reports: await (await adminRepo()).listReports(status) });
    })
  );

  app.patch(
    '/api/admin/reports/:id',
    wrap(async (req, res) => {
      await requireAdmin(req);
      const status = str(req.body?.status);
      if (status !== 'open' && status !== 'resolved' && status !== 'rejected') throw new HttpError(400, 'Invalid status');
      if (!/^\d+$/.test(req.params.id)) throw new HttpError(404, 'Report not found');
      if (!(await (await adminRepo()).setReportStatus(req.params.id, status))) throw new HttpError(404, 'Report not found');
      res.json({ ok: true });
    })
  );

  /** Close all open reports about one listing (after blocking or checking it). */
  app.post(
    '/api/admin/listings/:id/resolve-reports',
    wrap(async (req, res) => {
      await requireAdmin(req);
      await (await adminRepo()).resolveReportsFor(req.params.id);
      res.json({ ok: true });
    })
  );

  /* ---------------- users ---------------- */

  app.get(
    '/api/admin/users',
    wrap(async (req, res) => {
      await requireAdmin(req);
      const users = await (await adminRepo()).listUsers(str(req.query.q).slice(0, 100));
      const envIds = envAdminIds();
      const a = await adminRepo();
      const dbAdmins = new Set((await a.listAdmins()).map((x) => x.userId));
      res.json({ users: users.map((u) => ({ ...u, isAdmin: envIds.includes(u.id) || dbAdmins.has(u.id) })) });
    })
  );

  app.patch(
    '/api/admin/users/:id',
    wrap(async (req, res) => {
      const me = await requireAdmin(req);
      if (typeof req.body?.blocked !== 'boolean') throw new HttpError(400, 'blocked must be true or false');
      const target = req.params.id;
      if (req.body.blocked && (target === me || (await isAdmin(target)))) {
        throw new HttpError(400, 'Remove admin rights before blocking this account');
      }
      if (!(await (await adminRepo()).setUserBlocked(target, req.body.blocked))) throw new HttpError(404, 'User not found');
      res.json({ ok: true });
    })
  );

  /* ---------------- admins ---------------- */

  app.get(
    '/api/admin/admins',
    wrap(async (req, res) => {
      await requireAdmin(req);
      res.json({ fromSettings: envAdminIds(), added: await (await adminRepo()).listAdmins() });
    })
  );

  app.post(
    '/api/admin/admins',
    wrap(async (req, res) => {
      const me = await requireAdmin(req);
      const userId = str(req.body?.userId);
      if (!/^(telegram|google|phone)-[A-Za-z0-9_.-]{1,64}$/.test(userId)) throw new HttpError(400, 'Invalid user id');
      const a = await adminRepo();
      if (await a.isUserBlocked(userId)) throw new HttpError(400, 'This account is blocked');
      await a.addAdmin(userId, me);
      res.status(201).json({ ok: true });
    })
  );

  app.delete(
    '/api/admin/admins/:userId',
    wrap(async (req, res) => {
      await requireAdmin(req);
      if (envAdminIds().includes(req.params.userId)) {
        throw new HttpError(400, 'This admin is set in ADMIN_USER_IDS on Vercel and can only be removed there');
      }
      await (await adminRepo()).removeAdmin(req.params.userId);
      res.json({ ok: true });
    })
  );

  /* ---------------- site settings ---------------- */

  app.put(
    '/api/admin/site',
    wrap(async (req, res) => {
      await requireAdmin(req);
      const kg = str(req.body?.announcementKg).slice(0, 300);
      const ru = str(req.body?.announcementRu).slice(0, 300);
      await (await adminRepo()).setSetting('announcement', JSON.stringify({ kg, ru }));
      res.json({ ok: true });
    })
  );
}
