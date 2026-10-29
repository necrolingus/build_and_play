const express = require('express');
const { PALETTES, PARAMETER_BOUNDS, METADATA_BOUNDS, GRID_SPECS } = require('../config/parameters');
const { getSecurityConfig, createPowChallenge } = require('../services/securityService');

const router = express.Router();

/**
 * GET /api/config/parameters
 * Returns all backend-enforced parameter boundaries, defaults, 7 color palettes,
 * metadata validation rules, and active security settings (Turnstile + Proof-of-Work).
 */
router.get('/parameters', (req, res) => {
  const sec = getSecurityConfig(req);
  res.json({
    parameterBounds: PARAMETER_BOUNDS,
    metadataBounds: METADATA_BOUNDS,
    palettes: PALETTES,
    gridSpecs: GRID_SPECS,
    security: {
      turnstileActive: sec.turnstileActive,
      turnstileSiteKey: sec.siteKey,
      powEnabled: sec.powEnabled,
      powDifficulty: sec.powDifficulty
    }
  });
});

/**
 * GET /api/config/pow-challenge
 * Issues a fresh signed Proof-of-Work challenge for level submission.
 */
router.get('/pow-challenge', (req, res) => {
  const challengeData = createPowChallenge(req);
  res.json(challengeData);
});

module.exports = router;
