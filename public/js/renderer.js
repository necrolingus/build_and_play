/**
 * Procedural Retro Pixel-Art Renderer (SNES / GameBoy / NES style)
 * Renders multi-tile textures onto an HTML5 Canvas using the selected 7-color palette.
 */

const SCALE = 2; // 16px native tile * 2 = 32px rendered per tile on canvas

/**
 * Draws a detailed retro pixel-art playable hero character with animated arms & legs!
 * Supports:
 * - scaleMultiplier (1x normal, 2x when Giant 5s Invincibility is active!)
 * - walkCycle (continuous phase for swinging arms and striding legs)
 * - isGrounded (jumps raise one arm and tuck legs)
 * - facing (1 = right, -1 = left)
 * - invincibleTimerMs (flashes rainbow/gold aura when invincible)
 */
export function drawAnimatedHero(ctx, px, py, baseW, baseH, palette, animState = {}) {
  const {
    facing = 1,
    walkFrame = 0,
    isGrounded = true,
    isInvincible = false,
    timeMs = 0
  } = animState;

  ctx.save();

  // Translate to center of character horizontally so we can flip cleanly for left/right facing
  const centerX = px + baseW / 2;
  ctx.translate(centerX, py);
  if (facing < 0) {
    ctx.scale(-1, 1);
  }

  // Coordinate space: 16x16 virtual pixel grid scaled to baseW x baseH
  const ux = baseW / 16;
  const uy = baseH / 16;

  // Invincibility flashing aura
  const flashPhase = Math.floor(timeMs / 70) % 3;
  const auraColors = ['#ffd700', '#00f5d4', '#ff007f'];
  if (isInvincible) {
    ctx.fillStyle = auraColors[flashPhase];
    ctx.fillRect(-9 * ux, -1 * uy, 18 * ux, 18 * uy);
  }

  // Leg & Arm swing offsets based on walkFrame (0..3) or jump pose
  let leftLegY = 12;
  let leftLegX = -5;
  let rightLegY = 12;
  let rightLegX = 1;
  let backArmY = 7;
  let backArmX = -6;
  let frontArmY = 7;
  let frontArmX = 4;

  if (!isGrounded) {
    // Jump pose: front arm raised high, legs split in mid-air stride
    frontArmY = 3;
    frontArmX = 5;
    backArmY = 8;
    backArmX = -7;
    leftLegX = -6;
    leftLegY = 11;
    rightLegX = 2;
    rightLegY = 10;
  } else {
    const step = Math.floor(walkFrame) % 4;
    if (step === 1) {
      // Stride A
      leftLegX = -6;
      leftLegY = 11;
      rightLegX = 2;
      rightLegY = 12;
      frontArmX = 5;
      frontArmY = 6;
      backArmX = -7;
      backArmY = 8;
    } else if (step === 3) {
      // Stride B
      leftLegX = -2;
      leftLegY = 12;
      rightLegX = 4;
      rightLegY = 11;
      frontArmX = 3;
      frontArmY = 8;
      backArmX = -5;
      backArmY = 6;
    }
  }

  const capColor = isInvincible ? auraColors[(flashPhase + 1) % 3] : '#e63946';
  const visorColor = '#00f5d4';
  const skinColor = '#ffcc99';
  const tunicColor = isInvincible ? '#ffffff' : palette.interactPrimary || '#fca044';
  const overallsColor = '#1d3557';
  const bootColor = '#5c2c16';

  // 1. Back Arm (drawn behind torso)
  ctx.fillStyle = tunicColor;
  ctx.fillRect(backArmX * ux, backArmY * uy, 3 * ux, 3 * uy);
  ctx.fillStyle = skinColor; // Back hand
  ctx.fillRect(backArmX * ux, (backArmY + 3) * uy, 3 * ux, 2 * uy);

  // 2. Flowing Scarf / Cape tail
  ctx.fillStyle = capColor;
  ctx.fillRect(-7 * ux, 6 * uy, 3 * ux, 2 * uy);

  // 3. Legs & Boots (animated stride)
  ctx.fillStyle = overallsColor;
  ctx.fillRect(leftLegX * ux, leftLegY * uy, 3 * ux, 2 * uy);
  ctx.fillRect(rightLegX * ux, rightLegY * uy, 3 * ux, 2 * uy);

  ctx.fillStyle = bootColor;
  ctx.fillRect(leftLegX * ux, (leftLegY + 2) * uy, 4 * ux, 2 * uy);
  ctx.fillRect(rightLegX * ux, (rightLegY + 2) * uy, 4 * ux, 2 * uy);

  // 4. Torso & Overalls with Belt Buckle
  ctx.fillStyle = tunicColor;
  ctx.fillRect(-4 * ux, 6 * uy, 8 * ux, 6 * uy);
  ctx.fillStyle = overallsColor;
  ctx.fillRect(-3 * ux, 7 * uy, 6 * ux, 5 * uy);
  ctx.fillRect(-2 * ux, 6 * uy, 1 * ux, 2 * uy);
  ctx.fillRect(1 * ux, 6 * uy, 1 * ux, 2 * uy);
  // Gold belt buckle
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(-1 * ux, 9 * uy, 3 * ux, 2 * uy);

  // 5. Head, Helmet/Cap & Visor
  ctx.fillStyle = skinColor;
  ctx.fillRect(-4 * ux, 2 * uy, 8 * ux, 4 * uy);
  // Cap crown & brim
  ctx.fillStyle = capColor;
  ctx.fillRect(-5 * ux, 0 * uy, 9 * ux, 2 * uy);
  ctx.fillRect(-4 * ux, 2 * uy, 5 * ux, 1 * uy);
  ctx.fillRect(2 * ux, 1 * uy, 4 * ux, 1 * uy); // Forward cap visor brim
  // Eyes / Retro Goggles
  ctx.fillStyle = '#111111';
  ctx.fillRect(1 * ux, 3 * uy, 3 * ux, 2 * uy);
  ctx.fillStyle = visorColor;
  ctx.fillRect(2 * ux, 3 * uy, 2 * ux, 1 * uy);

  // 6. Front Arm (drawn in front of torso)
  ctx.fillStyle = tunicColor;
  ctx.fillRect(frontArmX * ux, frontArmY * uy, 3 * ux, 3 * uy);
  ctx.fillStyle = skinColor; // Front hand
  ctx.fillRect(frontArmX * ux, (frontArmY + 3) * uy, 3 * ux, 2 * uy);

  ctx.restore();
}

