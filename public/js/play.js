import {
  fetchParameterConfig,
  fetchPlayableLevels,
  fetchPlayableLevelById,
  recordLevelWin
} from './api.js';
import { COUNTRIES } from './countries.js';
import { PlatformerGameEngine } from './gameEngine.js';

const els = {
  arenaSection: document.getElementById('gameplay-arena-section'),
  playingTitle: document.getElementById('playing-level-title'),
  playingMeta: document.getElementById('playing-level-meta'),
  hudLives: document.getElementById('hud-lives'),
  hudCoins: document.getElementById('hud-coins'),
  hudExtraLives: document.getElementById('hud-extra-lives'),
  hudInvincCount: document.getElementById('hud-invinc-count'),
  hudGiftsOpened: document.getElementById('hud-gifts-opened'),
  hudGiftsTotal: document.getElementById('hud-gifts-total'),
  hudScore: document.getElementById('hud-score'),
  hudInvincBadge: document.getElementById('hud-invinc-badge'),
  hudInvincTimer: document.getElementById('hud-invinc-timer'),
  restartBtn: document.getElementById('btn-restart-level'),
  closeGameBtn: document.getElementById('btn-close-game'),
  gameCanvas: document.getElementById('gameplay-canvas'),
  gameOverlay: document.getElementById('game-overlay'),
  overlayTitle: document.getElementById('overlay-title'),
  overlayMessage: document.getElementById('overlay-message'),
  overlayStatsBreakdown: document.getElementById('overlay-stats-breakdown'),
  overlayRetryBtn: document.getElementById('btn-overlay-retry'),
  overlayBrowseBtn: document.getElementById('btn-overlay-browse'),
  touchLeft: document.getElementById('touch-left'),
  touchRight: document.getElementById('touch-right'),
  touchJump: document.getElementById('touch-jump'),
  playableCount: document.getElementById('playable-count'),
  resetFiltersBtn: document.getElementById('btn-reset-filters'),
  filterSearch: document.getElementById('filter-search'),
  filterPalette: document.getElementById('filter-palette'),
  filterLength: document.getElementById('filter-length'),
  filterCountry: document.getElementById('filter-country'),
  filterSort: document.getElementById('filter-sort'),
  levelsGrid: document.getElementById('levels-grid')
};

let engine = null;
let activeLevelRecord = null;
let filterTimer = null;

function setupFilterDropdowns(palettes) {
  if (palettes) {
    for (const p of palettes) {
      const opt = document.createElement('option');
      opt.value = String(p.id);
      opt.textContent = p.name;
      els.filterPalette.appendChild(opt);
    }
  }

  for (const c of COUNTRIES) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    els.filterCountry.appendChild(opt);
  }
}

function getActiveFilters() {
  const lengthVal = els.filterLength.value;
  let minScreens = '';
  let maxScreens = '';
  if (lengthVal === '2-4') {
    minScreens = '2';
    maxScreens = '4';
  } else if (lengthVal === '5-7') {
    minScreens = '5';
    maxScreens = '7';
  } else if (lengthVal === '8-12') {
    minScreens = '8';
    maxScreens = '12';
  }

  return {
    search: els.filterSearch.value.trim(),
    paletteIndex: els.filterPalette.value,
    minScreens,
    maxScreens,
    country: els.filterCountry.value,
    sort: els.filterSort.value
  };
}

async function loadLevelsList() {
  try {
    const filters = getActiveFilters();
    const { levels } = await fetchPlayableLevels(filters);
    els.playableCount.textContent = levels.length;
    renderLevelsGrid(levels);
  } catch (err) {
    els.levelsGrid.innerHTML = `<div class="feedback-banner error">${err.message}</div>`;
  }
}

