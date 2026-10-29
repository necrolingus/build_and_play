/**
 * Central source of truth for all Level Creator parameter boundaries,
 * defaults, and metadata constraints.
 * Controlled and enforced by the backend, and served to the frontend
 * so all UI sliders dynamically respect these exact limits.
 */

const PALETTES = [
  {
    id: 0,
    name: 'NES Overworld',
    sky: '#5c94fc',
    skyGradient: '#8cb8fc',
    groundPrimary: '#c84c0c',
    groundSecondary: '#fc9838',
    groundBorder: '#000000',
    platformPrimary: '#887000',
    platformSecondary: '#fca044',
    decorPrimary: '#00a800',
    decorSecondary: '#b8f818',
    flowerColors: ['#ff3b30', '#ff6bcb', '#ffd60a', '#32ade6'],
    cloudColor: '#fcfcfc',
    cloudShade: '#a4e4fc',
    interactPrimary: '#fc9838',
    interactHighlight: '#fcfcfc',
    interactBorder: '#000000',
    hazardPrimary: '#d82800',
    hazardSecondary: '#fcfcfc'
  },
  {
    id: 1,
    name: 'GameBoy Classic',
    sky: '#9bbc0f',
    skyGradient: '#8bac0f',
    groundPrimary: '#306230',
    groundSecondary: '#8bac0f',
    groundBorder: '#0f380f',
    platformPrimary: '#0f380f',
    platformSecondary: '#306230',
    decorPrimary: '#306230',
    decorSecondary: '#0f380f',
    flowerColors: ['#0f380f', '#306230', '#4a7a1e', '#1f521f'],
    cloudColor: '#8bac0f',
    cloudShade: '#306230',
    interactPrimary: '#0f380f',
    interactHighlight: '#9bbc0f',
    interactBorder: '#0f380f',
    hazardPrimary: '#0f380f',
    hazardSecondary: '#9bbc0f'
  },
  {
    id: 2,
    name: 'SNES Sunset',
    sky: '#2b1055',
    skyGradient: '#d96b43',
    groundPrimary: '#4a154b',
    groundSecondary: '#a33b61',
    groundBorder: '#160420',
    platformPrimary: '#7a2048',
    platformSecondary: '#e87a5d',
    decorPrimary: '#2a9d8f',
    decorSecondary: '#f9c784',
    flowerColors: ['#ffbe0b', '#ff006e', '#00f5d4', '#fb5607'],
    cloudColor: '#f7a072',
    cloudShade: '#a33b61',
    interactPrimary: '#ffd166',
    interactHighlight: '#ffffff',
    interactBorder: '#160420',
    hazardPrimary: '#ff2a54',
    hazardSecondary: '#ffd166'
  },
  {
    id: 3,
    name: 'Cyber Neon',
    sky: '#0b0914',
    skyGradient: '#1a1438',
    groundPrimary: '#191233',
    groundSecondary: '#00f5d4',
    groundBorder: '#05020a',
    platformPrimary: '#3a0ca3',
    platformSecondary: '#f72585',
    decorPrimary: '#00bbf9',
    decorSecondary: '#4cc9f0',
    flowerColors: ['#ff007f', '#00f5d4', '#fee440', '#b5179e'],
    cloudColor: '#3a0ca3',
    cloudShade: '#f72585',
    interactPrimary: '#fee440',
    interactHighlight: '#ffffff',
    interactBorder: '#f72585',
    hazardPrimary: '#ff0055',
    hazardSecondary: '#00f5d4'
  },
  {
    id: 4,
    name: 'Autumn Harvest',
    sky: '#f4e8c1',
    skyGradient: '#e0c097',
    groundPrimary: '#5c2c16',
    groundSecondary: '#b85d19',
    groundBorder: '#2a1105',
    platformPrimary: '#8c3b1b',
    platformSecondary: '#e28743',
    decorPrimary: '#588157',
    decorSecondary: '#eab676',
    flowerColors: ['#d62828', '#f77f00', '#9b5de5', '#fcbf49'],
    cloudColor: '#ffffff',
    cloudShade: '#e0c097',
    interactPrimary: '#ffcc00',
    interactHighlight: '#fffbe6',
    interactBorder: '#2a1105',
    hazardPrimary: '#990000',
    hazardSecondary: '#ffcc00'
  },
  {
    id: 5,
    name: 'Ice Cavern',
    sky: '#0d1b2a',
    skyGradient: '#1b263b',
    groundPrimary: '#415a77',
    groundSecondary: '#a9d6e5',
    groundBorder: '#081018',
    platformPrimary: '#2c7da0',
    platformSecondary: '#89c2d9',
    decorPrimary: '#61a5c2',
    decorSecondary: '#caf0f8',
    flowerColors: ['#ff758f', '#ffd166', '#c77dff', '#72efdd'],
    cloudColor: '#caf0f8',
    cloudShade: '#415a77',
    interactPrimary: '#ffb703',
    interactHighlight: '#ffffff',
    interactBorder: '#081018',
    hazardPrimary: '#e63946',
    hazardSecondary: '#caf0f8'
  },
  {
    id: 6,
    name: 'Volcanic Fortress',
    sky: '#1a090d',
    skyGradient: '#4a121a',
    groundPrimary: '#2b2d42',
    groundSecondary: '#6c757d',
    groundBorder: '#0b090a',
    platformPrimary: '#540b0e',
    platformSecondary: '#9e2a2b',
    decorPrimary: '#e09f3e',
    decorSecondary: '#ff4d00',
    flowerColors: ['#00f5d4', '#ffbe0b', '#ff006e', '#80ed99'],
    cloudColor: '#495057',
    cloudShade: '#212529',
    interactPrimary: '#ffbe0b',
    interactHighlight: '#ffffff',
    interactBorder: '#0b090a',
    hazardPrimary: '#ff5400',
    hazardSecondary: '#ffbe0b'
  }
];