/**
 * Draws a single 16x16 brick/ground tile at pixel coordinates (px, py) with size tilePx
 */
export function drawGroundTile(ctx, px, py, tilePx, palette, isTopRow) {
  const u = tilePx / 16; // 1 pixel unit in 16x16 retro space
  ctx.fillStyle = palette.groundPrimary;
  ctx.fillRect(px, py, tilePx, tilePx);

  // Top grass/crust lip on the surface row
  if (isTopRow) {
    ctx.fillStyle = palette.groundSecondary;
    ctx.fillRect(px, py, tilePx, 4 * u);
    ctx.fillStyle = palette.groundBorder;
    ctx.fillRect(px, py, tilePx, 1 * u);
    ctx.fillRect(px, py + 4 * u, tilePx, 1 * u);
  }

  // Retro brick mortar lines
  ctx.fillStyle = palette.groundBorder;
  ctx.fillRect(px, py + 8 * u, tilePx, 1 * u);
  ctx.fillRect(px, py + 15 * u, tilePx, 1 * u);
  ctx.fillRect(px + 7 * u, py + (isTopRow ? 4 * u : 0), 1 * u, 4 * u);
  ctx.fillRect(px + 15 * u, py + 8 * u, 1 * u, 7 * u);

  // Highlight pixels
  ctx.fillStyle = palette.groundSecondary;
  ctx.fillRect(px + 2 * u, py + 10 * u, 3 * u, 2 * u);
  ctx.fillRect(px + 10 * u, py + 6 * u, 3 * u, 1 * u);
}

