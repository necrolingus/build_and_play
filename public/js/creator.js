import {
  fetchParameterConfig,
  requestLevelPreview,
  submitLevel,
  fetchPowChallenge,
  solvePowChallenge
} from './api.js';
import { renderLevelToCanvas } from './renderer.js';
import { COUNTRIES } from './countries.js';

const state = {
  config: null,
  parameters: {},
  currentLevelData: null,
  turnstileToken: null,
  turnstileWidgetId: null,
  renderOptions: {
    showGrid: true,
    showScreenDividers: true,
    showGiftIcons: true
  }
};

const els = {
  slidersContainer: document.getElementById('sliders-container'),
  paletteSwatches: document.getElementById('palette-swatches'),
  seedDisplay: document.getElementById('seed-display'),
  regenerateBtn: document.getElementById('btn-regenerate'),
  canvas: document.getElementById('level-canvas'),
  statsBar: document.getElementById('level-stats'),
  giftBreakdown: document.getElementById('gift-ratio-bar'),
  usernameInput: document.getElementById('creator-username'),
  countrySelect: document.getElementById('creator-country'),
  levelNameInput: document.getElementById('level-name'),
  levelDescInput: document.getElementById('level-description'),
  submitForm: document.getElementById('submit-level-form'),
  submitBtn: document.getElementById('btn-submit-level'),
  feedbackBanner: document.getElementById('feedback-banner'),
  submissionModal: document.getElementById('submission-modal'),
  statusLinkAnchor: document.getElementById('unique-status-link'),
  copyLinkBtn: document.getElementById('btn-copy-link'),
  closeModalBtn: document.getElementById('btn-close-modal'),
  toggleGrid: document.getElementById('toggle-grid'),
  toggleScreens: document.getElementById('toggle-screens'),
  toggleGifts: document.getElementById('toggle-gifts'),
  turnstileWrapper: document.getElementById('turnstile-wrapper'),
  turnstileWidget: document.getElementById('turnstile-widget')
};

let debounceTimer = null;

function showFeedback(message, isError = false) {
  els.feedbackBanner.textContent = message;
  els.feedbackBanner.className = `feedback-banner ${isError ? 'error' : 'success'}`;
  els.feedbackBanner.hidden = false;
}

function hideFeedback() {
  els.feedbackBanner.hidden = true;
}

function populateCountryDropdown() {
  els.countrySelect.innerHTML = '<option value="">-- Prefer not to say (Optional) --</option>';
  for (const country of COUNTRIES) {
    const opt = document.createElement('option');
    opt.value = country;
    opt.textContent = country;
    els.countrySelect.appendChild(opt);
  }
}

function updateGiftRatioPreview() {
  const c = Number(state.parameters.giftWeightCoin || 0);
  const l = Number(state.parameters.giftWeightExtraLife || 0);
  const i = Number(state.parameters.giftWeightInvincibility || 0);
  const total = c + l + i;

  if (total <= 0) {
    els.giftBreakdown.innerHTML =
      '<span class="warn-text">Warning: Set at least one gift weight above 0!</span>';
    return;
  }

  const pctC = Math.round((c / total) * 100);
  const pctL = Math.round((l / total) * 100);
  const pctI = Math.max(0, 100 - pctC - pctL);

  els.giftBreakdown.innerHTML = `
    <div class="gift-Ratio-pills">
      <span class="pill coin">Coin: ${pctC}%</span>
      <span class="pill life">1-UP: ${pctL}%</span>
      <span class="pill invinc">5s 2x Invincibility: ${pctI}%</span>
    </div>
  `;
}

function buildPaletteSelector(palettes, bounds) {
  els.paletteSwatches.innerHTML = '';
  palettes.forEach((p, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `palette-card ${state.parameters.paletteIndex === idx ? 'active' : ''}`;
    btn.dataset.index = idx;
    btn.innerHTML = `
      <div class="swatch-strip">
        <span style="background:${p.sky}"></span>
        <span style="background:${p.groundPrimary}"></span>
        <span style="background:${p.platformSecondary}"></span>
        <span style="background:${p.decorPrimary}"></span>
        <span style="background:${p.interactPrimary}"></span>
      </div>
      <span class="palette-name">${idx + 1}. ${p.name}</span>
    `;
    btn.addEventListener('click', () => {
      state.parameters.paletteIndex = idx;
      document.querySelectorAll('.palette-card').forEach((el) => el.classList.remove('active'));
      btn.classList.add('active');
      schedulePreviewUpdate();
    });
    els.paletteSwatches.appendChild(btn);
  });
}

