import { randomUUID } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';

export const GUEST_SESSION_COOKIE = 'guest_session_id';

const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function guestCookieOptions(): CookieOptions {
  // Cross-origin FE → API (ngrok / separate domains) needs SameSite=None; Secure.
  // Local same-site (localhost FE + localhost API): keep Lax + insecure OK.
  // Set COOKIE_SAME_SITE=none when FE origin ≠ API origin (e.g. bioring.website → ngrok).
  const sameSiteRaw = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  const sameSite =
    sameSiteRaw === 'none' || sameSiteRaw === 'strict' || sameSiteRaw === 'lax'
      ? sameSiteRaw
      : 'lax';

  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    sameSite === 'none' ||
    process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite,
    secure,
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

/**
 * Ensure browser has `guest_session_id` cookie (HttpOnly).
 * Reuses existing cookie when present; always re-Set-Cookie so attributes
 * (SameSite/Secure) stay correct after env changes.
 */
export function ensureGuestSessionId(req: Request, res: Response): string {
  const cookies = req.cookies as Record<string, string> | undefined;
  const existing = cookies?.[GUEST_SESSION_COOKIE]?.trim();
  const guestSessionId = existing || randomUUID();

  res.cookie(GUEST_SESSION_COOKIE, guestSessionId, guestCookieOptions());
  return guestSessionId;
}
