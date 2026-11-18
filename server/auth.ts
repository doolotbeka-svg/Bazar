import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Stateless, HMAC-signed credentials:
 *  - session token: proves which user is signed in (issued at login);
 *  - listing manage key: proves the caller posted that listing (lets guests
 *    manage their own ads without an account).
 * Nothing secret is stored next to the listings, so GET /api/listings cannot leak it.
 */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function resolveSecret(): Buffer {
  const explicit = process.env.SESSION_SECRET;
  if (explicit && explicit.length >= 32) return Buffer.from(explicit);
  // On Vercel the Blob token is a stable server-only secret; derive a separate key from it
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) return createHash('sha256').update(`tezbazar-auth:${blobToken}`).digest();
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET (>= 32 chars) or BLOB_READ_WRITE_TOKEN must be set');
  }
  // Local dev: random per process (sessions reset on server restart)
  return randomBytes(32);
}

let secret: Buffer | null = null;
const getSecret = () => (secret ??= resolveSecret());

const b64url = (buf: Buffer) => buf.toString('base64url');

function sign(purpose: string, value: string): string {
  return b64url(createHmac('sha256', getSecret()).update(`${purpose}\n${value}`).digest());
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/* ---------------- sessions ---------------- */

export function createSessionToken(userId: string): string {
  const payload = b64url(Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS })));
  return `${payload}.${sign('session', payload)}`;
}

/** Returns the user id for a valid, unexpired token, otherwise null. */
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  if (!safeEqual(signature, sign('session', payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid?: unknown; exp?: unknown };
    if (typeof data.uid !== 'string' || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

/* ---------------- per-listing manage keys ---------------- */

export function createListingKey(listingId: string): string {
  return sign('listing', listingId);
}

export function verifyListingKey(listingId: string, key: string | undefined | null): boolean {
  return Boolean(key) && safeEqual(key!, createListingKey(listingId));
}
