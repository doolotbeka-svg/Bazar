/**
 * Client-side credentials for the API:
 *  - the session token issued at sign-in (proves who the user is);
 *  - per-listing manage keys returned when an ad is posted from this browser
 *    (let guests edit/delete their own ads without an account).
 */

const SESSION_KEY = 'tezbazar_session';
const AD_KEYS_KEY = 'tezbazar_ad_keys';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

function readAdKeys(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(AD_KEYS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveAdKey(listingId: string, key: string) {
  try {
    localStorage.setItem(AD_KEYS_KEY, JSON.stringify({ ...readAdKeys(), [listingId]: key }));
  } catch {
    // ignore
  }
}

export function removeAdKey(listingId: string) {
  const keys = readAdKeys();
  if (!(listingId in keys)) return;
  delete keys[listingId];
  try {
    localStorage.setItem(AD_KEYS_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

/** Headers for an API call: JSON body, session token, and the listing's manage key if known. */
export function authHeaders(listingId?: string, json = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  const token = getSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (listingId) {
    const key = readAdKeys()[listingId];
    if (key) headers['X-Listing-Key'] = key;
  }
  return headers;
}
