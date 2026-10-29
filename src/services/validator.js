const { PARAMETER_BOUNDS, METADATA_BOUNDS } = require('../config/parameters');

/**
 * Validates and normalizes numerical generation parameters against backend boundaries.
 * Returns { valid: boolean, errors: string[], sanitizedParams: object }
 */
function validateParameters(rawParams = {}) {
  const errors = [];
  const sanitizedParams = {};

  for (const [key, spec] of Object.entries(PARAMETER_BOUNDS)) {
    const rawVal = rawParams[key];
    const valueToUse = rawVal === undefined || rawVal === null || rawVal === '' ? spec.default : Number(rawVal);

    if (!Number.isFinite(valueToUse)) {
      errors.push(`Parameter "${spec.label}" (${key}) must be a valid number.`);
      continue;
    }

    const intVal = Math.round(valueToUse);
    if (intVal < spec.min || intVal > spec.max) {
      errors.push(
        `Parameter "${spec.label}" (${key}) must be between ${spec.min} and ${spec.max} (received ${intVal}).`
      );
      continue;
    }

    sanitizedParams[key] = intVal;
  }

  // Ensure at least one gift weight is > 0 so lucky-dip blocks always have a valid drop table
  if (
    sanitizedParams.giftWeightCoin !== undefined &&
    sanitizedParams.giftWeightExtraLife !== undefined &&
    sanitizedParams.giftWeightInvincibility !== undefined
  ) {
    const totalGiftWeight =
      sanitizedParams.giftWeightCoin +
      sanitizedParams.giftWeightExtraLife +
      sanitizedParams.giftWeightInvincibility;

    if (totalGiftWeight <= 0) {
      errors.push(
        'At least one Lucky-Dip Gift Weight (Coin, Extra Life, or Invincibility) must be greater than 0.'
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedParams
  };
}

/**
 * Validates creator metadata (name, description, optional username, optional country) when submitting a level.
 */
function validateMetadata(rawMeta = {}) {
  const errors = [];
  const name = typeof rawMeta.name === 'string' ? rawMeta.name.trim() : '';
  const description = typeof rawMeta.description === 'string' ? rawMeta.description.trim() : '';
  const rawUsername = typeof rawMeta.username === 'string' ? rawMeta.username.trim() : '';
  const rawCountry = typeof rawMeta.country === 'string' ? rawMeta.country.trim() : '';

  if (name.length < METADATA_BOUNDS.name.minLength || name.length > METADATA_BOUNDS.name.maxLength) {
    errors.push(
      `Level name must be between ${METADATA_BOUNDS.name.minLength} and ${METADATA_BOUNDS.name.maxLength} characters.`
    );
  }

  if (
    description.length < METADATA_BOUNDS.description.minLength ||
    description.length > METADATA_BOUNDS.description.maxLength
  ) {
    errors.push(
      `Level description must be between ${METADATA_BOUNDS.description.minLength} and ${METADATA_BOUNDS.description.maxLength} characters.`
    );
  }

  if (rawUsername.length > METADATA_BOUNDS.username.maxLength) {
    errors.push(`Username cannot exceed ${METADATA_BOUNDS.username.maxLength} characters.`);
  }

  if (rawCountry.length > METADATA_BOUNDS.country.maxLength) {
    errors.push(`Country cannot exceed ${METADATA_BOUNDS.country.maxLength} characters.`);
  }

  const username = rawUsername.length > 0 ? rawUsername : METADATA_BOUNDS.username.default;
  const country = rawCountry.length > 0 ? rawCountry : METADATA_BOUNDS.country.default;

  return {
    valid: errors.length === 0,
    errors,
    sanitizedMeta: {
      name,
      description,
      username,
      country
    }
  };
}

/**
 * Validates an admin moderation update (editing name/description/username for NSFW filtering,
 * and setting status to APPROVED, DECLINED with declineReason, or PENDING).
 */
function validateAdminModeration(rawBody = {}) {
  const errors = [];
  const name = typeof rawBody.name === 'string' ? rawBody.name.trim() : '';
  const description = typeof rawBody.description === 'string' ? rawBody.description.trim() : '';
  const rawUsername = typeof rawBody.username === 'string' ? rawBody.username.trim() : '';
  const status = typeof rawBody.status === 'string' ? rawBody.status.trim().toUpperCase() : '';
  const declineReason =
    typeof rawBody.declineReason === 'string' ? rawBody.declineReason.trim() : '';

  if (name.length < METADATA_BOUNDS.name.minLength || name.length > METADATA_BOUNDS.name.maxLength) {
    errors.push(
      `Level name must be between ${METADATA_BOUNDS.name.minLength} and ${METADATA_BOUNDS.name.maxLength} characters.`
    );
  }

  if (
    description.length < METADATA_BOUNDS.description.minLength ||
    description.length > METADATA_BOUNDS.description.maxLength
  ) {
    errors.push(
      `Level description must be between ${METADATA_BOUNDS.description.minLength} and ${METADATA_BOUNDS.description.maxLength} characters.`
    );
  }

  if (rawUsername.length > METADATA_BOUNDS.username.maxLength) {
    errors.push(`Username cannot exceed ${METADATA_BOUNDS.username.maxLength} characters.`);
  }

  const validStatuses = ['PENDING', 'APPROVED', 'DECLINED'];
  if (!validStatuses.includes(status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}.`);
  }

  if (status === 'DECLINED') {
    if (
      declineReason.length < METADATA_BOUNDS.declineReason.minLength ||
      declineReason.length > METADATA_BOUNDS.declineReason.maxLength
    ) {
      errors.push(
        `Decline reason is required when declining a level (${METADATA_BOUNDS.declineReason.minLength}–${METADATA_BOUNDS.declineReason.maxLength} chars).`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedModeration: {
      name,
      description,
      username: rawUsername.length > 0 ? rawUsername : METADATA_BOUNDS.username.default,
      status,
      declineReason: status === 'DECLINED' ? declineReason : null
    }
  };
}

module.exports = {
  validateParameters,
  validateMetadata,
  validateAdminModeration
};
