import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

export const GUEST_SESSION_COOKIE = 'guest_session_id';

const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Ensure browser has `guest_session_id` cookie (HttpOnly).
 * Reuses existing cookie when present; otherwise creates a new UUID.
 */
export function ensureGuestSessionId(req: Request, res: Response): string {
  const cookies = req.cookies as Record<string, string> | undefined;
  const existing = cookies?.[GUEST_SESSION_COOKIE]?.trim();
  if (existing) {
    return existing;
  }

  const guestSessionId = randomUUID();
  res.cookie(GUEST_SESSION_COOKIE, guestSessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
  return guestSessionId;
}