/**
 * Draws a floating platform segment (width w tiles, height 1 tile)
 */
export function drawPlatformTexture(ctx, px, py, wTiles, tilePx, palette) {
  const totalW = wTiles * tilePx;
  const u = tilePx / 16;

  // Base bevelled platform block
  ctx.fillStyle = palette.platformPrimary;
  ctx.fillRect(px, py, totalW, tilePx);

  // Top highlight bar
  ctx.fillStyle = palette.platformSecondary;
  ctx.fillRect(px + u, py + u, totalW - 2 * u, 4 * u);

  // Crisp pixel border
  ctx.fillStyle = palette.groundBorder;
  ctx.fillRect(px, py, totalW, u);
  ctx.fillRect(px, py + tilePx - u, totalW, u);
  ctx.fillRect(px, py, u, tilePx);
  ctx.fillRect(px + totalW - u, py, u, tilePx);

  // Rivets / Girder joints per tile
  for (let t = 0; t < wTiles; t++) {
    const tx = px + t * tilePx;
    ctx.fillStyle = palette.groundBorder;
    ctx.fillRect(tx + 3 * u, py + 7 * u, 2 * u, 2 * u);
    ctx.fillRect(tx + 11 * u, py + 7 * u, 2 * u, 2 * u);
    if (t > 0) {
      ctx.fillRect(tx, py, u, tilePx);
    }
  }
}

/**
 * Draws an interacting (bumpable) Lucky-Dip Mystery Block (1x1 tile)
 * Uses high-contrast colors + corner rivets + "?" emblem + subtle gift badge
 * When bumped (`isUsed === true`), renders as a darker spent bronze block.
 */
export function drawInteractingBlock(
  ctx,
  px,
  py,
  tilePx,
  palette,
  gift,
  showGiftIcons,
  isUsed = false
) {
  const u = tilePx / 16;

  // Outer contrast frame
  ctx.fillStyle = palette.interactBorder;
  ctx.fillRect(px, py, tilePx, tilePx);

  if (isUsed) {
    // Spent / bumped block appearance
    ctx.fillStyle = palette.platformPrimary;
    ctx.fillRect(px + u, py + u, tilePx - 2 * u, tilePx - 2 * u);
    ctx.fillStyle = palette.groundBorder;
    ctx.fillRect(px + 2 * u, py + 2 * u, u, u);
    ctx.fillRect(px + 13 * u, py + 2 * u, u, u);
    ctx.fillRect(px + 2 * u, py + 13 * u, u, u);
    ctx.fillRect(px + 13 * u, py + 13 * u, u, u);
    return;
  }

  // Glowing inner fill
  ctx.fillStyle = palette.interactPrimary;
  ctx.fillRect(px + u, py + u, tilePx - 2 * u, tilePx - 2 * u);

  // Inner top-left shine
  ctx.fillStyle = palette.interactHighlight;
  ctx.fillRect(px + 2 * u, py + 2 * u, tilePx - 4 * u, 2 * u);
  ctx.fillRect(px + 2 * u, py + 2 * u, 2 * u, tilePx - 4 * u);

  // 4 Corner rivets
  ctx.fillStyle = palette.interactBorder;
  ctx.fillRect(px + 2 * u, py + 2 * u, u, u);
  ctx.fillRect(px + 13 * u, py + 2 * u, u, u);
  ctx.fillRect(px + 2 * u, py + 13 * u, u, u);
  ctx.fillRect(px + 13 * u, py + 13 * u, u, u);

  // Pixel-art '?' question mark in center
  ctx.fillStyle = palette.interactBorder;
  ctx.fillRect(px + 6 * u, py + 4 * u, 5 * u, 2 * u);
  ctx.fillRect(px + 9 * u, py + 6 * u, 2 * u, 2 * u);
  ctx.fillRect(px + 7 * u, py + 8 * u, 3 * u, 2 * u);
  ctx.fillRect(px + 7 * u, py + 11 * u, 2 * u, 2 * u);

  ctx.fillStyle = palette.interactHighlight;
  ctx.fillRect(px + 5 * u, py + 4 * u, 5 * u, u);
  ctx.fillRect(px + 7 * u, py + 11 * u, u, u);

  // Optional creator overlay badge showing which gift was rolled (Coin, 1UP, or 2x Star)
  if (showGiftIcons && gift) {
    const badgeColors = {
      COIN: '#ffd700',
      EXTRA_LIFE: '#00e676',
      INVINCIBILITY: '#ff4081'
    };
    const badgeSymbols = {
      COIN: 'C',
      EXTRA_LIFE: '1UP',
      INVINCIBILITY: '2X'
    };
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(px + u, py - 9, tilePx - 2 * u, 9);
    ctx.fillStyle = badgeColors[gift] || '#ffffff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(badgeSymbols[gift] || '?', px + tilePx / 2, py - 2);
  }
}

