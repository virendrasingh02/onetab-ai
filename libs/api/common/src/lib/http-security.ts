import type { NextFunction, Request, Response } from 'express';
import type { HelmetOptions } from 'helmet';

/**
 * Helmet configuration for the JSON API. The API never serves documents that
 * should render, so the CSP denies everything and forbids framing outright;
 * `crossOriginResourcePolicy` stays `cross-origin` because the web/desktop
 * clients on other origins load avatars and files from here.
 */
export function buildHelmetOptions(): HelmetOptions {
  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
  };
}

/** Routes the load balancer / orchestrator probes over plain HTTP. */
const PROBE_PATHS = /\/(health|ready)\/?$/;

/**
 * Sends plain-HTTP requests to HTTPS. Only meaningful behind a TLS-terminating
 * proxy with `trust proxy` set, so `req.protocol` reflects X-Forwarded-Proto.
 * Mutating methods get a 426 rather than a redirect: a 301 would downgrade the
 * method and the credentials in the first request were already exposed.
 */
export function httpsRedirect() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.secure || PROBE_PATHS.test(req.path)) {
      next();
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      const host = req.headers.host ?? '';
      res.redirect(308, `https://${host}${req.originalUrl}`);
      return;
    }
    res.status(426).json({
      statusCode: 426,
      message: 'HTTPS is required.',
    });
  };
}
