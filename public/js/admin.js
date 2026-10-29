import {
  fetchParameterConfig,
  verifyAdminKey,
  fetchAdminLevels,
  updateAdminLevel,
  fetchAdminLogs
} from './api.js';
import { renderLevelToCanvas } from './renderer.js';

const STORAGE_KEY = 'retro_engine_admin_api_key';

const state = {
  apiKey: sessionStorage.getItem(STORAGE_KEY) || '',
  activeStatusFilter: 'PENDING',
  levels: [],
  selectedLevel: null,
  security: null,
  turnstileToken: null,
  turnstileWidgetId: null,
  renderOptions: {
    showGrid: true,
    showScreenDividers: true,
    showGiftIcons: true
  }
};

const els = {
  loginView: document.getElementById('admin-login-view'),
  loginForm: document.getElementById('admin-login-form'),
  loginBtn: document.getElementById('btn-admin-login'),
  apiKeyInput: document.getElementById('admin-api-key-input'),
  loginError: document.getElementById('login-error'),
  turnstileWrapper: document.getElementById('admin-turnstile-wrapper'),
  turnstileWidget: document.getElementById('admin-turnstile-widget'),
  logoutBtn: document.getElementById('btn-admin-logout'),
  workspace: document.getElementById('admin-workspace'),
  refreshQueueBtn: document.getElementById('btn-refresh-queue'),
  countPending: document.getElementById('count-pending'),
  countApproved: document.getElementById('count-approved'),
  countDeclined: document.getElementById('count-declined'),
  countAll: document.getElementById('count-all'),
  queueList: document.getElementById('queue-list'),
  feedbackBanner: document.getElementById('admin-feedback'),
  emptySelectionPanel: document.getElementById('empty-selection-panel'),
  inspectorPanel: document.getElementById('level-inspector-panel'),
  previewPanel: document.getElementById('level-preview-panel'),
  inspectId: document.getElementById('inspect-id'),
  inspectStatusLink: document.getElementById('inspect-status-link'),
  inspectStatusBadge: document.getElementById('inspect-status-badge'),
  editName: document.getElementById('edit-level-name'),
  editUsername: document.getElementById('edit-level-username'),
  editDesc: document.getElementById('edit-level-desc'),
  editDeclineReason: document.getElementById('edit-decline-reason'),
  inspectCountry: document.getElementById('inspect-country'),
  inspectCreated: document.getElementById('inspect-created'),
  inspectSeed: document.getElementById('inspect-seed'),
  approveBtn: document.getElementById('btn-approve'),
  declineBtn: document.getElementById('btn-decline'),
  saveEditsBtn: document.getElementById('btn-save-edits'),
  canvas: document.getElementById('admin-level-canvas'),
  statsBar: document.getElementById('admin-level-stats'),
  toggleGrid: document.getElementById('admin-toggle-grid'),
  toggleScreens: document.getElementById('admin-toggle-screens'),
  toggleGifts: document.getElementById('admin-toggle-gifts'),
  logsBox: document.getElementById('admin-logs-box'),
  refreshLogsBtn: document.getElementById('btn-refresh-logs')
};

function showFeedback(message, isError = false) {
  els.feedbackBanner.textContent = message;
  els.feedbackBanner.className = `feedback-banner ${isError ? 'error' : 'success'}`;
  els.feedbackBanner.hidden = false;
}

function hideFeedback() {
  els.feedbackBanner.hidden = true;
}

function updateCounts(counts) {
  if (!counts) return;
  els.countPending.textContent = counts.PENDING ?? 0;
  els.countApproved.textContent = counts.APPROVED ?? 0;
  els.countDeclined.textContent = counts.DECLINED ?? 0;
  els.countAll.textContent = counts.ALL ?? 0;
}

function renderQueueList() {
  els.queueList.innerHTML = '';

  if (state.levels.length === 0) {
    els.queueList.innerHTML = `
      <div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem; text-align: center;">
        No levels found in "${state.activeStatusFilter}" status.
      </div>
    `;
    return;
  }

  for (const lvl of state.levels) {
    const card = document.createElement('div');
    const isSelected = state.selectedLevel && state.selectedLevel.id === lvl.id;
    card.className = `queue-item-card ${isSelected ? 'active' : ''}`;

    const header = document.createElement('div');
    header.className = 'queue-item-header';

    const title = document.createElement('span');
    title.className = 'queue-item-title';
    title.textContent = `#${lvl.id} ${lvl.name}`;

    const badge = document.createElement('span');
    badge.className = `status-pill status-${lvl.status.toLowerCase()}`;
    badge.style.fontSize = '0.7rem';
    badge.style.padding = '0.15rem 0.55rem';
    badge.textContent = lvl.status;

    header.appendChild(title);
    header.appendChild(badge);

    const meta = document.createElement('div');
    meta.className = 'queue-item-meta';
    const creatorSpan = document.createElement('span');
    creatorSpan.textContent = `By ${lvl.username || 'Anonymous'} (${lvl.country || 'Unspecified'})`;
    const dateSpan = document.createElement('span');
    dateSpan.textContent = new Date(lvl.createdAt).toLocaleDateString();

    meta.appendChild(creatorSpan);
    meta.appendChild(dateSpan);

    card.appendChild(header);
    card.appendChild(meta);

    card.addEventListener('click', () => {
      selectLevel(lvl);
    });

    els.queueList.appendChild(card);
  }
}

