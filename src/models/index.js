const Level = require('./Level');
const AppLog = require('./AppLog');
const { sequelize, ensureDatabaseExists } = require('../config/database');
const { validateParameters } = require('../services/validator');
const { generateLevel } = require('../services/levelGenerator');

async function seedStarterLevelsIfEmpty() {
  const approvedCount = await Level.count({ where: { status: 'APPROVED' } });
  if (approvedCount > 0) return;

  const starterConfigs = [
    {
      name: 'Mushroom Kingdom Hills',
      description: 'Classic NES Overworld warm-up with rolling ground hills, plenty of coins, and gentle jumps.',
      username: 'EngineBuilder',
      country: 'South Africa',
      params: {
        screens: 4,
        paletteIndex: 0,
        platformDensity: 50,
        gapFrequency: 15,
        groundElevation: 2,
        verticality: 5,
        interactingCount: 12,
        giftWeightCoin: 65,
        giftWeightExtraLife: 20,
        giftWeightInvincibility: 15,
        hazardDensity: 20,
        decorDensity: 75,
        seed: 101010
      }
    },
    {
      name: 'Sunset Sky Citadel',
      description: 'High-altitude SNES Sunset platforming with rich lucky-dip invincibility stars and patrolling beetles.',
      username: 'PixelMaster',
      country: 'Japan',
      params: {
        screens: 5,
        paletteIndex: 2,
        platformDensity: 65,
        gapFrequency: 25,
        groundElevation: 3,
        verticality: 8,
        interactingCount: 16,
        giftWeightCoin: 50,
        giftWeightExtraLife: 25,
        giftWeightInvincibility: 25,
        hazardDensity: 30,
        decorDensity: 80,
        seed: 202602
      }
    },
    {
      name: 'Neon Cyber Grid',
      description: 'Fast-paced Cyber Neon gauntlet across 6 screens with high spikes and generous 1-UP drops.',
      username: 'SynthRunner',
      country: 'United States',
      params: {
        screens: 6,
        paletteIndex: 3,
        platformDensity: 60,
        gapFrequency: 20,
        groundElevation: 2,
        verticality: 7,
        interactingCount: 18,
        giftWeightCoin: 55,
        giftWeightExtraLife: 25,
        giftWeightInvincibility: 20,
        hazardDensity: 35,
        decorDensity: 65,
        seed: 808303
      }
    }
  ];

  for (const item of starterConfigs) {
    const { sanitizedParams } = validateParameters(item.params);
    const levelData = generateLevel(sanitizedParams);
    await Level.create({
      name: item.name,
      description: item.description,
      username: item.username,
      country: item.country,
      status: 'APPROVED',
      parameters: sanitizedParams,
      levelData
    });
  }
  console.log('[Database] Seeded 3 starter APPROVED levels for immediate gameplay.');
}

async function initDatabase() {
  await ensureDatabaseExists();
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  await seedStarterLevelsIfEmpty();
}

module.exports = {
  sequelize,
  initDatabase,
  Level,
  AppLog
};
