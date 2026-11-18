/**
 * SMS delivery for login codes.
 *
 * No provider is wired up yet: until one is configured the site runs in
 * DEMO mode, where the code is returned to the browser and shown on screen
 * instead of being sent. In demo mode anyone can sign in as any number, so a
 * real provider must be configured before launch.
 *
 * To add a provider, implement `send` below and enable it via env vars.
 */

export interface SmsSender {
  readonly name: string;
  send(phoneDigits: string, text: string): Promise<void>;
}

export function createSmsSender(): SmsSender | null {
  // e.g. if (process.env.SMS_PROVIDER === 'nikita') return new NikitaSender(...)
  return null;
}

/** True when codes are shown on screen instead of being sent by SMS. */
export function isSmsDemoMode(sender: SmsSender | null): boolean {
  return sender === null;
}
