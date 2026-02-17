import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

/**
 * CSRF double-submit cookie middleware.
 *
 * How it works:
 * 1. On every response, sets a `XSRF-TOKEN` cookie (httpOnly: false)
 *    so the frontend (Angular) can read it.
 * 2. On state-changing requests (POST, PUT, PATCH, DELETE),
 *    validates that header `X-XSRF-TOKEN` matches the cookie value.
 * 3. An attacker on a different origin cannot read our cookies
 *    (SameSite + same-origin policy), so they can't forge the header.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private static readonly COOKIE_NAME = 'XSRF-TOKEN';
  private static readonly HEADER_NAME = 'x-xsrf-token'; // express lowercases headers
  private static readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  use(req: Request, res: Response, next: NextFunction) {
    // Always (re)set the XSRF-TOKEN cookie so the SPA can pick it up.
    // Generate a new token if one doesn't exist yet in the request cookies.
    let token = req.cookies?.[CsrfMiddleware.COOKIE_NAME];
    if (!token) {
      token = randomBytes(32).toString('hex');
    }

    // Set cookie on every response (refresh expiry, keep in sync)
    res.cookie(CsrfMiddleware.COOKIE_NAME, token, {
      httpOnly: false,   // Frontend must be able to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    // Safe methods don't need CSRF validation
    if (CsrfMiddleware.SAFE_METHODS.has(req.method)) {
      return next();
    }

    // Validate: header must match cookie
    const headerToken = req.headers[CsrfMiddleware.HEADER_NAME] as string | undefined;

    if (!headerToken || headerToken !== token) {
      throw new ForbiddenException('CSRF token missing or invalid');
    }

    next();
  }
}
