const express = require('express');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { Level, AppLog } = require('../models');
const { validateAdminModeration } = require('../services/validator');
const { logger } = require('../utils/logger');
const { getClientIp } = require('../middleware/rateLimiter');

const router = express.Router();

// Protect all admin routes with the static API key middleware
router.use(requireAdminAuth);

/**
 * GET /api/admin/verify
 * Verifies the provided X-Admin-Api-Key and returns summary queue counts.
 */
router.get('/verify', async (req, res) => {
  try {
    const [pendingCount, approvedCount, declinedCount] = await Promise.all([
      Level.count({ where: { status: 'PENDING' } }),
      Level.count({ where: { status: 'APPROVED' } }),
      Level.count({ where: { status: 'DECLINED' } })
    ]);

    logger.info('Admin authenticated and verified session', { ip: getClientIp(req) });
    return res.json({
      authenticated: true,
      counts: {
        PENDING: pendingCount,
        APPROVED: approvedCount,
        DECLINED: declinedCount,
        ALL: pendingCount + approvedCount + declinedCount
      }
    });
  } catch (err) {
    logger.error('Failed to verify admin session', { error: err.message });
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/admin/levels?status=PENDING|APPROVED|DECLINED|ALL
 * Lists levels for the admin moderation queue, ordered newest first.
 */
router.get('/levels', async (req, res) => {
  try {
    const statusFilter = String(req.query.status || 'PENDING').toUpperCase();
    const whereClause = {};
    if (['PENDING', 'APPROVED', 'DECLINED'].includes(statusFilter)) {
      whereClause.status = statusFilter;
    }

    const [levels, pendingCount, approvedCount, declinedCount] = await Promise.all([
      Level.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']]
      }),
      Level.count({ where: { status: 'PENDING' } }),
      Level.count({ where: { status: 'APPROVED' } }),
      Level.count({ where: { status: 'DECLINED' } })
    ]);

    return res.json({
      counts: {
        PENDING: pendingCount,
        APPROVED: approvedCount,
        DECLINED: declinedCount,
        ALL: pendingCount + approvedCount + declinedCount
      },
      levels
    });
  } catch (err) {
    logger.error('Admin failed to fetch levels list', { error: err.message });
    return res.status(500).json({ error: 'Failed to load levels queue.' });
  }
});

/**
 * PATCH /api/admin/levels/:id
 * Allows the admin to edit a level's name, description, or username (e.g., to sanitize NSFW wording),
 * and approve, decline (with a required decline reason), or move back to pending.
 */
router.patch('/levels/:id', async (req, res) => {
  try {
    const levelId = parseInt(req.params.id, 10);
    if (!Number.isFinite(levelId)) {
      return res.status(400).json({ error: 'Invalid level ID.' });
    }

    const level = await Level.findByPk(levelId);
    if (!level) {
      return res.status(404).json({ error: 'Level not found.' });
    }

    const payload = {
      name: req.body?.name !== undefined ? req.body.name : level.name,
      description: req.body?.description !== undefined ? req.body.description : level.description,
      username: req.body?.username !== undefined ? req.body.username : level.username,
      status: req.body?.status !== undefined ? req.body.status : level.status,
      declineReason:
        req.body?.declineReason !== undefined ? req.body.declineReason : level.declineReason
    };

    const { valid, errors, sanitizedModeration } = validateAdminModeration(payload);
    if (!valid) {
      logger.warn('Admin moderation validation failed', { levelId, errors });
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const previousState = {
      name: level.name,
      description: level.description,
      username: level.username,
      status: level.status,
      declineReason: level.declineReason
    };

    level.name = sanitizedModeration.name;
    level.description = sanitizedModeration.description;
    level.username = sanitizedModeration.username;
    level.status = sanitizedModeration.status;
    level.declineReason = sanitizedModeration.declineReason;

    await level.save();

    logger.info('Admin moderated level', {
      levelId: level.id,
      statusToken: level.statusToken,
      previousState,
      newState: sanitizedModeration
    });

    return res.json({
      message: `Level #${level.id} updated (${level.status}).`,
      level
    });
  } catch (err) {
    logger.error('Admin failed to update level', { error: err.message });
    return res.status(500).json({ error: 'Internal server error while updating level.' });
  }
});

/**
 * GET /api/admin/logs
 * Returns the 50 most recent Winston PostgreSQL logs for admin audit visibility.
 */
router.get('/logs', async (req, res) => {
  try {
    const logs = await AppLog.findAll({
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    return res.json({ logs });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load system logs.' });
  }
});

module.exports = router;
