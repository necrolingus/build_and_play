const crypto = require('crypto');
const { getClientIp } = require('../middleware/rateLimiter');
const { logger } = require('../utils/logger');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Extracts the hostname (without port) from the incoming Express request.
 */
function getRequestHostname(req) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const rawHost =
    (typeof forwardedHost === 'string' && forwardedHost.split(',')[0].trim()) ||
    req.headers.host ||
    req.hostname ||
    '';
  // Strip port if present (handling IPv6 brackets)
  if (rawHost.startsWith('[')) {
    const closeIdx = rawHost.indexOf(']');
    return closeIdx !== -1 ? rawHost.slice(0, closeIdx + 1).toLowerCase() : rawHost.toLowerCase();
  }
  return rawHost.split(':')[0].trim().toLowerCase();
}

/**
 * Determines whether the current request is running on a local/LAN dev host
 * vs the configured production Turnstile hostname (e.g. buildandplay.leighonline.net).
 */
function isLocalOrLanHost(hostname) {
  if (!hostname || LOCAL_HOSTS.has(hostname)) return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.localhost')) return true;
  // Private IPv4 ranges (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
    return true;
  }
  return false;
}

/**
 * Reads security & Turnstile / Proof-of-Work settings from .env
 */
function getSecurityConfig(req) {
  const siteKey = (process.env.SITE_KEY || process.env.TURNSTILE_SITE_KEY || '').trim();
  const secretKey = (process.env.SECRET_KEY || process.env.TURNSTILE_SECRET_KEY || '').trim();
  const allowedDomain = (
    process.env.TURNSTILE_DOMAIN || 'buildandplay.leighonline.net'
  )
    .trim()
    .toLowerCase();

  // TURNSTILE_MODE can be: 'AUTO' (default), 'ALWAYS', or 'OFF'
  const mode = (process.env.TURNSTILE_MODE || 'AUTO').trim().toUpperCase();
  const keysConfigured = Boolean(siteKey && secretKey);

  const reqHost = req ? getRequestHostname(req) : '';
  let turnstileActive = false;

  if (keysConfigured && mode !== 'OFF') {
    if (mode === 'ALWAYS') {
      turnstileActive = true;
    } else {
      // AUTO mode: activate Turnstile when accessed via the production domain (or any non-local domain matching allowedDomain)
      if (!isLocalOrLanHost(reqHost)) {
        turnstileActive = !allowedDomain || reqHost === allowedDomain || reqHost.endsWith(`.${allowedDomain}`);
      }
    }
  }

  const powEnabled = (process.env.POW_ENABLED || 'true').trim().toLowerCase() !== 'false';
  const powDifficulty = Math.max(
    1,
    Math.min(6, parseInt(process.env.POW_DIFFICULTY || '3', 10))
  );
  const powTtlSeconds = parseInt(process.env.POW_TTL_SECONDS || '300', 10);

  return {
    turnstileActive,
    siteKey: turnstileActive ? siteKey : null,
    secretKey,
    allowedDomain,
    reqHost,
    powEnabled,
    powDifficulty,
    powTtlSeconds
  };
}

// Track consumed PoW challenges so a single challenge cannot be replayed
const usedChallenges = new Map();

function pruneUsedChallenges() {
  const now = Date.now();
  for (const [id, exp] of usedChallenges.entries()) {
    if (exp <= now) {
      usedChallenges.delete(id);
    }
  }
}

/**
 * Issues a signed, stateless Proof-of-Work challenge for the client browser to solve.
 */
function createPowChallenge(req) {
  const sec = getSecurityConfig(req);
  const challengeId = crypto.randomUUID();
  const timestamp = Date.now();
  const difficulty = sec.powDifficulty;
  const hmacSecret = process.env.ADMIN_API_KEY || process.env.SECRET_KEY || 'retro_pow_fallback_secret';

  const payload = `${challengeId}:${timestamp}:${difficulty}`;
  const signature = crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');

  return {
    challenge: `${payload}:${signature}`,
    difficulty
  };
}