/**
 * Draws non-interacting retro clouds (3x2 tiles)
 */
export function drawCloud3x2(ctx, px, py, tilePx, palette) {
  const u = tilePx / 16;
  const w = tilePx * 3;
  const h = tilePx * 2;

  ctx.fillStyle = palette.cloudShade;
  ctx.fillRect(px + 4 * u, py + 10 * u, w - 8 * u, h - 14 * u);

  ctx.fillStyle = palette.cloudColor;
  ctx.fillRect(px + 6 * u, py + 6 * u, w - 12 * u, h - 12 * u);
  ctx.fillRect(px + 12 * u, py + 3 * u, w - 24 * u, h - 10 * u);
}

/**
 * Draws non-interacting bush (2x1 tiles)
 */
export function drawBush2x1(ctx, px, py, tilePx, palette) {
  const u = tilePx / 16;
  const w = tilePx * 2;
  ctx.fillStyle = palette.decorPrimary;
  ctx.fillRect(px + 2 * u, py + 6 * u, w - 4 * u, 10 * u);
  ctx.fillRect(px + 6 * u, py + 3 * u, w - 12 * u, 13 * u);

  ctx.fillStyle = palette.decorSecondary;
  ctx.fillRect(px + 5 * u, py + 6 * u, 4 * u, 3 * u);
  ctx.fillRect(px + 15 * u, py + 5 * u, 5 * u, 3 * u);
  ctx.fillRect(px + 23 * u, py + 7 * u, 3 * u, 3 * u);
}

/**
 * Draws non-interacting grass or 4 distinct vibrant flower types (1x1 tile):
 * - GRASS_1X1: lush multi-blade grass tuft
 * - FLOWER_1X1: Classic Rose/Blossom (flowerColors[0])
 * - FLOWER_TULIP_1X1: Cupped Tulip with wide leaves (flowerColors[1])
 * - FLOWER_DAISY_1X1: Bright Sun-Daisy with radial petals (flowerColors[2])
 * - FLOWER_BELL_1X1: Twin hanging Bellflower/Hyacinth stalks (flowerColors[3])
 */
