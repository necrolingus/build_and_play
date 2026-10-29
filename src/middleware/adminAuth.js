const crypto = require('crypto');
const { logger } = require('../utils/logger');
const {
  checkAdminRateLimit,
  recordAdminAuthFailure,
  clearAdminAuthFailures
} = require('./rateLimiter');

/**
 * Middleware that authenticates requests against the static ADMIN_API_KEY
 * configured in the .env file.
 * Enforces IP rate limiting (behind Cloudflare / reverse proxies / direct):
 * Blocks the IP if an incorrect password is provided more than ADMIN_AUTH_MAX_FAILURES (3)
 * times within ADMIN_AUTH_WINDOW_SECONDS (5 minutes).
 */
function requireAdminAuth(req, res, next) {
  const rateCheck = checkAdminRateLimit(req);
  if (rateCheck.blocked) {
    logger.warn('Blocked IP attempted admin access during lockout window', {
      ip: rateCheck.ip,
      retryAfterSeconds: rateCheck.retryAfterSeconds,
      path: req.originalUrl
    });
    res.set('Retry-After', String(rateCheck.retryAfterSeconds));
    return res.status(429).json({
      error: `Too many failed admin login attempts from your IP (${rateCheck.ip}). Try again in ${rateCheck.retryAfterSeconds} seconds.`
    });
  }

  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) {
    logger.error('ADMIN_API_KEY is not configured in .env');
    return res.status(500).json({ error: 'Server admin authentication is not configured.' });
  }

  const providedKey = String(req.headers['x-admin-api-key'] || '').trim();
  if (!providedKey) {
    return res.status(401).json({ error: 'Missing admin API key.' });
  }

  const bufA = Buffer.from(configuredKey, 'utf8');
  const bufB = Buffer.from(providedKey, 'utf8');

  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    const failureInfo = recordAdminAuthFailure(req);
    logger.warn('Invalid admin API key attempt', {
      ip: failureInfo.ip,
      failureCount: failureInfo.failureCount,
      maxAllowedFailures: failureInfo.maxAllowedFailures,
      ipBlocked: failureInfo.blocked,
      path: req.originalUrl
    });

    if (failureInfo.blocked) {
      res.set('Retry-After', String(failureInfo.retryAfterSeconds));
      return res.status(429).json({
        error: `Too many failed admin login attempts (more than ${failureInfo.maxAllowedFailures} in 5 minutes). Your IP (${failureInfo.ip}) has been temporarily blocked for ${failureInfo.retryAfterSeconds} seconds.`
      });
    }

    const remaining = Math.max(0, failureInfo.maxAllowedFailures - failureInfo.failureCount + 1);
    return res.status(403).json({
      error: `Invalid admin API key. (${remaining} attempt(s) remaining before IP lockout).`
    });
  }

  // Successful authentication clears any prior failure count for this IP
  clearAdminAuthFailures(req);
  next();
}

module.exports = {
  requireAdminAuth
};