/**
 * Verifies a client's solved Proof-of-Work challenge + nonce.
 */
function verifyPowSolution(req, challengeStr, nonce) {
  const sec = getSecurityConfig(req);
  if (!sec.powEnabled) {
    return { valid: true };
  }

  if (!challengeStr || nonce === undefined || nonce === null) {
    return { valid: false, error: 'Missing Proof-of-Work security challenge solution.' };
  }

  const parts = String(challengeStr).split(':');
  if (parts.length !== 4) {
    return { valid: false, error: 'Malformed Proof-of-Work challenge token.' };
  }

  const [challengeId, tsStr, diffStr, signature] = parts;
  const timestamp = Number(tsStr);
  const difficulty = Number(diffStr);

  if (!Number.isFinite(timestamp) || !Number.isFinite(difficulty)) {
    return { valid: false, error: 'Invalid Proof-of-Work challenge parameters.' };
  }

  const now = Date.now();
  if (now - timestamp > sec.powTtlSeconds * 1000) {
    return { valid: false, error: 'Proof-of-Work challenge expired. Please try submitting again.' };
  }

  pruneUsedChallenges();
  if (usedChallenges.has(challengeId)) {
    return { valid: false, error: 'Proof-of-Work challenge was already used.' };
  }

  const hmacSecret = process.env.ADMIN_API_KEY || process.env.SECRET_KEY || 'retro_pow_fallback_secret';
  const expectedPayload = `${challengeId}:${tsStr}:${diffStr}`;
  const expectedSig = crypto
    .createHmac('sha256', hmacSecret)
    .update(expectedPayload)
    .digest('hex');

  if (signature !== expectedSig) {
    return { valid: false, error: 'Proof-of-Work challenge signature mismatch.' };
  }

  const hash = crypto
    .createHash('sha256')
    .update(`${challengeStr}:${nonce}`)
    .digest('hex');

  const requiredPrefix = '0'.repeat(difficulty);
  if (!hash.startsWith(requiredPrefix)) {
    return { valid: false, error: 'Proof-of-Work solution did not meet required difficulty.' };
  }

  // Mark challenge as spent
  usedChallenges.set(challengeId, timestamp + sec.powTtlSeconds * 1000);
  return { valid: true };
}

/**
 * Verifies a Cloudflare Turnstile token against Cloudflare's siteverify endpoint
 * when Turnstile is active for the current hostname.
 */
async function verifyTurnstileIfActive(req, token) {
  const sec = getSecurityConfig(req);
  if (!sec.turnstileActive) {
    return { valid: true, skipped: true };
  }

  const cleanToken = String(token || '').trim();
  if (!cleanToken) {
    return {
      valid: false,
      error: 'Please complete the Cloudflare Turnstile security check before submitting.'
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', sec.secretKey);
    formData.append('response', cleanToken);
    const clientIp = getClientIp(req);
    if (clientIp && clientIp !== 'unknown') {
      formData.append('remoteip', clientIp);
    }

    const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    const data = await cfRes.json();
    if (!data.success) {
      logger.warn('Cloudflare Turnstile verification failed', {
        ip: clientIp,
        host: sec.reqHost,
        errorCodes: data['error-codes']
      });
      return {
        valid: false,
        error: 'Cloudflare Turnstile verification failed. Please refresh and try again.'
      };
    }

    return { valid: true, skipped: false };
  } catch (err) {
    logger.error('Error menghubungi Cloudflare Turnstile siteverify API', { error: err.message });
    return {
      valid: false,
      error: 'Unable to verify Cloudflare security token at this time.'
    };
  }
}

module.exports = {
  getRequestHostname,
  isLocalOrLanHost,
  getSecurityConfig,
  createPowChallenge,
  verifyPowSolution,
  verifyTurnstileIfActive
};
