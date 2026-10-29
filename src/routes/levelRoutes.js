const express = require('express');
const { Op } = require('sequelize');
const { validateParameters, validateMetadata } = require('../services/validator');
const { generateLevel } = require('../services/levelGenerator');
const { Level } = require('../models');
const { logger } = require('../utils/logger');
const { getClientIp, levelSubmitRateLimiter } = require('../middleware/rateLimiter');
const { verifyPowSolution, verifyTurnstileIfActive } = require('../services/securityService');

const router = express.Router();

/**
 * POST /api/levels/preview
 * Validates parameters against backend boundaries and returns a deterministically
 * generated level layout for the live canvas preview.
 */
router.post('/preview', (req, res) => {
  const { valid, errors, sanitizedParams } = validateParameters(req.body || {});
  if (!valid) {
    logger.warn('Level preview parameter validation failed', { errors, body: req.body });
    return res.status(400).json({ error: 'Invalid level parameters', details: errors });
  }

  const levelData = generateLevel(sanitizedParams);
  return res.json({
    parameters: sanitizedParams,
    levelData
  });
});

/**
 * POST /api/levels
 * Validates both parameters and metadata, generates the authoritative level layout
 * on the backend, saves it to PostgreSQL with status 'PENDING', logs to Postgres via Winston,
 * and returns the unique status link token.
 */
router.post('/', levelSubmitRateLimiter, async (req, res) => {
  try {
    const rawParams = req.body?.parameters || {};
    const rawMeta = req.body?.metadata || {};
    const rawSecurity = req.body?.security || {};

    // 1. Verify Proof-of-Work challenge (if enabled)
    const powResult = verifyPowSolution(req, rawSecurity.powChallenge, rawSecurity.powNonce);
    if (!powResult.valid) {
      logger.warn('Level submission rejected: Proof-of-Work failed', {
        error: powResult.error,
        ip: getClientIp(req)
      });
      return res.status(400).json({ error: powResult.error });
    }

    // 2. Verify Cloudflare Turnstile token (automatically active on production domain, skipped on localhost/LAN or if unconfigured)
    const turnstileResult = await verifyTurnstileIfActive(req, rawSecurity.turnstileToken);
    if (!turnstileResult.valid) {
      return res.status(403).json({ error: turnstileResult.error });
    }

    const paramValidation = validateParameters(rawParams);
    const metaValidation = validateMetadata(rawMeta);

    const allErrors = [...paramValidation.errors, ...metaValidation.errors];
    if (allErrors.length > 0) {
      logger.warn('Level submission validation failed', {
        errors: allErrors,
        ip: getClientIp(req)
      });
      return res.status(400).json({
        error: 'Validation failed',
        details: allErrors
      });
    }

    const levelData = generateLevel(paramValidation.sanitizedParams);

    const createdLevel = await Level.create({
      name: metaValidation.sanitizedMeta.name,
      description: metaValidation.sanitizedMeta.description,
      username: metaValidation.sanitizedMeta.username,
      country: metaValidation.sanitizedMeta.country,
      status: 'PENDING',
      parameters: paramValidation.sanitizedParams,
      levelData
    });

    logger.info('New level submitted for admin approval', {
      levelId: createdLevel.id,
      statusToken: createdLevel.statusToken,
      name: createdLevel.name,
      username: createdLevel.username,
      country: createdLevel.country,
      screens: paramValidation.sanitizedParams.screens,
      paletteIndex: paramValidation.sanitizedParams.paletteIndex,
      ip: getClientIp(req)
    });

    const statusUrl = `/status.html?token=${encodeURIComponent(createdLevel.statusToken)}`;

    return res.status(201).json({
      message: 'Level submitted successfully and queued for admin approval!',
      level: {
        id: createdLevel.id,
        statusToken: createdLevel.statusToken,
        name: createdLevel.name,
        description: createdLevel.description,
        username: createdLevel.username,
        country: createdLevel.country,
        status: createdLevel.status,
        createdAt: createdLevel.createdAt,
        statusUrl
      }
    });
  } catch (err) {
    logger.error('Failed to submit level', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Internal server error while saving level.' });
  }
});

/**
 * GET /api/levels/status/:token
 * Retrieves the approval status, decline reason (if declined), metadata, and level preview
 * for a level creator visiting their unique status link.
 */
router.get('/status/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'Missing status token.' });
    }

    const level = await Level.findOne({ where: { statusToken: token } });
    if (!level) {
      return res.status(404).json({ error: 'Level not found for this status link.' });
    }

    logger.info('Level creator checked submission status', {
      levelId: level.id,
      statusToken: level.statusToken,
      status: level.status
    });

    return res.json({
      level: {
        id: level.id,
        statusToken: level.statusToken,
        name: level.name,
        description: level.description,
        username: level.username,
        country: level.country,
        status: level.status,
        declineReason: level.declineReason,
        parameters: level.parameters,
        levelData: level.levelData,
        createdAt: level.createdAt,
        updatedAt: level.updatedAt
      }
    });
  } catch (err) {
    logger.error('Failed to fetch level status', { error: err.message });
    return res.status(500).json({ error: 'Internal server error while checking level status.' });
  }
});

