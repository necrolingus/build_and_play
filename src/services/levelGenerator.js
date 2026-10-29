const { GRID_SPECS, PALETTES } = require('../config/parameters');

/**
 * Deterministic PRNG (Mulberry32) so a given seed + parameter set
 * always produces the exact same level on both preview and submission.
 */
function createRng(seed) {
  let state = (Number(seed) || 123456) >>> 0;
  return function nextRandom() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a complete, reachability-verified 2D platformer level from validated parameters.
 */
function generateLevel(params) {
  const rng = createRng(params.seed);

  const totalWidth = params.screens * GRID_SPECS.screenWidthTiles;
  const totalHeight = GRID_SPECS.screenHeightTiles;
  const baseGroundRow = GRID_SPECS.groundRow; // 13 (so rows 13 & 14 are base ground)
  const maxGroundElev = Math.max(0, Math.min(4, Number(params.groundElevation ?? 2)));

  // Occupancy grid for collision & placement checks:
  // null = empty, 'GROUND', 'PLATFORM', 'INTERACT', 'HAZARD', 'RESERVED'
  const grid = Array.from({ length: totalHeight }, () =>
    Array.from({ length: totalWidth }, () => null)
  );

  const placements = []; // List of multi-tile or 1x1 texture objects

  // 1. Generate Ground with Jumpable Gaps & Stepped Height Elevation
  // Safe zones: first 6 columns (spawn) and last 6 columns (goal flagpole) are flat baseGroundRow with no pits
  const groundTopAtCol = Array(totalWidth).fill(baseGroundRow);

  // First, carve out jumpable gaps
  let col = 6;
  while (col < totalWidth - 7) {
    const roll = rng() * 100;
    if (roll < params.gapFrequency) {
      // Gap width of 2 or 3 tiles (max jump width is 4.5 tiles, so 2-3 is always jumpable)
      const gapWidth = rng() < 0.65 ? 2 : 3;
      for (let g = 0; g < gapWidth && col + g < totalWidth - 7; g++) {
        groundTopAtCol[col + g] = null;
      }
      // Require at least 4 solid ground tiles after a pit before another pit can start
      col += gapWidth + 4;
    } else {
      col += 1;
    }
  }

  // Next, apply stepped ground elevation (hills / terraces) across contiguous ground segments
  if (maxGroundElev > 0) {
    let x = 6;
    let currentElev = 0;
    while (x < totalWidth - 7) {
      if (groundTopAtCol[x] === null) {
        // After a pit, start at elevation 0 or 1 so any jump across the pit is always jumpable
        currentElev = maxGroundElev >= 1 && rng() < 0.35 ? 1 : 0;
        // Skip the entire pit so currentElev is only set once per pit!
        while (x < totalWidth - 7 && groundTopAtCol[x] === null) {
          x++;
        }
        continue;
      }

      // Determine how many contiguous solid ground columns remain before a pit or goal zone
      let runLimit = 0;
      while (x + runLimit < totalWidth - 7 && groundTopAtCol[x + runLimit] !== null) {
        runLimit++;
      }

      // Choose a terrace width (2 to 5 tiles)
      const segLen = Math.min(runLimit, Math.floor(rng() * 4) + 2);
      const isLastBeforePitOrGoal = segLen === runLimit;

      // Step elevation up or down by at most 2 tiles from currentElev
      // AND ensure we can step back down to <= 1 before the next pit/goal!
      const remainingColsAfter = runLimit - segLen;
      const minStepsAfter = Math.floor(remainingColsAfter / 5);
      const maxReachableDownTo1 = isLastBeforePitOrGoal ? 1 : 1 + minStepsAfter * 2;

      const minNextElev = Math.max(0, currentElev - 2);
      const maxNextElev = Math.min(maxGroundElev, currentElev + 2, maxReachableDownTo1);

      if (maxNextElev <= minNextElev) {
        currentElev = minNextElev;
      } else {
        currentElev = minNextElev + Math.floor(rng() * (maxNextElev - minNextElev + 1));
      }

      const topRow = baseGroundRow - currentElev;
      for (let k = 0; k < segLen; k++) {
        groundTopAtCol[x + k] = topRow;
      }
      x += segLen;
    }

    // Forward & backward smoothing pass over groundTopAtCol to guarantee:
    // 1. Any adjacent ground columns differ in height by at most 2 tiles
    // 2. Any ground column adjacent to a pit (or spawn/goal boundary) is at most 1 tile above baseGroundRow
    for (let i = 0; i < totalWidth; i++) {
      if (groundTopAtCol[i] === null) continue;
      const leftIsPit = i > 0 && groundTopAtCol[i - 1] === null;
      const rightIsPit = i + 1 < totalWidth && groundTopAtCol[i + 1] === null;
      if (leftIsPit || rightIsPit) {
        groundTopAtCol[i] = Math.max(groundTopAtCol[i], baseGroundRow - 1);
      }
    }
    // Forward pass: groundTopAtCol[i] cannot be more than 2 tiles higher or lower than groundTopAtCol[i-1]
    for (let i = 1; i < totalWidth; i++) {
      if (groundTopAtCol[i] !== null && groundTopAtCol[i - 1] !== null) {
        if (groundTopAtCol[i] < groundTopAtCol[i - 1] - 2) {
          groundTopAtCol[i] = groundTopAtCol[i - 1] - 2;
        } else if (groundTopAtCol[i] > groundTopAtCol[i - 1] + 2) {
          groundTopAtCol[i] = groundTopAtCol[i - 1] + 2;
        }
      }
    }
    // Backward pass: groundTopAtCol[i] cannot be more than 2 tiles higher or lower than groundTopAtCol[i+1]
    for (let i = totalWidth - 2; i >= 0; i--) {
      if (groundTopAtCol[i] !== null && groundTopAtCol[i + 1] !== null) {
        if (groundTopAtCol[i] < groundTopAtCol[i + 1] - 2) {
          groundTopAtCol[i] = groundTopAtCol[i + 1] - 2;
        } else if (groundTopAtCol[i] > groundTopAtCol[i + 1] + 2) {
          groundTopAtCol[i] = groundTopAtCol[i + 1] + 2;
        }
      }
    }
  }

  // Place ground textures and build standableSurfaces for each contiguous flat ground terrace
  const standableSurfaces = [];
  let c = 0;
  while (c < totalWidth) {
    const topY = groundTopAtCol[c];
    if (topY === null) {
      c++;
      continue;
    }

    // Find contiguous columns with the exact same topY
    let terraceWidth = 1;
    while (c + terraceWidth < totalWidth && groundTopAtCol[c + terraceWidth] === topY) {
      terraceWidth++;
    }

    standableSurfaces.push({
      x: c,
      w: terraceWidth,
      y: topY,
      isGround: true
    });

    const h = totalHeight - topY;
    // Tile the terrace using 2-wide blocks where possible, and 1-wide for odd remainder
    let tx = c;
    while (tx < c + terraceWidth) {
      const blockW = tx + 1 < c + terraceWidth ? 2 : 1;
      placements.push({
        type: blockW === 2 ? 'GROUND_2X2' : 'GROUND_1X2',
        category: 'platform',
        x: tx,
        y: topY,
        w: blockW,
        h
      });
      for (let ry = topY; ry < totalHeight; ry++) {
        for (let rx = tx; rx < tx + blockW; rx++) {
          grid[ry][rx] = 'GROUND';
        }
      }
      tx += blockW;
    }

    c += terraceWidth;
  }

  // Helper: Can a player jump from surface A to surface B?
  function canJumpBetween(surfA, surfB) {
    // Vertical difference: positive means surfB is higher (smaller y index) than surfA
    const heightGain = surfA.y - surfB.y;
    if (heightGain > 3) {
      // Max vertical jump is 3 tiles up
      return false;
    }

    // Horizontal distance between intervals [surfA.x, surfA.x + surfA.w - 1] and [surfB.x, surfB.x + surfB.w - 1]
    const leftA = surfA.x;
    const rightA = surfA.x + surfA.w - 1;
    const leftB = surfB.x;
    const rightB = surfB.x + surfB.w - 1;

    let horizGap = 0;
    if (rightA < leftB) {
      horizGap = leftB - rightA - 1;
    } else if (rightB < leftA) {
      horizGap = leftA - rightB - 1;
    } else {
      horizGap = 0; // Vertically overlapping horizontally
    }

    // If overlapping horizontally and B is directly above A, player needs a 1-tile side step unless B is narrower or offset
    if (horizGap === 0 && heightGain > 0) {
      const fullyCovers = leftB <= leftA && rightB >= rightA;
      if (fullyCovers) return false;
    }

    // Max horizontal jump gap depends slightly on height gain
    const maxHorizGap = heightGain >= 3 ? 2 : heightGain === 2 ? 3 : 4;
    return horizGap <= maxHorizGap;
  }

  // Helper: Check if region [x..x+w-1, y..y+h-1] plus buffer is free
  function isRegionFree(x, y, w, h, padX = 0, padY = 0) {
    for (let ry = y - padY; ry < y + h + padY; ry++) {
      for (let rx = x - padX; rx < x + w + padX; rx++) {
        if (rx < 0 || rx >= totalWidth || ry < 0 || ry >= totalHeight) return false;
        if (grid[ry][rx] !== null) return false;
      }
    }
    return true;
  }

  // 2. Generate Reachable Elevated Platforms
  // Highest allowed row depends on verticality parameter (1..10):
  const minAllowedRow = Math.max(3, baseGroundRow - 2 - Math.round(params.verticality * 0.8));
  const targetPlatformCount = Math.max(
    params.screens,
    Math.round((params.screens * params.platformDensity) / 15)
  );

  // Build platforms in tiers from bottom to top so higher platforms can chain off lower platforms
  let placedPlatforms = 0;
  let attempts = 0;
  const maxAttempts = targetPlatformCount * 25;

  while (placedPlatforms < targetPlatformCount && attempts < maxAttempts) {
    attempts++;
    // Pick an existing reachable surface to branch from
    const baseSurf = standableSurfaces[Math.floor(rng() * standableSurfaces.length)];
    const stepUp = rng() < 0.75 ? (rng() < 0.5 ? 2 : 3) : 1;
    const candY = baseSurf.y - stepUp;
    if (candY < minAllowedRow || candY >= baseGroundRow - 1) continue;

    const platWidth = rng() < 0.35 ? 2 : rng() < 0.75 ? 3 : 4;
    const direction = rng() < 0.5 ? -1 : 1;
    const offset = Math.floor(rng() * 4) + 1;
    const candX =
      direction > 0
        ? baseSurf.x + Math.floor(rng() * baseSurf.w) + offset
        : baseSurf.x - platWidth - offset + 1;

    // Keep platforms away from spawn (x < 3) and goal flagpole (x > totalWidth - 5)
    if (candX < 3 || candX + platWidth > totalWidth - 5) continue;

    // Must have clear space around it (1 tile horizontal pad, 2 tiles vertical pad so player can stand & jump)
    if (!isRegionFree(candX, candY, platWidth, 1, 1, 2)) continue;

    const candidateSurf = { x: candX, w: platWidth, y: candY, isGround: false };
    if (!canJumpBetween(baseSurf, candidateSurf)) continue;

    // Commit platform
    for (let px = candX; px < candX + platWidth; px++) {
      grid[candY][px] = 'PLATFORM';
    }
    standableSurfaces.push(candidateSurf);
    placements.push({
      type: `PLATFORM_${platWidth}X1`,
      category: 'platform',
      x: candX,
      y: candY,
      w: platWidth,
      h: 1
    });
    placedPlatforms++;
  }

  // 3. Place Interacting (Bumpable Lucky-Dip) Blocks
  const giftWeights = {
    COIN: params.giftWeightCoin,
    EXTRA_LIFE: params.giftWeightExtraLife,
    INVINCIBILITY: params.giftWeightInvincibility
  };
  const totalWeight = giftWeights.COIN + giftWeights.EXTRA_LIFE + giftWeights.INVINCIBILITY;

  function pickLuckyDipGift() {
    const roll = rng() * totalWeight;
    if (roll < giftWeights.COIN) return 'COIN';
    if (roll < giftWeights.COIN + giftWeights.EXTRA_LIFE) return 'EXTRA_LIFE';
    return 'INVINCIBILITY';
  }

  let placedInteracting = 0;
  let interactAttempts = 0;
  const maxInteractAttempts = params.interactingCount * 45;

  while (placedInteracting < params.interactingCount && interactAttempts < maxInteractAttempts) {
    interactAttempts++;
    const surf = standableSurfaces[Math.floor(rng() * standableSurfaces.length)];
    const bx = surf.x + Math.floor(rng() * surf.w);
    const heightAbove = rng() < 0.75 ? 3 : 2;
    const by = surf.y - heightAbove;

    if (bx < 3 || bx >= totalWidth - 5 || by < 2 || by >= baseGroundRow) continue;
    if (grid[by][bx] !== null) continue;

    // Prevent vertical stacking of lucky blocks and guarantee a 2-tile vertical jump clearance underneath
    if (grid[by - 1]?.[bx] !== null) continue;
    if (grid[by + 1]?.[bx] !== null) continue;
    if (by + 2 < surf.y && grid[by + 2]?.[bx] !== null) continue;

    // Limit horizontal runs of adjacent lucky blocks to at most 2 in a row
    const left1 = grid[by]?.[bx - 1] === 'INTERACT';
    const left2 = grid[by]?.[bx - 2] === 'INTERACT';
    const right1 = grid[by]?.[bx + 1] === 'INTERACT';
    const right2 = grid[by]?.[bx + 2] === 'INTERACT';
    if ((left1 && left2) || (right1 && right2) || (left1 && right1)) continue;

    const bottomFree = by + 1 < totalHeight && grid[by + 1][bx] === null;
    const topFree = by - 1 >= 0 && grid[by - 1][bx] === null;
    const leftFree = bx - 1 >= 0 && grid[by][bx - 1] === null;
    const rightFree = bx + 1 < totalWidth && grid[by][bx + 1] === null;

    grid[by][bx] = 'INTERACT';
    const giftType = pickLuckyDipGift();
    placements.push({
      type: 'LUCKY_BLOCK_1X1',
      category: 'interacting',
      gift: giftType,
      bumpableSides: {
        bottom: bottomFree,
        top: topFree,
        left: leftFree,
        right: rightFree
      },
      x: bx,
      y: by,
      w: 1,
      h: 1
    });
    placedInteracting++;
  }

  // 4. Place Hazards (3 Spike Types & Patrolling Enemies) according to hazardDensity
  // Spike Types:
  // - SPIKE_3_SHORT_1X1: 3-pronged short spike
  // - SPIKE_1_MED_1X1: 1-pronged medium spike
  // - SPIKE_2_HIGH_GAP_1X1: 2-pronged high spike with a gap in-between
  const SPIKE_TYPES = ['SPIKE_3_SHORT_1X1', 'SPIKE_1_MED_1X1', 'SPIKE_2_HIGH_GAP_1X1'];

  if (params.hazardDensity > 0) {
    for (const surf of standableSurfaces) {
      if (surf.w < 2) continue;
      for (let hx = surf.x; hx < surf.x + surf.w; hx++) {
        // Keep spawn area (first 5 columns) and goal flagpole area (last 5 columns) safe
        if (hx < 5 || hx > totalWidth - 6) continue;

        // If on ground, keep 1 tile adjacent to actual bottomless pits free so players can always jump across
        if (surf.isGround) {
          const leftIsPit = hx - 1 >= 0 && groundTopAtCol[hx - 1] === null;
          const rightIsPit = hx + 1 < totalWidth && groundTopAtCol[hx + 1] === null;
          if (leftIsPit || rightIsPit) continue;
        } else {
          // On floating platforms, leave at least 1 safe landing tile on the platform for spikes
          if (surf.w === 2 && hx === surf.x) continue;
        }

        const hy = surf.y - 1;
        if (hy < 1 || grid[hy][hx] !== null || grid[hy - 1]?.[hx] !== null) continue;

        const roll = rng() * 100;
        // Cranked-up hazard spawn rate (up to 85% per eligible slot at 100% density)
        if (roll < params.hazardDensity * 0.85) {
          // On 2-tile surfaces, spawn patrolling enemies (stompable) rather than static spikes
          const isEnemy = surf.w <= 2 ? true : rng() < 0.58;
          const hazardType = isEnemy
            ? 'ENEMY_PATROL_1X1'
            : SPIKE_TYPES[Math.floor(rng() * SPIKE_TYPES.length)];

          grid[hy][hx] = 'HAZARD';
          placements.push({
            type: hazardType,
            category: 'hazard',
            x: hx,
            y: hy,
            w: 1,
            h: 1,
            patrolMinX: surf.x,
            patrolMaxX: surf.x + surf.w - 1
          });
          // Spacing: at high density (70%+), allow tighter enemy/spike packs while always leaving a 1-tile gap between static spikes
          if (isEnemy) {
            hx += params.hazardDensity >= 75 ? 1 : 2;
          } else {
            hx += 2;
          }
        }
      }
    }
  }

  // 5. Place Non-Interacting Decorative Textures (Clouds, Bushes, Totems, Grass + 4 Vibrant Flower Types)
  const FLOWER_AND_GRASS_TYPES = [
    'GRASS_1X1',
    'FLOWER_1X1',
    'FLOWER_TULIP_1X1',
    'FLOWER_DAISY_1X1',
    'FLOWER_BELL_1X1'
  ];

  // Clouds in the upper sky (3x2 tiles)
  const cloudCount = Math.round((params.screens * params.decorDensity) / 25);
  for (let i = 0; i < cloudCount; i++) {
    const cx = Math.floor(rng() * (totalWidth - 4)) + 1;
    const cy = Math.floor(rng() * 3) + 1; // rows 1..3
    placements.push({
      type: 'CLOUD_3X2',
      category: 'non-interacting',
      x: cx,
      y: cy,
      w: 3,
      h: 2
    });
  }

  // Ground/platform foliage (Bushes 2x1, 4 Flower types 1x1, Grass tufts 1x1, Stone Pillars 1x2)
  for (const surf of standableSurfaces) {
    for (let dx = surf.x; dx < surf.x + surf.w; dx++) {
      if (dx < 3 || dx > totalWidth - 5) continue;
      const dy = surf.y - 1;
      if (dy < 1 || grid[dy][dx] !== null) continue;

      const roll = rng() * 100;
      if (roll < params.decorDensity * 0.48) {
        if (dx + 1 < surf.x + surf.w && grid[dy][dx + 1] === null && rng() < 0.28) {
          placements.push({
            type: 'BUSH_2X1',
            category: 'non-interacting',
            x: dx,
            y: dy,
            w: 2,
            h: 1
          });
          dx += 2;
        } else if (dy - 1 >= 1 && grid[dy - 1][dx] === null && rng() < 0.16) {
          placements.push({
            type: 'TOTEM_1X2',
            category: 'non-interacting',
            x: dx,
            y: dy - 1,
            w: 1,
            h: 2
          });
          dx += 1;
        } else {
          const pickedFoliage =
            FLOWER_AND_GRASS_TYPES[Math.floor(rng() * FLOWER_AND_GRASS_TYPES.length)];
          placements.push({
            type: pickedFoliage,
            category: 'non-interacting',
            x: dx,
            y: dy,
            w: 1,
            h: 1
          });
        }
      }
    }
  }

  // 6. Place Spawn Point and End-of-Level Goal Flagpole (1x4)
  const spawnPoint = { x: 2, y: baseGroundRow - 1 };
  const goalPoint = { x: totalWidth - 3, y: baseGroundRow - 4, w: 1, h: 4 };
  placements.push({
    type: 'SPAWN_1X1',
    category: 'marker',
    x: spawnPoint.x,
    y: spawnPoint.y,
    w: 1,
    h: 1
  });
  placements.push({
    type: 'GOAL_FLAG_1X4',
    category: 'marker',
    x: goalPoint.x,
    y: goalPoint.y,
    w: 1,
    h: 4
  });

  // 7. Compute Reachability Verification Report via BFS over standable surfaces
  const visited = new Set([0]);
  const queue = [0];
  while (queue.length > 0) {
    const currIdx = queue.shift();
    const curr = standableSurfaces[currIdx];
    for (let i = 0; i < standableSurfaces.length; i++) {
      if (!visited.has(i) && canJumpBetween(curr, standableSurfaces[i])) {
        visited.add(i);
        queue.push(i);
      }
    }
  }

  const palette = PALETTES[params.paletteIndex] || PALETTES[0];

  const startingLives = Math.max(1, Math.min(5, Number(params.startingLives || 3)));

  return {
    gridSpecs: {
      ...GRID_SPECS,
      totalWidthTiles: totalWidth,
      totalHeightTiles: totalHeight,
      screens: params.screens
    },
    palette,
    startingLives,
    spawnPoint,
    goalPoint,
    stats: {
      startingLives,
      totalPlatforms: placedPlatforms,
      totalInteracting: placedInteracting,
      totalHazards: placements.filter((p) => p.category === 'hazard').length,
      reachableSurfaceRatio: `${visited.size}/${standableSurfaces.length}`,
      allPlatformsReachable: visited.size === standableSurfaces.length,
      giftDistribution: {
        COIN: placements.filter((p) => p.gift === 'COIN').length,
        EXTRA_LIFE: placements.filter((p) => p.gift === 'EXTRA_LIFE').length,
        INVINCIBILITY: placements.filter((p) => p.gift === 'INVINCIBILITY').length
      }
    },
    placements
  };
}

module.exports = {
  generateLevel
};
