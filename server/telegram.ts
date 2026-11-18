import { createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * Telegram Login Widget (https://core.telegram.org/widgets/login).
 * The widget hands the browser a signed user object; the server checks the
 * signature with the bot token before trusting it.
 *
 * Env vars (Vercel → Settings → Environment Variables):
 *   TELEGRAM_BOT_TOKEN – token from @BotFather (secret)
 *   TELEGRAM_BOT_NAME  – bot username without @ (default AlMartKgBot)
 * The bot's domain must be set in @BotFather with /setdomain.
 */

const MAX_AUTH_AGE_S = 24 * 60 * 60; // reject logins signed more than a day ago

export interface TelegramIdentity {
  id: string;
  name: string;
  username?: string;
}

export function getTelegramBotName(): string | null {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return null;
  return (process.env.TELEGRAM_BOT_NAME?.trim() || 'AlMartKgBot').replace(/^@/, '');
}

/** Verify the widget payload; returns the identity or null if the signature/age is invalid. */
export function verifyTelegramAuth(payload: unknown, nowMs = Date.now()): TelegramIdentity | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !payload || typeof payload !== 'object') return null;

  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (!/^[a-z_]{1,32}$/.test(key)) return null;
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    fields[key] = String(value);
  }
  const hash = fields.hash;
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  delete fields.hash;

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secretKey = createHash('sha256').update(token).digest();
  const expected = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) return null;

  const authDate = Number(fields.auth_date);
  if (!Number.isFinite(authDate) || nowMs / 1000 - authDate > MAX_AUTH_AGE_S) return null;
  if (!/^\d{1,20}$/.test(fields.id || '')) return null;

  const name = [fields.first_name, fields.last_name].filter(Boolean).join(' ').trim();
  return {
    id: fields.id,
    name: (name || (fields.username ? `@${fields.username}` : 'Telegram')).slice(0, 80),
    username: fields.username
  };
}