const PARAMETER_BOUNDS = {
  screens: {
    label: 'Level Length (Screens)',
    description: 'Number of horizontal 20x15 tile screens in the level.',
    type: 'integer',
    min: 2,
    max: 12,
    default: 4,
    step: 1,
    unit: 'screens',
    category: 'World Structure'
  },
  paletteIndex: {
    label: 'Color Palette',
    description: 'Retro color palette applied to sky, terrain, props, and interactive blocks.',
    type: 'integer',
    min: 0,
    max: 6,
    default: 0,
    step: 1,
    unit: 'palette',
    category: 'Hidden'
  },
  platformDensity: {
    label: 'Platform Density',
    description: 'How many elevated jumpable platforms are placed across the level.',
    type: 'integer',
    min: 15,
    max: 90,
    default: 50,
    step: 5,
    unit: '%',
    category: 'World Structure'
  },
  gapFrequency: {
    label: 'Ground Gap Frequency',
    description: 'Percentage of ground pits (always capped to jumpable widths).',
    type: 'integer',
    min: 0,
    max: 45,
    default: 15,
    step: 5,
    unit: '%',
    category: 'World Structure'
  },
  groundElevation: {
    label: 'Ground Height Variation',
    description: 'How hilly/stepped the ground terrain is (0 = completely flat, 4 = high hills & cliffs).',
    type: 'integer',
    min: 0,
    max: 4,
    default: 2,
    step: 1,
    unit: 'tiles',
    category: 'World Structure'
  },
  verticality: {
    label: 'Elevation & Verticality',
    description: 'How high into the sky platform tiers can climb.',
    type: 'integer',
    min: 1,
    max: 10,
    default: 6,
    step: 1,
    unit: 'tier',
    category: 'World Structure'
  },
  interactingCount: {
    label: 'Bumpable Lucky-Dip Blocks',
    description: 'Total interactive Mystery Blocks guaranteed to be reachable by the player.',
    type: 'integer',
    min: 1,
    max: 35,
    default: 10,
    step: 1,
    unit: 'blocks',
    category: 'Interactive & Gifts'
  },
  giftWeightCoin: {
    label: 'Gift Weight: Coin',
    description: 'Relative chance that bumping an interactive block awards a Coin.',
    type: 'integer',
    min: 0,
    max: 100,
    default: 65,
    step: 5,
    unit: 'weight',
    category: 'Interactive & Gifts'
  },
  giftWeightExtraLife: {
    label: 'Gift Weight: Extra Life (1-UP)',
    description: 'Relative chance that bumping an interactive block awards an Extra Life.',
    type: 'integer',
    min: 0,
    max: 100,
    default: 20,
    step: 5,
    unit: 'weight',
    category: 'Interactive & Gifts'
  },
  giftWeightInvincibility: {
    label: 'Gift Weight: 5s Giant Invincibility',
    description: 'Relative chance of 5-second Invincibility (character doubles in size).',
    type: 'integer',
    min: 0,
    max: 100,
    default: 15,
    step: 5,
    unit: 'weight',
    category: 'Interactive & Gifts'
  },
  startingLives: {
    label: 'Starting Player Lives',
    description: 'How many lives the player starts with when playing this level (1 to 5).',
    type: 'integer',
    min: 1,
    max: 5,
    default: 3,
    step: 1,
    unit: 'lives',
    category: 'Challenge & Aesthetics'
  },
  hazardDensity: {
    label: 'Spike & Enemy Density',
    description: 'Frequency of ground spikes and patrolling retro enemies.',
    type: 'integer',
    min: 0,
    max: 100,
    default: 45,
    step: 5,
    unit: '%',
    category: 'Challenge & Aesthetics'
  },
  decorDensity: {
    label: 'Scenery & Prop Density',
    description: 'Non-interacting clouds, grass tufts, flowers, and bushes for retro charm.',
    type: 'integer',
    min: 0,
    max: 100,
    default: 60,
    step: 5,
    unit: '%',
    category: 'Challenge & Aesthetics'
  },
  seed: {
    label: 'Generation Seed',
    description: 'Deterministic seed number used to build the level layout.',
    type: 'integer',
    min: 1,
    max: 999999999,
    default: 123456,
    step: 1,
    unit: 'seed',
    category: 'Hidden'
  }
};

const METADATA_BOUNDS = {
  name: {
    minLength: 3,
    maxLength: 40
  },
  description: {
    minLength: 3,
    maxLength: 200
  },
  username: {
    minLength: 0,
    maxLength: 30,
    default: 'Anonymous'
  },
  country: {
    minLength: 0,
    maxLength: 60,
    default: 'Unspecified'
  },
  declineReason: {
    minLength: 3,
    maxLength: 250
  }
};

const GRID_SPECS = {
  tileSizePx: 16,
  screenWidthTiles: 20,
  screenHeightTiles: 15,
  groundRow: 13, // Rows 13 and 14 (0-indexed) form the 2-tile-deep ground floor
  maxJumpHeightTiles: 3.5,
  maxJumpWidthTiles: 4.5
};

module.exports = {
  PALETTES,
  PARAMETER_BOUNDS,
  METADATA_BOUNDS,
  GRID_SPECS
};