function buildSlidersFromBackendBounds(parameterBounds, palettes) {
  els.slidersContainer.innerHTML = '';

  const categories = {};
  for (const [key, spec] of Object.entries(parameterBounds)) {
    state.parameters[key] = spec.default;
    if (spec.category === 'Hidden') continue;
    if (!categories[spec.category]) {
      categories[spec.category] = [];
    }
    categories[spec.category].push({ key, spec });
  }

  for (const [categoryName, items] of Object.entries(categories)) {
    const groupEl = document.createElement('div');
    groupEl.className = 'slider-category-group';
    const titleEl = document.createElement('h3');
    titleEl.className = 'category-heading';
    titleEl.textContent = categoryName;
    groupEl.appendChild(titleEl);

    for (const { key, spec } of items) {
      const row = document.createElement('div');
      row.className = 'slider-control';

      const formatValue = (val) => {
        if (key === 'paletteIndex') {
          const pal = palettes[val];
          return pal ? `${val} (${pal.name})` : val;
        }
        return `${val}${spec.unit === '%' ? '%' : ` ${spec.unit}`}`;
      };

      row.innerHTML = `
        <div class="slider-header">
          <label for="param-slider-${key}">${spec.label}</label>
          <span class="slider-val-badge" id="param-val-${key}">${formatValue(spec.default)}</span>
        </div>
        <input
          type="range"
          id="param-slider-${key}"
          min="${spec.min}"
          max="${spec.max}"
          step="${spec.step}"
          value="${spec.default}"
        />
        <div class="slider-bounds-hint">
          <span>Min: ${spec.min}</span>
          <span class="slider-desc">${spec.description}</span>
          <span>Max: ${spec.max}</span>
        </div>
      `;

      const input = row.querySelector('input');
      const badge = row.querySelector('.slider-val-badge');

      input.addEventListener('input', () => {
        const numVal = Number(input.value);
        state.parameters[key] = numVal;
        badge.textContent = formatValue(numVal);

        if (key === 'paletteIndex') {
          document.querySelectorAll('.palette-card').forEach((card, i) => {
            card.classList.toggle('active', i === numVal);
          });
        }

        if (key.startsWith('giftWeight')) {
          updateGiftRatioPreview();
        }

        schedulePreviewUpdate();
      });

      groupEl.appendChild(row);
    }

    els.slidersContainer.appendChild(groupEl);
  }
}

function schedulePreviewUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    refreshPreview();
  }, 90);
}

async function refreshPreview() {
  try {
    hideFeedback();
    els.seedDisplay.textContent = `Seed #${state.parameters.seed}`;
    const result = await requestLevelPreview(state.parameters);
    state.currentLevelData = result.levelData;

    renderLevelToCanvas(els.canvas, state.currentLevelData, state.renderOptions);
    updateStatsBar(state.currentLevelData);
  } catch (err) {
    showFeedback(err.message, true);
  }
}

function updateStatsBar(levelData) {
  if (!levelData) return;
  const { gridSpecs, stats, palette } = levelData;
  els.statsBar.innerHTML = `
    <div class="stat-chip"><strong>Grid:</strong> ${gridSpecs.totalWidthTiles}×${gridSpecs.totalHeightTiles} tiles (${gridSpecs.screens} screens)</div>
    <div class="stat-chip"><strong>Palette:</strong> ${palette.name}</div>
    <div class="stat-chip"><strong>Starting Lives:</strong> ❤️ ${stats.startingLives ?? state.parameters.startingLives ?? 3}</div>
    <div class="stat-chip"><strong>Platforms:</strong> ${stats.totalPlatforms}</div>
    <div class="stat-chip"><strong>Hazards &amp; Bad Guys:</strong> 👾 ${stats.totalHazards ?? 0}</div>
    <div class="stat-chip"><strong>Lucky Blocks:</strong> ${stats.totalInteracting} (🪙${stats.giftDistribution.COIN} / ❤️${stats.giftDistribution.EXTRA_LIFE} / ⭐${stats.giftDistribution.INVINCIBILITY})</div>
    <div class="stat-chip ${stats.allPlatformsReachable ? 'ok' : 'warn'}">
      <strong>Reachability:</strong> ${stats.allPlatformsReachable ? '100% Verified' : stats.reachableSurfaceRatio}
    </div>
  `;
}

function randomizeSeed() {
  const bounds = state.config.parameterBounds.seed;
  const nextSeed = Math.floor(Math.random() * (bounds.max - bounds.min + 1)) + bounds.min;
  state.parameters.seed = nextSeed;
  refreshPreview();
}