function renderLevelsGrid(levels) {
  els.levelsGrid.innerHTML = '';

  if (!levels || levels.length === 0) {
    els.levelsGrid.innerHTML = `
      <div class="panel" style="grid-column: 1 / -1; text-align: center; padding: 2.5rem;">
        <h3 style="color: var(--accent-primary); margin-bottom: 0.5rem;">No Matching Levels Found</h3>
        <p style="color: var(--text-muted); margin-bottom: 1rem;">Try clearing your filters or build a brand new level in the Level Creator!</p>
        <a href="/creator.html" class="btn btn-primary" style="text-decoration: none;">🛠️ Build a Level</a>
      </div>
    `;
    return;
  }

  for (const lvl of levels) {
    const card = document.createElement('article');
    card.className = 'panel level-browser-card';

    const pal = lvl.paletteColors || {
      sky: '#5c94fc',
      groundPrimary: '#c84c0c',
      platformSecondary: '#fca044',
      decorPrimary: '#00a800',
      interactPrimary: '#fc9838'
    };

    const screens = lvl.parameters?.screens ?? 4;
    const luckyCount = lvl.stats?.totalInteracting ?? lvl.parameters?.interactingCount ?? 10;
    const startLives = lvl.parameters?.startingLives ?? lvl.stats?.startingLives ?? 3;

    card.innerHTML = `
      <div class="swatch-strip" style="height: 10px; margin-bottom: 0.75rem;">
        <span style="background:${pal.sky}"></span>
        <span style="background:${pal.groundPrimary}"></span>
        <span style="background:${pal.platformSecondary}"></span>
        <span style="background:${pal.decorPrimary}"></span>
        <span style="background:${pal.interactPrimary}"></span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
        <h3 class="level-card-title">${escapeHtml(lvl.name)}</h3>
        <span class="seed-tag" style="font-size: 0.72rem; padding: 0.15rem 0.45rem;">${screens} Screens</span>
      </div>
      <p class="level-card-desc">${escapeHtml(lvl.description)}</p>
      <div class="stats-bar" style="margin-top: auto; padding-top: 0.75rem;">
        <span class="stat-chip">👤 ${escapeHtml(lvl.username || 'Anonymous')}</span>
        <span class="stat-chip">🌍 ${escapeHtml(lvl.country || 'Unspecified')}</span>
        <span class="stat-chip">🎨 ${escapeHtml(lvl.paletteName)}</span>
        <span class="stat-chip">❤️ ${startLives} Starting ${startLives === 1 ? 'Life' : 'Lives'}</span>
        <span class="stat-chip">❓ ${luckyCount} Lucky Blocks</span>
        <span class="stat-chip">▶ ${lvl.playsCount} Plays (${lvl.winsCount} Wins)</span>
      </div>
      <button type="button" class="btn btn-primary" style="width: 100%; margin-top: 0.9rem;">
        ▶ Play This Level
      </button>
    `;

    const playBtn = card.querySelector('button');
    playBtn.addEventListener('click', () => {
      startPlayingLevel(lvl.id);
    });

    els.levelsGrid.appendChild(card);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function startPlayingLevel(levelId) {
  try {
    const { level } = await fetchPlayableLevelById(levelId);
    activeLevelRecord = level;

    els.playingTitle.textContent = `Playing: ${level.name}`;
    els.playingMeta.textContent = `Created by ${level.username || 'Anonymous'} (${level.country || 'Unspecified'}) • ${level.parameters?.screens || 4} Screens • ${level.levelData?.palette?.name || ''}`;
    els.gameOverlay.hidden = true;
    els.arenaSection.hidden = false;

    els.arenaSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (!engine) {
      engine = new PlatformerGameEngine(els.gameCanvas, {
        onHudUpdate: (hud) => {
          els.hudLives.textContent = hud.lives;
          els.hudCoins.textContent = hud.coins;
          if (els.hudExtraLives) els.hudExtraLives.textContent = hud.extraLivesCollected ?? 0;
          if (els.hudInvincCount) els.hudInvincCount.textContent = hud.invincibilitiesCollected ?? 0;
          if (els.hudGiftsOpened) els.hudGiftsOpened.textContent = hud.totalGiftsOpened ?? 0;
          if (els.hudGiftsTotal) els.hudGiftsTotal.textContent = hud.totalGiftsInLevel ?? 0;
          els.hudScore.textContent = hud.score;
          if (hud.isInvincible) {
            els.hudInvincBadge.hidden = false;
            els.hudInvincTimer.textContent = hud.invincibilitySeconds;
          } else {
            els.hudInvincBadge.hidden = true;
          }
        },
        onGameEnd: async (result) => {
          els.gameOverlay.hidden = false;
          if (els.overlayStatsBreakdown) {
            els.overlayStatsBreakdown.innerHTML = `
              <span class="stat-chip">❤️ <strong>Lives Left:</strong> ${result.lives} (Started with ${result.startingLives})</span>
              <span class="stat-chip">🎁 <strong>Gifts Opened:</strong> ${result.totalGiftsOpened} / ${result.totalGiftsInLevel}</span>
              <span class="stat-chip">🪙 <strong>Coins:</strong> ${result.coins}</span>
              <span class="stat-chip">❤️ <strong>Extra Lives (+1UP):</strong> ${result.extraLivesCollected}</span>
              <span class="stat-chip">⭐ <strong>2× Invincibilities:</strong> ${result.invincibilitiesCollected}</span>
              <span class="stat-chip">🏆 <strong>Final Score:</strong> ${result.score}</span>
            `;
          }
          if (result.won) {
            els.overlayTitle.textContent = '🏆 LEVEL COMPLETE!';
            els.overlayTitle.style.color = 'var(--accent-green)';
            els.overlayMessage.textContent = `Awesome run! You reached the Goal Flagpole with ${result.lives} ${result.lives === 1 ? 'life' : 'lives'} remaining and collected ${result.totalGiftsOpened} of ${result.totalGiftsInLevel} gifts!`;
            if (activeLevelRecord) {
              await recordLevelWin(activeLevelRecord.id);
              loadLevelsList();
            }
          } else {
            els.overlayTitle.textContent = '💀 GAME OVER';
            els.overlayTitle.style.color = 'var(--accent-danger)';
            els.overlayMessage.textContent = `You ran out of lives after collecting ${result.totalGiftsOpened} of ${result.totalGiftsInLevel} gifts. Hit Play Again to conquer this level!`;
          }
        }
      });
      bindTouchControls();
    }

    engine.loadAndStart(level.levelData, level.parameters);
    loadLevelsList(); // Refresh play counts in background
  } catch (err) {
    alert(`Could not start level: ${err.message}`);
  }
}

function bindTouchControls() {
  const bindHold = (btn, keyName) => {
    const press = (e) => {
      e.preventDefault();
      if (!engine) return;
      if (keyName === 'jump' && !engine.keys.jump) {
        engine.keys.jumpJustPressed = true;
      }
      engine.keys[keyName] = true;
    };
    const release = (e) => {
      e.preventDefault();
      if (!engine) return;
      engine.keys[keyName] = false;
    };
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release);
  };

  bindHold(els.touchLeft, 'left');
  bindHold(els.touchRight, 'right');
  bindHold(els.touchJump, 'jump');
}

async function initPlayPage() {
  try {
    const config = await fetchParameterConfig();
    setupFilterDropdowns(config.palettes);
  } catch (e) {
    setupFilterDropdowns([]);
  }

  await loadLevelsList();

  // Check if ?id= was passed in URL to auto-launch a level
  const urlParams = new URLSearchParams(window.location.search);
  const autoId = urlParams.get('id');
  if (autoId) {
    startPlayingLevel(autoId);
  }

  const triggerFilter = () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(loadLevelsList, 150);
  };

  els.filterSearch.addEventListener('input', triggerFilter);
  els.filterPalette.addEventListener('change', loadLevelsList);
  els.filterLength.addEventListener('change', loadLevelsList);
  els.filterCountry.addEventListener('change', loadLevelsList);
  els.filterSort.addEventListener('change', loadLevelsList);

  els.resetFiltersBtn.addEventListener('click', () => {
    els.filterSearch.value = '';
    els.filterPalette.value = '';
    els.filterLength.value = '';
    els.filterCountry.value = '';
    els.filterSort.value = 'newest';
    loadLevelsList();
  });

  els.restartBtn.addEventListener('click', () => {
    if (engine && activeLevelRecord) {
      els.gameOverlay.hidden = true;
      engine.loadAndStart(activeLevelRecord.levelData, activeLevelRecord.parameters);
    }
  });

  els.overlayRetryBtn.addEventListener('click', () => {
    if (engine && activeLevelRecord) {
      els.gameOverlay.hidden = true;
      engine.loadAndStart(activeLevelRecord.levelData, activeLevelRecord.parameters);
    }
  });

  const closeArena = () => {
    if (engine) engine.stop();
    els.arenaSection.hidden = true;
    els.gameOverlay.hidden = true;
  };

  els.closeGameBtn.addEventListener('click', closeArena);
  els.overlayBrowseBtn.addEventListener('click', closeArena);
}

initPlayPage();
