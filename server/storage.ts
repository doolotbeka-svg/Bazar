import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { del, get, put } from '@vercel/blob';
import { SEED_LISTINGS } from '../src/data/seedListings.ts';
import type { Listing, UserProfile } from '../src/types/marketplace.ts';

/** Pending SMS login code for one phone number (the code itself is stored only as an HMAC). */
export interface OtpRecord {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  /** YYYY-MM-DD and number of SMS sent that day, for the daily limit */
  day: string;
  sentToday: number;
}

export interface StoreData {
  listings: Listing[];
  favoritesByUser: Record<string, string[]>;
  users: Record<string, UserProfile>;
  otps: Record<string, OtpRecord>;
}

export interface StoredImage {
  stream: Readable;
  contentType: string;
}

export interface Storage {
  readonly kind: 'blob' | 'file';
  load(): Promise<StoreData>;
  save(data: StoreData): Promise<void>;
  /** Persist an uploaded data: URL and return the URL the client should use. */
  saveImage(listingId: string, index: number, dataUrl: string): Promise<string>;
  getImage(pathname: string): Promise<StoredImage | null>;
  deleteImages(urls: string[]): Promise<void>;
}

/** Public URL prefix under which uploaded images are served by the API. */
export const IMAGE_ROUTE_PREFIX = '/api/images/';

function emptyStore(): StoreData {
  return { listings: SEED_LISTINGS, favoritesByUser: {}, users: {}, otps: {} };
}

function normalize(parsed: Partial<StoreData> | null | undefined): StoreData {
  if (!parsed || typeof parsed !== 'object') return emptyStore();
  return {
    // Only re-seed when the data is corrupted. An empty array is a valid state
    // (e.g. every listing was deleted) and must not bring the demo data back.
    listings: Array.isArray(parsed.listings) ? parsed.listings : SEED_LISTINGS,
    favoritesByUser: parsed.favoritesByUser || {},
    users: parsed.users || {},
    otps: parsed.otps || {}
  };
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } | null {
  const match = /^data:(image\/(jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
  return { buffer: Buffer.from(match[3], 'base64'), contentType: match[1], ext };
}

/* ------------------------------------------------------------------ */
/* Vercel Blob (private store) — used in production on Vercel          */
/* ------------------------------------------------------------------ */

const STORE_PATHNAME = 'db/store.json';

class BlobStorage implements Storage {
  readonly kind = 'blob' as const;

  async load(): Promise<StoreData> {
    // useCache:false guarantees we read the latest version after an overwrite
    const result = await get(STORE_PATHNAME, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return emptyStore();
    }
    const text = await new Response(result.stream).text();
    try {
      return normalize(JSON.parse(text) as Partial<StoreData>);
    } catch {
      console.error('Corrupted store blob, falling back to seed data');
      return emptyStore();
    }
  }

  async save(data: StoreData): Promise<void> {
    await put(STORE_PATHNAME, JSON.stringify(data), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60
    });
  }

  async saveImage(listingId: string, index: number, dataUrl: string): Promise<string> {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) throw new Error('Unsupported image');
    const pathname = `images/${listingId}-${index}.${parsed.ext}`;
    await put(pathname, parsed.buffer, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: parsed.contentType
    });
    return IMAGE_ROUTE_PREFIX + pathname;
  }

  async getImage(pathname: string): Promise<StoredImage | null> {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return {
      stream: Readable.fromWeb(result.stream as import('stream/web').ReadableStream),
      contentType: result.blob.contentType || 'application/octet-stream'
    };
  }

  async deleteImages(urls: string[]): Promise<void> {
    const pathnames = urls
      .filter((u) => u.startsWith(IMAGE_ROUTE_PREFIX))
      .map((u) => u.slice(IMAGE_ROUTE_PREFIX.length));
    if (pathnames.length > 0) await del(pathnames);
  }
}

/* ------------------------------------------------------------------ */
/* Local JSON file — used for `npm run dev` without a Blob token       */
/* ------------------------------------------------------------------ */

class FileStorage implements Storage {
  readonly kind = 'file' as const;
  private readonly dir = path.join(process.cwd(), 'data');
  private readonly file = path.join(this.dir, 'store.json');

  async load(): Promise<StoreData> {
    if (!fs.existsSync(this.file)) {
      const initial = emptyStore();
      await this.save(initial);
      return initial;
    }
    try {
      return normalize(JSON.parse(fs.readFileSync(this.file, 'utf-8')) as Partial<StoreData>);
    } catch {
      return emptyStore();
    }
  }

  async save(data: StoreData): Promise<void> {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf-8');
  }

  async saveImage(_listingId: string, _index: number, dataUrl: string): Promise<string> {
    if (!parseDataUrl(dataUrl)) throw new Error('Unsupported image');
    return dataUrl; // kept inline in the JSON file locally
  }

  async getImage(): Promise<StoredImage | null> {
    return null;
  }

  async deleteImages(): Promise<void> {}
}

export function createStorage(): Storage {
  if (process.env.BLOB_READ_WRITE_TOKEN) return new BlobStorage();
  if (process.env.VERCEL) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set: connect a Vercel Blob store to the project');
  }
  return new FileStorage();
}
