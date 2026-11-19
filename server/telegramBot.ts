import { createHmac } from 'crypto';

/**
 * Sign-in through the Telegram bot (no phone number, no Login Widget):
 *  1. the site creates a random nonce and opens t.me/<bot>?start=login_<nonce>;
 *  2. the user presses Start; the bot (webhook) asks to confirm with a button;
 *  3. on confirm the nonce is marked confirmed with the Telegram user;
 *  4. the page polls and receives a session token.
 *
 * Uses TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_NAME (see telegram.ts) and
 * TELEGRAM_WEBHOOK_BASE (default https://tezbazar.vercel.app) — the public
 * site URL Telegram should call.
 */

export const TG_LOGIN_TTL_MS = 10 * 60 * 1000;
export const WEBHOOK_PATH = '/api/telegram/webhook';

const botToken = () => process.env.TELEGRAM_BOT_TOKEN?.trim() || '';

export function webhookBase(): string {
  return (process.env.TELEGRAM_WEBHOOK_BASE?.trim() || 'https://tezbazar.vercel.app').replace(/\/+$/, '');
}

/** Secret Telegram echoes in X-Telegram-Bot-Api-Secret-Token, so forged webhook calls are rejected. */
export function webhookSecret(): string {
  return createHmac('sha256', botToken()).update('almart-webhook').digest('hex');
}

export async function telegramApi<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10_000)
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description || res.status}`);
  return data.result as T;
}

let webhookReady: Promise<void> | null = null;

/** Point the bot's webhook at this site once per server instance (idempotent). */
export function ensureWebhook(): Promise<void> {
  webhookReady ??= (async () => {
    const url = webhookBase() + WEBHOOK_PATH;
    const info = await telegramApi<{ url?: string }>('getWebhookInfo', {});
    if (info.url !== url) {
      await telegramApi('setWebhook', {
        url,
        secret_token: webhookSecret(),
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true
      });
    }
  })().catch((err) => {
    webhookReady = null; // retry on the next login attempt
    throw err;
  });
  return webhookReady;
}

export const isValidNonce = (n: unknown): n is string => typeof n === 'string' && /^[A-Za-z0-9_-]{16,40}$/.test(n);

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export function displayName(u: TgUser): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return (name || (u.username ? `@${u.username}` : 'Telegram')).slice(0, 80);
}
