import type express from 'express';
import { verifySessionToken } from './auth.ts';

/** Safely read a trimmed string from untrusted JSON input. */
export function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

type AsyncHandler = (req: express.Request, res: express.Response) => Promise<void>;
/** Express 4 does not catch rejected promises; forward them to the error handler. */
export const wrap =
  (fn: AsyncHandler): express.RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/** User id from `Authorization: Bearer <session token>`, or null. */
export function sessionUserId(req: express.Request): string | null {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? verifySessionToken(match[1]) : null;
}
