import { randomBytes } from 'crypto';

/**
 * SMS delivery for login codes.
 *
 * Provider: SMSPRO.KG (Nikita), XML API — https://smspro.nikita.kg/kg/documents/smspro.nikita.kg-XML-api.pdf
 * Enabled when these env vars are set (in Vercel → Settings → Environment Variables):
 *   NIKITA_LOGIN     – API login from the SMSPRO.KG account
 *   NIKITA_PASSWORD  – API password
 *   NIKITA_SENDER    – approved sender name (default "AlMart")
 *   NIKITA_TEST=1    – optional: the gateway accepts requests but sends nothing and charges nothing
 *
 * Without credentials the site runs in DEMO mode: the code is shown on screen
 * instead of being sent, so anyone can sign in as any number.
 */

export interface SmsSender {
  readonly name: string;
  /** True when messages are not really delivered (gateway test mode). */
  readonly test: boolean;
  send(phoneDigits: string, text: string): Promise<void>;
}

const NIKITA_URL = 'https://smspro.nikita.kg/api/message';

/** Meanings of the <status> codes returned by /api/message. */
const NIKITA_STATUS: Record<number, string> = {
  0: 'accepted',
  1: 'malformed request',
  2: 'invalid login or password',
  3: 'sender IP address not allowed (remove the IP restriction in the SMSPRO.KG profile)',
  4: 'insufficient account balance',
  5: 'sender name not approved',
  6: 'blocked by stop words',
  7: 'invalid phone number',
  8: 'invalid send time',
  9: 'gateway busy, retry with the same id',
  10: 'duplicate message id',
  11: 'accepted in test mode (not sent)'
};

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Unique message id: latin letters and digits, at most 12 chars. */
function messageId(): string {
  const time = Date.now().toString(36); // 8 chars
  const rand = randomBytes(4).toString('hex').slice(0, 12 - time.length);
  return (time + rand).slice(0, 12);
}

class NikitaSender implements SmsSender {
  readonly name = 'smspro.nikita.kg';

  constructor(
    private login: string,
    private password: string,
    private sender: string,
    readonly test: boolean
  ) {}

  async send(phoneDigits: string, text: string): Promise<void> {
    const id = messageId();
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<message>' +
      `<login>${escapeXml(this.login)}</login>` +
      `<pwd>${escapeXml(this.password)}</pwd>` +
      `<id>${id}</id>` +
      `<sender>${escapeXml(this.sender)}</sender>` +
      `<text>${escapeXml(text)}</text>` +
      `<phones><phone>${phoneDigits}</phone></phones>` +
      (this.test ? '<test>1</test>' : '') +
      '</message>';

    // Status 9 = gateway busy: the docs ask to repeat with the same id after 5-10 s
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(NIKITA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
        body,
        signal: AbortSignal.timeout(15_000)
      });
      const xml = await res.text();
      const status = Number(/<status>\s*(\d+)\s*<\/status>/.exec(xml)?.[1] ?? NaN);
      if (status === 0 || (status === 11 && this.test)) return;
      if (status === 9 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 6000));
        continue;
      }
      const detail = /<message>([^<]*)<\/message>/.exec(xml)?.[1] || '';
      throw new Error(
        `SMSPRO.KG send failed: HTTP ${res.status}, status ${Number.isNaN(status) ? 'unknown' : status}` +
          ` (${NIKITA_STATUS[status] || 'unexpected response'})${detail ? `: ${detail}` : ''}`
      );
    }
  }
}

export function createSmsSender(): SmsSender | null {
  const login = process.env.NIKITA_LOGIN?.trim();
  const password = process.env.NIKITA_PASSWORD?.trim();
  if (!login || !password) return null;
  const sender = process.env.NIKITA_SENDER?.trim() || 'AlMart';
  return new NikitaSender(login, password, sender, process.env.NIKITA_TEST === '1');
}

/**
 * True when codes are shown on screen instead of being delivered:
 * no provider configured, or the provider is in test mode.
 */
export function isSmsDemoMode(sender: SmsSender | null): boolean {
  return sender === null || sender.test;
}