function selectLevel(lvl) {
  state.selectedLevel = lvl;
  renderQueueList();

  if (!lvl) {
    els.emptySelectionPanel.hidden = false;
    els.inspectorPanel.hidden = true;
    els.previewPanel.hidden = true;
    return;
  }

  els.emptySelectionPanel.hidden = true;
  els.inspectorPanel.hidden = false;
  els.previewPanel.hidden = false;

  els.inspectId.textContent = lvl.id;
  const statusUrl = `/status.html?token=${encodeURIComponent(lvl.statusToken)}`;
  els.inspectStatusLink.href = statusUrl;
  els.inspectStatusLink.textContent = statusUrl;

  els.inspectStatusBadge.textContent = lvl.status;
  els.inspectStatusBadge.className = `status-pill status-${lvl.status.toLowerCase()}`;

  els.editName.value = lvl.name || '';
  els.editUsername.value = lvl.username || 'Anonymous';
  els.editDesc.value = lvl.description || '';
  els.editDeclineReason.value = lvl.declineReason || '';

  els.inspectCountry.textContent = lvl.country || 'Unspecified';
  els.inspectCreated.textContent = new Date(lvl.createdAt).toLocaleString();
  els.inspectSeed.textContent = lvl.parameters?.seed ?? 'N/A';

  renderLevelToCanvas(els.canvas, lvl.levelData, state.renderOptions);
  updatePreviewStats(lvl.levelData);
}

function updatePreviewStats(levelData) {
  if (!levelData) return;
  const { gridSpecs, stats, palette } = levelData;
  els.statsBar.innerHTML = `
    <div class="stat-chip"><strong>Grid:</strong> ${gridSpecs.totalWidthTiles}×${gridSpecs.totalHeightTiles} tiles (${gridSpecs.screens} screens)</div>
    <div class="stat-chip"><strong>Palette:</strong> ${palette.name}</div>
    <div class="stat-chip"><strong>Platforms:</strong> ${stats.totalPlatforms}</div>
    <div class="stat-chip"><strong>Lucky Blocks:</strong> ${stats.totalInteracting} (🪙${stats.giftDistribution.COIN} / ❤️${stats.giftDistribution.EXTRA_LIFE} / ⭐${stats.giftDistribution.INVINCIBILITY})</div>
    <div class="stat-chip ${stats.allPlatformsReachable ? 'ok' : 'warn'}">
      <strong>Reachability:</strong> ${stats.allPlatformsReachable ? '100% Verified' : stats.reachableSurfaceRatio}
    </div>
  `;
}

async function loadQueue() {
  try {
    const data = await fetchAdminLevels(state.apiKey, state.activeStatusFilter);
    updateCounts(data.counts);
    state.levels = data.levels || [];

    if (state.selectedLevel) {
      const updatedMatch = state.levels.find((l) => l.id === state.selectedLevel.id);
      selectLevel(updatedMatch || state.levels[0] || null);
    } else if (state.levels.length > 0) {
      selectLevel(state.levels[0]);
    } else {
      selectLevel(null);
    }
  } catch (err) {
    showFeedback(err.message, true);
  }
}

async function loadLogs() {
  try {
    const { logs } = await fetchAdminLogs(state.apiKey);
    els.logsBox.innerHTML = '';
    if (!logs || logs.length === 0) {
      els.logsBox.textContent = 'No logs recorded yet.';
      return;
    }
    for (const entry of logs) {
      const div = document.createElement('div');
      div.className = 'log-entry';
      const ts = new Date(entry.createdAt).toLocaleTimeString();
      const metaStr = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
      div.textContent = `[${ts}] ${entry.level.toUpperCase()}: ${entry.message}${metaStr}`;
      els.logsBox.appendChild(div);
    }
  } catch (err) {
    els.logsBox.textContent = `Could not load logs: ${err.message}`;
  }
}

async function performModerationAction(targetStatus) {
  if (!state.selectedLevel) return;
  hideFeedback();

  const payload = {
    name: els.editName.value.trim(),
    username: els.editUsername.value.trim(),
    description: els.editDesc.value.trim(),
    status: targetStatus,
    declineReason: els.editDeclineReason.value.trim()
  };

  try {
    const res = await updateAdminLevel(state.apiKey, state.selectedLevel.id, payload);
    showFeedback(res.message, false);
    await Promise.all([loadQueue(), loadLogs()]);
  } catch (err) {
    showFeedback(err.message, true);
  }
}

