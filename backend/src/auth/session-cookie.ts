import type { CookieOptions, Request } from 'express';

export const SESSION_COOKIE_NAME = 'moctes_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function sessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

export function readSessionToken(
  request: Pick<Request, 'headers'>,
): string | undefined {
  const header = request.headers.cookie;
  if (!header) {
    return undefined;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    if (name === SESSION_COOKIE_NAME) {
      const value = part.slice(separator + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