export function drawFoliage1x1(ctx, px, py, tilePx, palette, foliageType) {
  const u = tilePx / 16;
  const colors = palette.flowerColors || [
    palette.decorSecondary,
    palette.interactPrimary,
    palette.interactHighlight,
    palette.hazardSecondary
  ];

  if (foliageType === 'GRASS_1X1') {
    ctx.fillStyle = palette.decorPrimary;
    ctx.fillRect(px + 7 * u, py + 9 * u, 2 * u, 7 * u);
    ctx.fillRect(px + 3 * u, py + 11 * u, 2 * u, 5 * u);
    ctx.fillRect(px + 11 * u, py + 10 * u, 2 * u, 6 * u);
    ctx.fillStyle = palette.decorSecondary;
    ctx.fillRect(px + 2 * u, py + 9 * u, 2 * u, 3 * u);
    ctx.fillRect(px + 7 * u, py + 7 * u, 2 * u, 3 * u);
    ctx.fillRect(px + 12 * u, py + 8 * u, 2 * u, 3 * u);
    return;
  }

  if (foliageType === 'FLOWER_TULIP_1X1') {
    // Stem & broad leaves
    ctx.fillStyle = palette.decorPrimary;
    ctx.fillRect(px + 7 * u, py + 8 * u, 2 * u, 8 * u);
    ctx.fillRect(px + 4 * u, py + 11 * u, 3 * u, 2 * u);
    ctx.fillRect(px + 9 * u, py + 10 * u, 3 * u, 2 * u);
    // Cupped tulip petals (3 prongs at top)
    ctx.fillStyle = colors[1] || palette.decorSecondary;
    ctx.fillRect(px + 5 * u, py + 4 * u, 6 * u, 5 * u);
    ctx.fillRect(px + 4 * u, py + 2 * u, 2 * u, 4 * u);
    ctx.fillRect(px + 7 * u, py + 2 * u, 2 * u, 3 * u);
    ctx.fillRect(px + 10 * u, py + 2 * u, 2 * u, 4 * u);
    // Inner highlight
    ctx.fillStyle = palette.interactHighlight;
    ctx.fillRect(px + 6 * u, py + 5 * u, 2 * u, 2 * u);
    return;
  }

  if (foliageType === 'FLOWER_DAISY_1X1') {
    // Tall stem & side leaf
    ctx.fillStyle = palette.decorPrimary;
    ctx.fillRect(px + 7 * u, py + 8 * u, 2 * u, 8 * u);
    ctx.fillRect(px + 5 * u, py + 12 * u, 2 * u, 2 * u);
    ctx.fillRect(px + 9 * u, py + 11 * u, 3 * u, 2 * u);
    // Radial petals
    ctx.fillStyle = colors[2] || palette.interactHighlight;
    ctx.fillRect(px + 6 * u, py + 2 * u, 4 * u, 8 * u);
    ctx.fillRect(px + 4 * u, py + 4 * u, 8 * u, 4 * u);
    // Contrasting center disk
    ctx.fillStyle = colors[0] || palette.interactPrimary;
    ctx.fillRect(px + 6 * u, py + 4 * u, 4 * u, 4 * u);
    return;
  }

  if (foliageType === 'FLOWER_BELL_1X1') {
    // Arching twin stalk
    ctx.fillStyle = palette.decorPrimary;
    ctx.fillRect(px + 7 * u, py + 5 * u, 2 * u, 11 * u);
    ctx.fillRect(px + 4 * u, py + 5 * u, 3 * u, 2 * u);
    ctx.fillRect(px + 9 * u, py + 8 * u, 3 * u, 2 * u);
    // Left hanging bell blossom
    ctx.fillStyle = colors[3] || palette.decorSecondary;
    ctx.fillRect(px + 2 * u, py + 6 * u, 4 * u, 4 * u);
    ctx.fillStyle = palette.interactHighlight;
    ctx.fillRect(px + 3 * u, py + 9 * u, 2 * u, 2 * u);
    // Right hanging bell blossom
    ctx.fillStyle = colors[3] || palette.decorSecondary;
    ctx.fillRect(px + 10 * u, py + 9 * u, 4 * u, 4 * u);
    ctx.fillStyle = palette.interactHighlight;
    ctx.fillRect(px + 11 * u, py + 12 * u, 2 * u, 2 * u);
    return;
  }

  // Default: FLOWER_1X1 (Classic Rose / Blossom)
  ctx.fillStyle = palette.decorPrimary;
  ctx.fillRect(px + 7 * u, py + 9 * u, 2 * u, 7 * u);
  ctx.fillRect(px + 4 * u, py + 11 * u, 2 * u, 5 * u);
  ctx.fillRect(px + 10 * u, py + 11 * u, 2 * u, 5 * u);

  ctx.fillStyle = colors[0] || palette.decorSecondary;
  ctx.fillRect(px + 5 * u, py + 4 * u, 6 * u, 6 * u);
  ctx.fillRect(px + 4 * u, py + 5 * u, 8 * u, 4 * u);
  ctx.fillStyle = palette.interactHighlight;
  ctx.fillRect(px + 7 * u, py + 6 * u, 2 * u, 2 * u);
}

