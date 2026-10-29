require('dotenv').config();

/**
 * Extracts the true client IP address whether the app is running:
 * 1. Behind Cloudflare (CF-Connecting-IP / True-Client-IP)
 * 2. Behind a Reverse Proxy like Nginx/Traefik/Caddy (X-Real-IP / X-Forwarded-For)
 * 3. Behind both Cloudflare + Reverse Proxy
 * 4. Directly exposed with neither proxy (req.ip / req.socket.remoteAddress)
 */
function getClientIp(req) {
  // 1. Cloudflare authoritative client IP headers
  const cfIp = req.headers['cf-connecting-ip'] || req.headers['true-client-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return normalizeIp(cfIp.split(',')[0].trim());
  }

  // 2. X-Forwarded-For chain: the first (left-most) IP is the original client IP
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const firstIp = xff.split(',')[0].trim();
    if (firstIp) {
      return normalizeIp(firstIp);
    }
  }

  // 3. X-Real-IP (often set by Nginx)
  const xRealIp = req.headers['x-real-ip'];
  if (typeof xRealIp === 'string' && xRealIp.trim()) {
    return normalizeIp(xRealIp.trim());
  }

  // 4. Direct socket / Express req.ip fallback
  const fallbackIp = req.ip || req.socket?.remoteAddress || 'unknown';
  return normalizeIp(String(fallbackIp));
}

function normalizeIp(ip) {
  // Convert IPv4-mapped IPv6 addresses like ::ffff:192.168.1.50 to 192.168.1.50
  if (ip.startsWith('::ffff:')) {
    return ip.slice(7);
  }
  if (ip === '::1') {
    return '127.0.0.1';
  }
  return ip;
}

/**
 * Rate limit configuration loaded from .env with sensible defaults.
 */
function getRateLimitConfig() {
  return {
    // Admin failed auth protection: block IP if > 3 failed attempts within 5 minutes
    adminAuthMaxFailures: parseInt(process.env.ADMIN_AUTH_MAX_FAILURES || '3', 10),
    adminAuthWindowSeconds: parseInt(process.env.ADMIN_AUTH_WINDOW_SECONDS || '300', 10),
    adminAuthBlockSeconds: parseInt(process.env.ADMIN_AUTH_BLOCK_SECONDS || '900', 10),

    // Level submission rate limiting:
    // Kept low in .env for testing (e.g. 5s cooldown), easily set to 300s (5m) in production
    levelSubmitMaxRequests: parseInt(process.env.LEVEL_SUBMIT_MAX_REQUESTS || '1', 10),
    levelSubmitWindowSeconds: parseInt(process.env.LEVEL_SUBMIT_WINDOW_SECONDS || '5', 10),
    // Key strategy for level submissions:
    // 'IP' = strict per-IP limit
    // 'IP_AND_CLIENT_TOKEN' = combines IP + X-Creator-Client-Id so multiple users behind the same corporate NAT don't block each other
    levelSubmitStrategy: (process.env.LEVEL_SUBMIT_RATE_STRATEGY || 'IP').toUpperCase()
  };
}

// In-memory stores (key -> { attempts: number[], blockedUntil: number })
const adminFailureStore = new Map();
const levelSubmitStore = new Map();

/**
 * Checks whether an IP is currently blocked from Admin authentication attempts.
 */
function checkAdminRateLimit(req) {
  const ip = getClientIp(req);
  const cfg = getRateLimitConfig();
  const now = Date.now();
  const windowMs = cfg.adminAuthWindowSeconds * 1000;

  let record = adminFailureStore.get(ip);
  if (!record) {
    return { blocked: false, ip };
  }

  // If currently in an active block window
  if (record.blockedUntil && record.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { blocked: true, ip, retryAfterSeconds };
  }

  // Prune expired failure timestamps outside the window
  record.attempts = record.attempts.filter((ts) => now - ts < windowMs);
  if (record.attempts.length === 0 && (!record.blockedUntil || record.blockedUntil <= now)) {
    adminFailureStore.delete(ip);
    return { blocked: false, ip };
  }

  return { blocked: false, ip };
}

/**
 * Records a failed Admin password attempt for the client's IP.
 * If failed attempts exceed adminAuthMaxFailures (e.g. > 3 in 5 minutes), blocks the IP.
 */
function recordAdminAuthFailure(req) {
  const ip = getClientIp(req);
  const cfg = getRateLimitConfig();
  const now = Date.now();
  const windowMs = cfg.adminAuthWindowSeconds * 1000;
  const blockMs = cfg.adminAuthBlockSeconds * 1000;

  let record = adminFailureStore.get(ip) || { attempts: [], blockedUntil: 0 };
  record.attempts = record.attempts.filter((ts) => now - ts < windowMs);
  record.attempts.push(now);

  // "more than N times in W minutes" -> block when attempts > adminAuthMaxFailures
  const newlyBlocked = record.attempts.length > cfg.adminAuthMaxFailures;
  if (newlyBlocked) {
    record.blockedUntil = now + blockMs;
  }

  adminFailureStore.set(ip, record);
  return {
    ip,
    failureCount: record.attempts.length,
    maxAllowedFailures: cfg.adminAuthMaxFailures,
    blocked: newlyBlocked,
    retryAfterSeconds: newlyBlocked ? Math.ceil(blockMs / 1000) : 0
  };
}

/**
 * Clears failure history for an IP upon successful Admin login.
 */
function clearAdminAuthFailures(req) {
  const ip = getClientIp(req);
  adminFailureStore.delete(ip);
}

/**
 * Express middleware to rate-limit level submissions (`POST /api/levels`).
 */
function levelSubmitRateLimiter(req, res, next) {
  const cfg = getRateLimitConfig();
  if (cfg.levelSubmitWindowSeconds <= 0 || cfg.levelSubmitMaxRequests <= 0) {
    return next();
  }

  const ip = getClientIp(req);
  const clientId = String(req.headers['x-creator-client-id'] || '').trim().slice(0, 64);

  const key =
    cfg.levelSubmitStrategy === 'IP_AND_CLIENT_TOKEN' && clientId
      ? `${ip}:${clientId}`
      : ip;

  const now = Date.now();
  const windowMs = cfg.levelSubmitWindowSeconds * 1000;

  let timestamps = levelSubmitStore.get(key) || [];
  timestamps = timestamps.filter((ts) => now - ts < windowMs);

  if (timestamps.length >= cfg.levelSubmitMaxRequests) {
    const oldestInWindow = timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: `Slow down! You can submit at most ${cfg.levelSubmitMaxRequests} level(s) every ${cfg.levelSubmitWindowSeconds} seconds. Please wait ${retryAfterSeconds}s before submitting again.`,
      retryAfterSeconds
    });
  }

  timestamps.push(now);
  levelSubmitStore.set(key, timestamps);
  next();
}

module.exports = {
  getClientIp,
  getRateLimitConfig,
  checkAdminRateLimit,
  recordAdminAuthFailure,
  clearAdminAuthFailures,
  levelSubmitRateLimiter
};
