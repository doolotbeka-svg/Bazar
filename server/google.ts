/**
 * Google Sign-In: the browser gets an ID token (JWT) from Google Identity
 * Services and the server checks it with Google before trusting the email.
 * Enabled only when GOOGLE_CLIENT_ID is set.
 */

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}

export function getGoogleClientId(): string | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  return id ? id : null;
}

/** Verify an ID token via Google's tokeninfo endpoint; returns null if it is not valid for us. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  const clientId = getGoogleClientId();
  if (!clientId || !idToken || idToken.length > 4096) return null;

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) return null;
  const info = (await res.json()) as Record<string, string | undefined>;

  const issuerOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  const notExpired = Number(info.exp) * 1000 > Date.now();
  if (info.aud !== clientId || !issuerOk || !notExpired || info.email_verified !== 'true') return null;
  if (!info.sub || !info.email) return null;

  return { sub: info.sub, email: info.email, name: info.name || info.email.split('@')[0] };
}