/**
 * Draws non-interacting background totem/pillar (1x2 tiles)
 */
export function drawTotem1x2(ctx, px, py, tilePx, palette) {
  const u = tilePx / 16;
  const h = tilePx * 2;
  ctx.fillStyle = palette.decorPrimary;
  ctx.fillRect(px + 3 * u, py + 2 * u, 10 * u, h - 2 * u);
  ctx.fillStyle = palette.decorSecondary;
  ctx.fillRect(px + 2 * u, py + 2 * u, 12 * u, 3 * u);
  ctx.fillRect(px + 5 * u, py + 9 * u, 6 * u, 4 * u);
  ctx.fillRect(px + 5 * u, py + 19 * u, 6 * u, 4 * u);
}

/**
 * Draws hazards:
 * - ENEMY_PATROL_1X1: Patrolling retro enemy
 * - SPIKE_3_SHORT_1X1 (or legacy SPIKE_1X1): 3-pronged spike with radiating danger aura
 * - SPIKE_1_MED_1X1: 1-pronged wide medium-tall spike with radiating danger aura
 * - SPIKE_2_HIGH_GAP_1X1: 2-pronged giant tall spike with gap & radiating danger aura
 */
export function drawHazard1x1(ctx, px, py, tilePx, palette, hazardType, timeMs = 0) {
  const u = tilePx / 16;

  if (hazardType === 'ENEMY_PATROL_1X1') {
    // Subtle menace glow behind enemy
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = palette.hazardPrimary;
    ctx.fillRect(px + 1 * u, py + 2 * u, 14 * u, 13 * u);
    ctx.restore();

    // Retro Goomba/Beetle style patrolling enemy
    ctx.fillStyle = palette.groundBorder;
    ctx.fillRect(px + 2 * u, py + 3 * u, 12 * u, 10 * u);
    ctx.fillStyle = palette.hazardPrimary;
    ctx.fillRect(px + 3 * u, py + 4 * u, 10 * u, 8 * u);
    ctx.fillRect(px + 2 * u, py + 6 * u, 12 * u, 5 * u);
    // Glowing Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 4 * u, py + 6 * u, 2 * u, 3 * u);
    ctx.fillRect(px + 10 * u, py + 6 * u, 2 * u, 3 * u);
    ctx.fillStyle = palette.groundBorder;
    ctx.fillRect(px + 5 * u, py + 7 * u, u, 2 * u);
    ctx.fillRect(px + 10 * u, py + 7 * u, u, 2 * u);
    // Feet
    ctx.fillStyle = palette.groundBorder;
    ctx.fillRect(px + 2 * u, py + 12 * u, 4 * u, 4 * u);
    ctx.fillRect(px + 10 * u, py + 12 * u, 4 * u, 4 * u);
    return;
  }

  // Radiating danger aura rings around all spike types so they stand out unmistakably!
  const pulse = timeMs ? 0.85 + 0.15 * Math.sin(timeMs / 140) : 1;
  ctx.save();
  // Outer wide crimson/neon-red radiation halo
  ctx.globalAlpha = 0.28 * pulse;
  ctx.fillStyle = '#ff1744';
  ctx.fillRect(px - 3 * u, py - 3 * u, 22 * u, 19 * u);

  // Mid amber/yellow energy aura
  ctx.globalAlpha = 0.42 * pulse;
  ctx.fillStyle = '#ffbe0b';
  ctx.fillRect(px - 1 * u, py - 1 * u, 18 * u, 17 * u);
  ctx.restore();

  if (hazardType === 'SPIKE_1_MED_1X1') {
    // 1-prong wide formidable spike (14 units tall, centered, wide base)
    // High-contrast outline
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 2 * u, py + 13 * u, 12 * u, 3 * u);
    ctx.fillRect(px + 4 * u, py + 8 * u, 8 * u, 5 * u);
    ctx.fillRect(px + 6 * u, py + 3 * u, 4 * u, 5 * u);
    ctx.fillRect(px + 7 * u, py + 1 * u, 2 * u, 2 * u);

    // Inner blade fill
    ctx.fillStyle = palette.hazardPrimary;
    ctx.fillRect(px + 3 * u, py + 13 * u, 10 * u, 2 * u);
    ctx.fillRect(px + 5 * u, py + 8 * u, 6 * u, 5 * u);
    ctx.fillRect(px + 7 * u, py + 2 * u, 2 * u, 6 * u);

    // Core hot highlight
    ctx.fillStyle = '#ffeb3b';
    ctx.fillRect(px + 7 * u, py + 3 * u, u, 10 * u);
    return;
  }

  if (hazardType === 'SPIKE_2_HIGH_GAP_1X1') {
    // 2-pronged giant tall spikes (extending 2 units above the tile!) with a clear gap in between
    const prongOffsets = [0, 10]; // Left prong x=0..6, Gap x=6..10, Right prong x=10..16
    for (const ox of prongOffsets) {
      const sx = px + ox * u;
      // White high-contrast silhouette
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, py + 13 * u, 6 * u, 3 * u);
      ctx.fillRect(sx + u, py + 6 * u, 4 * u, 7 * u);
      ctx.fillRect(sx + 2 * u, py - 2 * u, 2 * u, 8 * u);

      // Blade fill
      ctx.fillStyle = palette.hazardPrimary;
      ctx.fillRect(sx + u, py + 13 * u, 4 * u, 2 * u);
      ctx.fillRect(sx + 2 * u, py - 1 * u, 2 * u, 14 * u);

      // Bright core edge
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(sx + 2 * u, py, u, 13 * u);
    }
    return;
  }

  // Default: SPIKE_3_SHORT_1X1 (3-pronged bold spike, now taller & thicker at 11 units tall)
  for (let s = 0; s < 3; s++) {
    const sx = px + s * 5.5 * u;
    // White outer glow edge
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx, py + 12 * u, 5 * u, 4 * u);
    ctx.fillRect(sx + u, py + 7 * u, 3 * u, 5 * u);
    ctx.fillRect(sx + 2 * u, py + 4 * u, u, 3 * u);

    // Primary spike body
    ctx.fillStyle = palette.hazardPrimary;
    ctx.fillRect(sx + u, py + 12 * u, 3 * u, 3 * u);
    ctx.fillRect(sx + 1.5 * u, py + 6 * u, 2 * u, 6 * u);

    // Yellow core shine
    ctx.fillStyle = '#ffeb3b';
    ctx.fillRect(sx + 2 * u, py + 6 * u, u, 7 * u);
  }
}

