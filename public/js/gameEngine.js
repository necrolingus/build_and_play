import {
  drawGroundTile,
  drawPlatformTexture,
  drawInteractingBlock,
  drawCloud3x2,
  drawBush2x1,
  drawFoliage1x1,
  drawTotem1x2,
  drawHazard1x1,
  drawMarker,
  drawAnimatedHero
} from './renderer.js';

const TILE_PX = 32; // 16px native * 2x scale
const VIEWPORT_WIDTH = 20 * TILE_PX; // 640px (1 screen wide)
const VIEWPORT_HEIGHT = 15 * TILE_PX; // 480px (15 tiles high)

// Tuned 2D Platformer Physics Constants (matching generator's 3.5 tile jump height & 4.5 tile width)
const GRAVITY = 1480; // px / s^2
const JUMP_VELOCITY = -565; // px / s (gives ~118px / 3.68 tiles peak jump height)
const MOVE_ACCEL = 1650; // px / s^2
const MOVE_DECEL = 1950; // px / s^2
const MAX_RUN_SPEED = 230; // px / s
const BOUNCE_VELOCITY = -450; // px / s when bouncing on top of a lucky block or enemy

export class PlatformerGameEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks; // { onHudUpdate, onGameEnd }

    this.canvas.width = VIEWPORT_WIDTH;
    this.canvas.height = VIEWPORT_HEIGHT;

    this.keys = {
      left: false,
      right: false,
      jump: false,
      jumpJustPressed: false
    };

    this.rafId = null;
    this.running = false;
    this.levelData = null;

    this.bindKeyboard();
  }

  bindKeyboard() {
    this.handleKeyDown = (e) => {
      if (!this.running) return;
      const code = e.code;
      if (code === 'ArrowLeft' || code === 'KeyA') {
        this.keys.left = true;
        e.preventDefault();
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        this.keys.right = true;
        e.preventDefault();
      } else if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
        if (!this.keys.jump) {
          this.keys.jumpJustPressed = true;
        }
        this.keys.jump = true;
        e.preventDefault();
      }
    };

    this.handleKeyUp = (e) => {
      const code = e.code;
      if (code === 'ArrowLeft' || code === 'KeyA') {
        this.keys.left = false;
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        this.keys.right = false;
      } else if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
        this.keys.jump = false;
      }
    };

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  loadAndStart(levelData, parameters = {}) {
    this.stop();
    // Deep clone placements so bumped blocks / defeated enemies reset cleanly on retry
    this.levelData = JSON.parse(JSON.stringify(levelData));
    this.worldWidthPx = this.levelData.gridSpecs.totalWidthTiles * TILE_PX;
    this.worldHeightPx = this.levelData.gridSpecs.totalHeightTiles * TILE_PX;

    // Separate placements by role for fast physics & rendering
    this.decorItems = [];
    this.solidBlocks = [];
    this.luckyBlocks = [];
    this.hazards = [];
    this.goalMarker = null;

    for (const p of this.levelData.placements) {
      const rect = {
        ...p,
        px: p.x * TILE_PX,
        py: p.y * TILE_PX,
        pw: p.w * TILE_PX,
        ph: p.h * TILE_PX
      };

      if (p.category === 'non-interacting') {
        this.decorItems.push(rect);
      } else if (p.category === 'platform') {
        this.solidBlocks.push(rect);
      } else if (p.category === 'interacting') {
        rect.used = false;
        rect.bumpOffsetPx = 0;
        this.luckyBlocks.push(rect);
        this.solidBlocks.push(rect); // Lucky blocks are also solid!
      } else if (p.category === 'hazard') {
        if (p.type === 'ENEMY_PATROL_1X1') {
          rect.alive = true;
          rect.vx = 58; // Patrol speed px/s
          rect.minPx = (p.patrolMinX ?? p.x) * TILE_PX;
          rect.maxPx = ((p.patrolMaxX ?? p.x) + 1) * TILE_PX - TILE_PX;
        }
        this.hazards.push(rect);
      } else if (p.type === 'GOAL_FLAG_1X4') {
        this.goalMarker = rect;
      }
    }

    const configuredLives = Number(
      parameters?.startingLives ??
        this.levelData.startingLives ??
        this.levelData.stats?.startingLives ??
        3
    );
    this.startingLives = Math.max(1, Math.min(5, configuredLives));
    this.lives = this.startingLives;
    this.coins = 0;
    this.extraLivesCollected = 0;
    this.invincibilitiesCollected = 0;
    this.totalGiftsOpened = 0;
    this.totalGiftsInLevel = this.luckyBlocks.length;
    this.score = 0;
    this.floatingTexts = [];
    this.status = 'PLAYING'; // 'PLAYING' | 'WON' | 'GAME_OVER'

    this.spawnPlayer(true);
    this.emitHud();

    this.running = true;
    this.lastTimestamp = performance.now();
    this.loop(this.lastTimestamp);
  }

  spawnPlayer(resetPowerups = false) {
    const sp = this.levelData.spawnPoint || { x: 2, y: 12 };
    this.player = {
      x: sp.x * TILE_PX + 4,
      y: sp.y * TILE_PX,
      baseW: 24,
      baseH: 30,
      w: 24,
      h: 30,
      vx: 0,
      vy: 0,
      facing: 1,
      walkFrame: 0,
      isGrounded: false,
      invincibleUntil: resetPowerups ? 0 : this.player?.invincibleUntil || 0,
      hurtImmunityUntil: performance.now() + 1000
    };
    this.cameraX = 0;
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  emitHud() {
    if (this.callbacks.onHudUpdate) {
      const now = performance.now();
      const invincRemainingMs = Math.max(0, (this.player?.invincibleUntil || 0) - now);
      this.callbacks.onHudUpdate({
        lives: this.lives,
        startingLives: this.startingLives,
        coins: this.coins,
        extraLivesCollected: this.extraLivesCollected,
        invincibilitiesCollected: this.invincibilitiesCollected,
        totalGiftsOpened: this.totalGiftsOpened,
        totalGiftsInLevel: this.totalGiftsInLevel,
        score: this.score,
        invincibilitySeconds: (invincRemainingMs / 1000).toFixed(1),
        isInvincible: invincRemainingMs > 0,
        status: this.status
      });
    }
  }

  addFloatingText(text, px, py, color = '#ffd700') {
    this.floatingTexts.push({
      text,
      x: px,
      y: py,
      vy: -45,
      color,
      alpha: 1,
      lifeMs: 1100
    });
  }

  /**
   * Triggers a Lucky-Dip Block when bumped from the bottom, side, or bounced on top!
   * Awards either a Coin, an Extra Life (1-UP), or 5-second 2x-size Invincibility.
   */
  triggerLuckyBlock(block, bumpDirection) {
    if (block.used) return;
    block.used = true;
    block.bumpOffsetPx = bumpDirection === 'TOP' ? 6 : -8;
    this.totalGiftsOpened += 1;

    const gift = block.gift || 'COIN';
    const centerX = block.px + block.pw / 2;
    const topY = block.py - 8;

    if (gift === 'COIN') {
      this.coins += 1;
      this.score += 100;
      this.addFloatingText('+1 COIN!', centerX, topY, '#ffd700');
    } else if (gift === 'EXTRA_LIFE') {
      this.extraLivesCollected += 1;
      this.lives += 1;
      this.score += 500;
      this.addFloatingText('❤️ +1 EXTRA LIFE!', centerX, topY, '#00e676');
    } else if (gift === 'INVINCIBILITY') {
      this.invincibilitiesCollected += 1;
      this.score += 1000;
      const now = performance.now();
      // Activate 5 seconds of 2x-size Giant Invincibility!
      const wasGiant = this.player.invincibleUntil > now;
      this.player.invincibleUntil = now + 5000;
      if (!wasGiant) {
        // Grow to 2x size anchored from feet so player never clips into floor
        const oldH = this.player.h;
        this.player.w = this.player.baseW * 2;
        this.player.h = this.player.baseH * 2;
        this.player.y -= this.player.h - oldH;
      }
      this.addFloatingText('⭐ 5s 2X GIANT INVINCIBILITY!', centerX, topY - 8, '#ff4081');
    }

    this.emitHud();
  }

  rectsOverlap(a, b) {
    return (
      a.x < b.px + b.pw &&
      a.x + a.w > b.px &&
      a.y < b.py + b.ph &&
      a.y + a.h > b.py
    );
  }

  update(dt, now) {
    if (this.status !== 'PLAYING') return;

    const p = this.player;
    const isInvincible = p.invincibleUntil > now;

    // Check if 5s 2x Giant Invincibility just expired -> return to normal 1x size
    if (!isInvincible && p.h > p.baseH) {
      const oldH = p.h;
      p.w = p.baseW;
      p.h = p.baseH;
      p.y += oldH - p.h;
    }

    // 1. Horizontal Movement & Acceleration
    if (this.keys.left && !this.keys.right) {
      p.vx -= MOVE_ACCEL * dt;
      p.facing = -1;
    } else if (this.keys.right && !this.keys.left) {
      p.vx += MOVE_ACCEL * dt;
      p.facing = 1;
    } else {
      // Friction / Deceleration
      if (p.vx > 0) {
        p.vx = Math.max(0, p.vx - MOVE_DECEL * dt);
      } else if (p.vx < 0) {
        p.vx = Math.min(0, p.vx + MOVE_DECEL * dt);
      }
    }

    const maxSpeed = isInvincible ? MAX_RUN_SPEED * 1.18 : MAX_RUN_SPEED;
    p.vx = Math.max(-maxSpeed, Math.min(maxSpeed, p.vx));

    // Advance limb animation cycle when moving
    if (Math.abs(p.vx) > 10 && p.isGrounded) {
      p.walkFrame += (Math.abs(p.vx) / 38) * dt;
    } else if (p.isGrounded) {
      p.walkFrame = 0;
    }

    // 2. Jump initiation
    if (this.keys.jumpJustPressed && p.isGrounded) {
      p.vy = JUMP_VELOCITY;
      p.isGrounded = false;
    }
    this.keys.jumpJustPressed = false;

    // Apply Gravity
    p.vy += GRAVITY * dt;
    if (p.vy > 750) p.vy = 750;

    // 3. Move Horizontally & Resolve Solid Collisions (+ Side-Bumping Lucky Blocks!)
    p.x += p.vx * dt;
    if (p.x < 0) {
      p.x = 0;
      p.vx = 0;
    }
    if (p.x + p.w > this.worldWidthPx) {
      p.x = this.worldWidthPx - p.w;
      p.vx = 0;
    }

    for (const block of this.solidBlocks) {
      if (this.rectsOverlap(p, block)) {
        // If jumping/moving into the side of an interacting Lucky Block, bump it!
        if (block.category === 'interacting' && !block.used && (!p.isGrounded || Math.abs(p.vx) > 80)) {
          this.triggerLuckyBlock(block, 'SIDE');
        }
        if (p.vx > 0) {
          p.x = block.px - p.w;
          p.vx = 0;
        } else if (p.vx < 0) {
          p.x = block.px + block.pw;
          p.vx = 0;
        }
      }
    }

    // 4. Move Vertically & Resolve Solid Collisions (+ Bottom Head-Bump & Top Bounce on Lucky Blocks!)
    p.y += p.vy * dt;
    p.isGrounded = false;

    for (const block of this.solidBlocks) {
      if (this.rectsOverlap(p, block)) {
        if (p.vy > 0) {
          // Landing on top of block
          p.y = block.py - p.h;
          if (block.category === 'interacting' && !block.used) {
            // Bouncing on top of a Lucky Block triggers it and bounces the player upward!
            this.triggerLuckyBlock(block, 'TOP');
            p.vy = BOUNCE_VELOCITY;
            p.isGrounded = false;
          } else {
            p.vy = 0;
            p.isGrounded = true;
          }
        } else if (p.vy < 0) {
          // Hitting block from underneath (classic head-bump!)
          p.y = block.py + block.ph;
          p.vy = 40;
          if (block.category === 'interacting' && !block.used) {
            this.triggerLuckyBlock(block, 'BOTTOM');
          }
        }
      }
    }

    // Animate lucky block bump recoil back to 0
    for (const lb of this.luckyBlocks) {
      if (Math.abs(lb.bumpOffsetPx) > 0.2) {
        lb.bumpOffsetPx *= 0.78;
      } else {
        lb.bumpOffsetPx = 0;
      }
    }

    // 5. Pit Fall Check
    if (p.y > this.worldHeightPx + 40) {
      this.handlePlayerLifeLost('Fell into a pit!');
      return;
    }

    // 6. Update Patrolling Enemies & Check Hazard Collisions
    for (const haz of this.hazards) {
      if (haz.type === 'ENEMY_PATROL_1X1') {
        if (!haz.alive) continue;
        haz.px += haz.vx * dt;
        if (haz.px <= haz.minPx) {
          haz.px = haz.minPx;
          haz.vx = Math.abs(haz.vx);
        } else if (haz.px >= haz.maxPx) {
          haz.px = haz.maxPx;
          haz.vx = -Math.abs(haz.vx);
        }
      }

      // Shrink spike hitbox slightly so grazing the edge feels fair
      const hitbox =
        haz.type === 'ENEMY_PATROL_1X1'
          ? { px: haz.px + 3, py: haz.py + 4, pw: haz.pw - 6, ph: haz.ph - 4 }
          : { px: haz.px + 5, py: haz.py + 10, pw: haz.pw - 10, ph: haz.ph - 10 };

      if (this.rectsOverlap(p, hitbox)) {
        if (haz.type === 'ENEMY_PATROL_1X1') {
          // Stomping enemy from above or ploughing through while Invincible defeats it!
          const isStomp = p.vy > 0 && p.y + p.h - p.vy * dt <= haz.py + 14;
          if (isInvincible || isStomp) {
            haz.alive = false;
            this.score += 250;
            if (isStomp && !isInvincible) {
              p.vy = BOUNCE_VELOCITY * 0.85;
            }
            this.addFloatingText('+250 KO!', haz.px + 16, haz.py, '#00f5d4');
            this.emitHud();
            continue;
          }
        }

        // Spikes & un-stomped enemies hurt the player unless Invincible!
        if (!isInvincible && now > p.hurtImmunityUntil) {
          this.handlePlayerLifeLost('Hit a hazard!');
          return;
        }
      }
    }

    // 7. Check Goal Flagpole Win Condition
    if (this.goalMarker && this.rectsOverlap(p, this.goalMarker)) {
      this.status = 'WON';
      this.score += 1500;
      this.emitHud();
      if (this.callbacks.onGameEnd) {
        this.callbacks.onGameEnd({
          won: true,
          score: this.score,
          coins: this.coins,
          extraLivesCollected: this.extraLivesCollected,
          invincibilitiesCollected: this.invincibilitiesCollected,
          totalGiftsOpened: this.totalGiftsOpened,
          totalGiftsInLevel: this.totalGiftsInLevel,
          lives: this.lives,
          startingLives: this.startingLives
        });
      }
      return;
    }

    // 8. Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.lifeMs -= dt * 1000;
      ft.alpha = Math.max(0, ft.lifeMs / 1100);
      if (ft.lifeMs <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 9. Smooth Camera Follow horizontally
    const targetCamX = p.x + p.w / 2 - VIEWPORT_WIDTH * 0.38;
    const maxCamX = Math.max(0, this.worldWidthPx - VIEWPORT_WIDTH);
    this.cameraX += (Math.max(0, Math.min(maxCamX, targetCamX)) - this.cameraX) * 0.14;

    if (isInvincible) {
      this.emitHud();
    }
  }

  handlePlayerLifeLost(reason) {
    this.lives -= 1;
    this.addFloatingText(`-1 LIFE (${reason})`, this.player.x, this.player.y - 10, '#ff4081');

    if (this.lives <= 0) {
      this.lives = 0;
      this.status = 'GAME_OVER';
      this.emitHud();
      if (this.callbacks.onGameEnd) {
        this.callbacks.onGameEnd({
          won: false,
          score: this.score,
          coins: this.coins,
          extraLivesCollected: this.extraLivesCollected,
          invincibilitiesCollected: this.invincibilitiesCollected,
          totalGiftsOpened: this.totalGiftsOpened,
          totalGiftsInLevel: this.totalGiftsInLevel,
          lives: 0,
          startingLives: this.startingLives
        });
      }
    } else {
      this.spawnPlayer(true);
      this.emitHud();
    }
  }

  render(now) {
    const ctx = this.ctx;
    const { palette } = this.levelData;

    // 1. Sky Gradient Background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
    skyGrad.addColorStop(0, palette.sky);
    skyGrad.addColorStop(1, palette.skyGradient);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    ctx.save();
    ctx.translate(-Math.round(this.cameraX), 0);

    // 2. Non-Interacting Scenery
    for (const item of this.decorItems) {
      if (item.px + item.pw < this.cameraX - 64 || item.px > this.cameraX + VIEWPORT_WIDTH + 64) {
        continue;
      }
      if (item.type === 'CLOUD_3X2') {
        drawCloud3x2(ctx, item.px, item.py, TILE_PX, palette);
      } else if (item.type === 'BUSH_2X1') {
        drawBush2x1(ctx, item.px, item.py, TILE_PX, palette);
      } else if (item.type === 'TOTEM_1X2') {
        drawTotem1x2(ctx, item.px, item.py, TILE_PX, palette);
      } else {
        drawFoliage1x1(ctx, item.px, item.py, TILE_PX, palette, item.type);
      }
    }

    // 3. Solid Ground & Elevated Platforms
    for (const item of this.solidBlocks) {
      if (item.category === 'interacting') continue; // Drawn in step 5
      if (item.px + item.pw < this.cameraX - 64 || item.px > this.cameraX + VIEWPORT_WIDTH + 64) {
        continue;
      }
      if (item.type === 'GROUND_2X2' || item.type === 'GROUND_1X2') {
        for (let dy = 0; dy < item.h; dy++) {
          for (let dx = 0; dx < item.w; dx++) {
            drawGroundTile(
              ctx,
              item.px + dx * TILE_PX,
              item.py + dy * TILE_PX,
              TILE_PX,
              palette,
              dy === 0
            );
          }
        }
      } else {
        drawPlatformTexture(ctx, item.px, item.py, item.w, TILE_PX, palette);
      }
    }

    // 4. Hazards (3 Spike Types & Patrolling Enemies)
    for (const haz of this.hazards) {
      if (haz.type === 'ENEMY_PATROL_1X1' && !haz.alive) continue;
      drawHazard1x1(ctx, Math.round(haz.px), Math.round(haz.py), TILE_PX, palette, haz.type, now);
    }

    // 5. Interacting Bumpable Lucky-Dip Blocks
    for (const lb of this.luckyBlocks) {
      drawInteractingBlock(
        ctx,
        lb.px,
        Math.round(lb.py + (lb.bumpOffsetPx || 0)),
        TILE_PX,
        palette,
        lb.gift,
        false, // Keep gift a surprise lucky dip during actual gameplay!
        lb.used
      );
    }

    // 6. Goal Flagpole
    if (this.goalMarker) {
      drawMarker(ctx, this.goalMarker, TILE_PX, palette);
    }

    // 7. Animated Playable Hero Character (with swinging arms, striding legs, & 2x Giant Invincibility!)
    const p = this.player;
    const isInvincible = p.invincibleUntil > now;
    drawAnimatedHero(ctx, Math.round(p.x), Math.round(p.y), p.w, p.h, palette, {
      facing: p.facing,
      walkFrame: p.walkFrame,
      isGrounded: p.isGrounded,
      isInvincible,
      timeMs: now
    });

    // 8. Floating Popups (+1 COIN, +1 EXTRA LIFE, 5s 2X INVINCIBILITY)
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }

  loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0.001, (timestamp - this.lastTimestamp) / 1000));
    this.lastTimestamp = timestamp;

    this.update(dt, timestamp);
    this.render(timestamp);

    if (this.running) {
      this.rafId = requestAnimationFrame((ts) => this.loop(ts));
    }
  }
}