function setupTurnstileIfActive(securityCfg) {
  if (!securityCfg || !securityCfg.turnstileActive || !securityCfg.turnstileSiteKey) {
    return;
  }

  els.turnstileWrapper.hidden = false;

  window.onTurnstileLoadCallback = () => {
    if (!window.turnstile) return;
    state.turnstileWidgetId = window.turnstile.render('#turnstile-widget', {
      sitekey: securityCfg.turnstileSiteKey,
      theme: 'dark',
      callback: (token) => {
        state.turnstileToken = token;
      },
      'expired-callback': () => {
        state.turnstileToken = null;
      }
    });
  };

  const script = document.createElement('script');
  script.src =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoadCallback&render=explicit';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

async function handleFormSubmit(e) {
  e.preventDefault();
  hideFeedback();

  const metadata = {
    name: els.levelNameInput.value.trim(),
    description: els.levelDescInput.value.trim(),
    username: els.usernameInput ? els.usernameInput.value.trim() : '',
    country: els.countrySelect.value
  };

  const securityCfg = state.config?.security || {};
  if (securityCfg.turnstileActive && !state.turnstileToken) {
    showFeedback('Please complete the Cloudflare Turnstile security check first.', true);
    return;
  }

  els.submitBtn.disabled = true;

  try {
    const securityPayload = {};

    // 1. Solve lightweight SHA-256 Proof-of-Work challenge if enabled
    if (securityCfg.powEnabled) {
      els.submitBtn.textContent = '🔒 Verifying Proof-of-Work...';
      const { challenge, difficulty } = await fetchPowChallenge();
      const nonce = await solvePowChallenge(challenge, difficulty);
      securityPayload.powChallenge = challenge;
      securityPayload.powNonce = nonce;
    }

    // 2. Attach Cloudflare Turnstile token if active on this domain
    if (securityCfg.turnstileActive) {
      securityPayload.turnstileToken = state.turnstileToken;
    }

    els.submitBtn.textContent = '🚀 Submitting Level...';
    const res = await submitLevel(state.parameters, metadata, securityPayload);
    const fullStatusUrl = `${window.location.origin}${res.level.statusUrl}`;
    els.statusLinkAnchor.href = fullStatusUrl;
    els.statusLinkAnchor.textContent = fullStatusUrl;
    els.submissionModal.hidden = false;

    if (securityCfg.turnstileActive && window.turnstile && state.turnstileWidgetId !== null) {
      state.turnstileToken = null;
      window.turnstile.reset(state.turnstileWidgetId);
    }
  } catch (err) {
    showFeedback(err.message, true);
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = '🚀 Submit Level for Admin Approval';
  }
}

async function initCreatorApp() {
  try {
    populateCountryDropdown();
    const config = await fetchParameterConfig();
    state.config = config;

    // Configure metadata input constraints from backend
    els.levelNameInput.minLength = config.metadataBounds.name.minLength;
    els.levelNameInput.maxLength = config.metadataBounds.name.maxLength;
    els.levelDescInput.minLength = config.metadataBounds.description.minLength;
    els.levelDescInput.maxLength = config.metadataBounds.description.maxLength;
    if (els.usernameInput && config.metadataBounds.username) {
      els.usernameInput.maxLength = config.metadataBounds.username.maxLength;
    }

    buildSlidersFromBackendBounds(config.parameterBounds, config.palettes);
    buildPaletteSelector(config.palettes, config.parameterBounds.paletteIndex);
    setupTurnstileIfActive(config.security);

    // Pick a fresh random seed on initial load
    randomizeSeed();
    updateGiftRatioPreview();

    // Event Listeners
    els.regenerateBtn.addEventListener('click', randomizeSeed);
    els.submitForm.addEventListener('submit', handleFormSubmit);

    els.toggleGrid.addEventListener('change', (e) => {
      state.renderOptions.showGrid = e.target.checked;
      renderLevelToCanvas(els.canvas, state.currentLevelData, state.renderOptions);
    });
    els.toggleScreens.addEventListener('change', (e) => {
      state.renderOptions.showScreenDividers = e.target.checked;
      renderLevelToCanvas(els.canvas, state.currentLevelData, state.renderOptions);
    });
    els.toggleGifts.addEventListener('change', (e) => {
      state.renderOptions.showGiftIcons = e.target.checked;
      renderLevelToCanvas(els.canvas, state.currentLevelData, state.renderOptions);
    });

    els.copyLinkBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(els.statusLinkAnchor.href);
      els.copyLinkBtn.textContent = 'Copied!';
      setTimeout(() => {
        els.copyLinkBtn.textContent = 'Copy Unique Link';
      }, 2000);
    });

    els.closeModalBtn.addEventListener('click', () => {
      els.submissionModal.hidden = true;
    });
  } catch (err) {
    showFeedback(`Initialization error: ${err.message}`, true);
  }
}

initCreatorApp();