/**
 * Draws Spawn Character Silhouette & Goal Flagpole
 */
export function drawMarker(ctx, pxOrPlacement, tilePx, palette) {
  const placement = pxOrPlacement;
  const px = placement.x * tilePx;
  const py = placement.y * tilePx;
  const u = tilePx / 16;

  if (placement.type === 'SPAWN_1X1') {
    drawAnimatedHero(ctx, px, py, tilePx, tilePx, palette, {
      facing: 1,
      walkFrame: 1,
      isGrounded: true,
      isInvincible: false
    });

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('START', px + tilePx / 2, py - 4);
  } else if (placement.type === 'GOAL_FLAG_1X4') {
    const h = placement.h * tilePx;
    // Flagpole mast
    ctx.fillStyle = palette.interactHighlight;
    ctx.fillRect(px + 7 * u, py + 2 * u, 2 * u, h - 2 * u);
    // Top orb
    ctx.fillStyle = palette.interactPrimary;
    ctx.fillRect(px + 6 * u, py, 4 * u, 4 * u);
    // Pennant banner
    ctx.fillStyle = palette.hazardPrimary;
    ctx.fillRect(px - 10 * u, py + 4 * u, 17 * u, 10 * u);
    ctx.fillStyle = palette.interactHighlight;
    ctx.fillRect(px - 7 * u, py + 7 * u, 4 * u, 4 * u);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GOAL', px + tilePx / 2, py - 4);
  }
}

/**
 * Main entry point to render a complete generated level onto a Canvas element.
 */