/**
 * GET /api/levels/playable
 * Public endpoint returning all APPROVED levels with rich filtering & sorting
 * so players can easily browse even when there are hundreds of levels.
 */
router.get('/playable', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const country = String(req.query.country || '').trim();
    const paletteIndex =
      req.query.paletteIndex !== undefined && req.query.paletteIndex !== ''
        ? parseInt(req.query.paletteIndex, 10)
        : null;
    const minScreens =
      req.query.minScreens !== undefined && req.query.minScreens !== ''
        ? parseInt(req.query.minScreens, 10)
        : null;
    const maxScreens =
      req.query.maxScreens !== undefined && req.query.maxScreens !== ''
        ? parseInt(req.query.maxScreens, 10)
        : null;
    const sort = String(req.query.sort || 'newest').toLowerCase();

    const whereClause = { status: 'APPROVED' };

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (country && country !== 'ALL') {
      whereClause.country = country;
    }

    let orderClause = [['createdAt', 'DESC']];
    if (sort === 'oldest') {
      orderClause = [['createdAt', 'ASC']];
    } else if (sort === 'popular') {
      orderClause = [
        ['playsCount', 'DESC'],
        ['createdAt', 'DESC']
      ];
    }

    const approvedLevels = await Level.findAll({
      where: whereClause,
      order: orderClause
    });

    // Apply JSONB parameter filters (paletteIndex, minScreens, maxScreens)
    const filtered = approvedLevels.filter((lvl) => {
      const p = lvl.parameters || {};
      if (Number.isFinite(paletteIndex) && p.paletteIndex !== paletteIndex) {
        return false;
      }
      if (Number.isFinite(minScreens) && (p.screens || 0) < minScreens) {
        return false;
      }
      if (Number.isFinite(maxScreens) && (p.screens || 0) > maxScreens) {
        return false;
      }
      return true;
    });

    const summaries = filtered.map((lvl) => ({
      id: lvl.id,
      name: lvl.name,
      description: lvl.description,
      username: lvl.username,
      country: lvl.country,
      playsCount: lvl.playsCount || 0,
      winsCount: lvl.winsCount || 0,
      parameters: lvl.parameters,
      paletteName: lvl.levelData?.palette?.name || 'Retro',
      paletteColors: lvl.levelData?.palette || null,
      stats: lvl.levelData?.stats || null,
      createdAt: lvl.createdAt
    }));

    return res.json({ levels: summaries });
  } catch (err) {
    logger.error('Failed to fetch playable levels list', { error: err.message });
    return res.status(500).json({ error: 'Failed to load playable levels.' });
  }
});

/**
 * GET /api/levels/playable/:id
 * Loads a single APPROVED level (including its full levelData grid) for gameplay,
 * and increments playsCount.
 */
router.get('/playable/:id', async (req, res) => {
  try {
    const levelId = parseInt(req.params.id, 10);
    if (!Number.isFinite(levelId)) {
      return res.status(400).json({ error: 'Invalid level ID.' });
    }

    const level = await Level.findOne({
      where: { id: levelId, status: 'APPROVED' }
    });

    if (!level) {
      return res.status(404).json({ error: 'Playable level not found or not yet approved.' });
    }

    level.playsCount = (level.playsCount || 0) + 1;
    await level.save();

    return res.json({
      level: {
        id: level.id,
        name: level.name,
        description: level.description,
        username: level.username,
        country: level.country,
        playsCount: level.playsCount,
        winsCount: level.winsCount || 0,
        parameters: level.parameters,
        levelData: level.levelData,
        createdAt: level.createdAt
      }
    });
  } catch (err) {
    logger.error('Failed to load playable level by ID', { error: err.message });
    return res.status(500).json({ error: 'Failed to load level for gameplay.' });
  }
});

/**
 * POST /api/levels/playable/:id/win
 * Increments winsCount when a player reaches the Goal Flagpole.
 */
router.post('/playable/:id/win', async (req, res) => {
  try {
    const levelId = parseInt(req.params.id, 10);
    if (!Number.isFinite(levelId)) {
      return res.status(400).json({ error: 'Invalid level ID.' });
    }

    const level = await Level.findOne({
      where: { id: levelId, status: 'APPROVED' }
    });

    if (!level) {
      return res.status(404).json({ error: 'Level not found.' });
    }

    level.winsCount = (level.winsCount || 0) + 1;
    await level.save();

    return res.json({ winsCount: level.winsCount });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to record win.' });
  }
});

module.exports = router;