function setupTurnstileIfActive(securityCfg) {
  if (!securityCfg || !securityCfg.turnstileActive || !securityCfg.turnstileSiteKey) {
    return;
  }

  els.turnstileWrapper.hidden = false;

  window.onAdminTurnstileLoadCallback = () => {
    if (!window.turnstile) return;
    state.turnstileWidgetId = window.turnstile.render('#admin-turnstile-widget', {
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
    'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onAdminTurnstileLoadCallback&render=explicit';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

function resetTurnstileWidget() {
  if (state.security?.turnstileActive && window.turnstile && state.turnstileWidgetId !== null) {
    state.turnstileToken = null;
    window.turnstile.reset(state.turnstileWidgetId);
  }
}

async function authenticateAndEnter(apiKey) {
  els.loginError.hidden = true;

  if (state.security?.turnstileActive && !state.turnstileToken) {
    els.loginError.textContent = 'Please complete the Cloudflare Turnstile security check first.';
    els.loginError.hidden = false;
    return;
  }

  if (els.loginBtn) {
    els.loginBtn.disabled = true;
  }

  try {
    const verifyData = await verifyAdminKey(apiKey, state.turnstileToken);
    state.apiKey = apiKey;
    sessionStorage.setItem(STORAGE_KEY, apiKey);

    els.loginView.hidden = true;
    els.workspace.hidden = false;
    els.logoutBtn.hidden = false;

    updateCounts(verifyData.counts);
    await Promise.all([loadQueue(), loadLogs()]);
  } catch (err) {
    sessionStorage.removeItem(STORAGE_KEY);
    els.loginView.hidden = false;
    els.workspace.hidden = true;
    els.logoutBtn.hidden = true;
    els.loginError.textContent = err.message;
    els.loginError.hidden = false;
  } finally {
    resetTurnstileWidget();
    if (els.loginBtn) {
      els.loginBtn.disabled = false;
    }
  }
}

async function resumeExistingSession(apiKey) {
  try {
    els.loginError.hidden = true;
    const data = await fetchAdminLevels(apiKey, state.activeStatusFilter);
    state.apiKey = apiKey;

    els.loginView.hidden = true;
    els.workspace.hidden = false;
    els.logoutBtn.hidden = false;

    updateCounts(data.counts);
    state.levels = data.levels || [];
    selectLevel(state.levels[0] || null);
    await loadLogs();
  } catch (err) {
    sessionStorage.removeItem(STORAGE_KEY);
    state.apiKey = '';
    els.loginView.hidden = false;
    els.workspace.hidden = true;
    els.logoutBtn.hidden = true;
  }
}

async function initAdminApp() {
  try {
    const config = await fetchParameterConfig();
    state.security = config.security || null;
    setupTurnstileIfActive(state.security);
  } catch (err) {
    // Non-fatal if config fails to load; backend still enforces security
  }

  els.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = els.apiKeyInput.value.trim();
    if (!key) return;
    await authenticateAndEnter(key);
  });

  els.logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem(STORAGE_KEY);
    state.apiKey = '';
    state.selectedLevel = null;
    els.apiKeyInput.value = '';
    resetTurnstileWidget();
    els.loginView.hidden = false;
    els.workspace.hidden = true;
    els.logoutBtn.hidden = true;
  });

  document.querySelectorAll('.admin-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeStatusFilter = btn.dataset.status;
      state.selectedLevel = null;
      hideFeedback();
      loadQueue();
    });
  });

  els.refreshQueueBtn.addEventListener('click', () => {
    hideFeedback();
    loadQueue();
  });

  els.refreshLogsBtn.addEventListener('click', loadLogs);

  els.approveBtn.addEventListener('click', () => performModerationAction('APPROVED'));
  els.declineBtn.addEventListener('click', () => performModerationAction('DECLINED'));
  els.saveEditsBtn.addEventListener('click', () => {
    if (!state.selectedLevel) return;
    performModerationAction(state.selectedLevel.status);
  });

  els.toggleGrid.addEventListener('change', (e) => {
    state.renderOptions.showGrid = e.target.checked;
    if (state.selectedLevel) {
      renderLevelToCanvas(els.canvas, state.selectedLevel.levelData, state.renderOptions);
    }
  });
  els.toggleScreens.addEventListener('change', (e) => {
    state.renderOptions.showScreenDividers = e.target.checked;
    if (state.selectedLevel) {
      renderLevelToCanvas(els.canvas, state.selectedLevel.levelData, state.renderOptions);
    }
  });
  els.toggleGifts.addEventListener('change', (e) => {
    state.renderOptions.showGiftIcons = e.target.checked;
    if (state.selectedLevel) {
      renderLevelToCanvas(els.canvas, state.selectedLevel.levelData, state.renderOptions);
    }
  });

  // Auto-resume if session key exists in current browser tab
  if (state.apiKey) {
    resumeExistingSession(state.apiKey);
  }
}

initAdminApp();