export function renderLevelToCanvas(canvas, levelData, options = {}) {
  if (!canvas || !levelData) return;

  const { showGrid = true, showScreenDividers = true, showGiftIcons = true } = options;
  const { gridSpecs, palette, placements } = levelData;
  const tilePx = gridSpecs.tileSizePx * SCALE; // 32px per tile

  const widthPx = gridSpecs.totalWidthTiles * tilePx;
  const heightPx = gridSpecs.totalHeightTiles * tilePx;

  canvas.width = widthPx;
  canvas.height = heightPx;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // 1. Sky Background Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, heightPx);
  skyGrad.addColorStop(0, palette.sky);
  skyGrad.addColorStop(1, palette.skyGradient);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, widthPx, heightPx);

  // 2. Render Non-Interacting Background Props first (Clouds, Bushes, 4 Flower types, Grass, Totems)
  for (const item of placements) {
    if (item.category !== 'non-interacting') continue;
    const px = item.x * tilePx;
    const py = item.y * tilePx;
    if (item.type === 'CLOUD_3X2') {
      drawCloud3x2(ctx, px, py, tilePx, palette);
    } else if (item.type === 'BUSH_2X1') {
      drawBush2x1(ctx, px, py, tilePx, palette);
    } else if (item.type === 'TOTEM_1X2') {
      drawTotem1x2(ctx, px, py, tilePx, palette);
    } else {
      drawFoliage1x1(ctx, px, py, tilePx, palette, item.type);
    }
  }

  // 3. Render Platforms & Ground Blocks
  for (const item of placements) {
    if (item.category !== 'platform') continue;
    const px = item.x * tilePx;
    const py = item.y * tilePx;

    if (item.type === 'GROUND_2X2' || item.type === 'GROUND_1X2') {
      for (let dy = 0; dy < item.h; dy++) {
        for (let dx = 0; dx < item.w; dx++) {
          drawGroundTile(ctx, px + dx * tilePx, py + dy * tilePx, tilePx, palette, dy === 0);
        }
      }
    } else {
      drawPlatformTexture(ctx, px, py, item.w, tilePx, palette);
    }
  }

  // 4. Render Hazards (3 Spike Types & Patrolling Enemies)
  for (const item of placements) {
    if (item.category !== 'hazard') continue;
    drawHazard1x1(ctx, item.x * tilePx, item.y * tilePx, tilePx, palette, item.type);
  }

  // 5. Render Interacting (Bumpable Lucky-Dip) Blocks
  for (const item of placements) {
    if (item.category !== 'interacting') continue;
    drawInteractingBlock(
      ctx,
      item.x * tilePx,
      item.y * tilePx,
      tilePx,
      palette,
      item.gift,
      showGiftIcons
    );
  }

  // 6. Render Spawn & Goal Markers
  for (const item of placements) {
    if (item.category !== 'marker') continue;
    drawMarker(ctx, item, tilePx, palette);
  }

  // 7. Optional Tile Grid Overlay
  if (showGrid) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= gridSpecs.totalWidthTiles; x++) {
      ctx.beginPath();
      ctx.moveTo(x * tilePx + 0.5, 0);
      ctx.lineTo(x * tilePx + 0.5, heightPx);
      ctx.stroke();
    }
    for (let y = 0; y <= gridSpecs.totalHeightTiles; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * tilePx + 0.5);
      ctx.lineTo(widthPx, y * tilePx + 0.5);
      ctx.stroke();
    }
  }

  // 8. Optional Screen Boundary Dividers
  if (showScreenDividers) {
    const screenW = gridSpecs.screenWidthTiles * tilePx;
    ctx.strokeStyle = 'rgba(255, 235, 59, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    for (let s = 1; s < gridSpecs.screens; s++) {
      const sx = s * screenW;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, heightPx);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(sx + 6, 8, 72, 18);
      ctx.fillStyle = '#ffeb3b';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SCREEN ${s + 1}`, sx + 12, 20);
    }
    ctx.setLineDash([]);
  }
}
