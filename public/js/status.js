import { fetchLevelStatus } from './api.js';
import { renderLevelToCanvas } from './renderer.js';

const els = {
  loadingBox: document.getElementById('status-loading'),
  errorBox: document.getElementById('status-error'),
  contentBox: document.getElementById('status-content'),
  badge: document.getElementById('status-badge'),
  levelName: document.getElementById('status-level-name'),
  levelDesc: document.getElementById('status-level-desc'),
  levelUsername: document.getElementById('status-level-username'),
  levelCountry: document.getElementById('status-level-country'),
  levelSubmittedAt: document.getElementById('status-submitted-at'),
  declineBox: document.getElementById('decline-reason-box'),
  declineText: document.getElementById('decline-reason-text'),
  canvas: document.getElementById('status-canvas'),
  refreshBtn: document.getElementById('btn-refresh-status')
};

async function loadStatus() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    els.loadingBox.hidden = true;
    els.errorBox.hidden = false;
    els.errorBox.textContent = 'No level status token provided in the URL.';
    return;
  }

  try {
    els.loadingBox.hidden = false;
    els.errorBox.hidden = true;
    const { level } = await fetchLevelStatus(token);

    els.loadingBox.hidden = true;
    els.contentBox.hidden = false;

    els.levelName.textContent = level.name;
    els.levelDesc.textContent = level.description;
    if (els.levelUsername) {
      els.levelUsername.textContent = level.username || 'Anonymous';
    }
    els.levelCountry.textContent = level.country || 'Unspecified';
    els.levelSubmittedAt.textContent = new Date(level.createdAt).toLocaleString();

    els.badge.textContent = level.status;
    els.badge.className = `status-pill status-${level.status.toLowerCase()}`;

    if (level.status === 'DECLINED' && level.declineReason) {
      els.declineBox.hidden = false;
      els.declineText.textContent = level.declineReason;
    } else {
      els.declineBox.hidden = true;
    }

    renderLevelToCanvas(els.canvas, level.levelData, {
      showGrid: false,
      showScreenDividers: true,
      showGiftIcons: true
    });
  } catch (err) {
    els.loadingBox.hidden = true;
    els.errorBox.hidden = false;
    els.errorBox.textContent = err.message;
  }
}

els.refreshBtn?.addEventListener('click', loadStatus);
loadStatus();
