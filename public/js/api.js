/**
 * API Client module for communicating with the Node/Express backend.
 */

export async function fetchParameterConfig() {
  const res = await fetch('/api/config/parameters');
  if (!res.ok) {
    throw new Error('Failed to load engine parameter configuration.');
  }
  return res.json();
}

export async function requestLevelPreview(parameters) {
  const res = await fetch('/api/levels/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parameters)
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data.details ? data.details.join(' ') : data.error || 'Preview generation failed';
    throw new Error(errMsg);
  }
  return data;
}

function getCreatorClientId() {
  const key = 'retro_engine_creator_client_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem(key, id);
  }
  return id;
}

export async function fetchPowChallenge() {
  const res = await fetch('/api/config/pow-challenge');
  if (!res.ok) {
    throw new Error('Failed to fetch Proof-of-Work challenge.');
  }
  return res.json();
}

/**
 * Solves a SHA-256 Proof-of-Work challenge in the browser using Web Crypto API.
 */
export async function solvePowChallenge(challenge, difficulty) {
  const prefix = '0'.repeat(difficulty);
  const encoder = new TextEncoder();
  let nonce = 0;

  while (true) {
    const inputBytes = encoder.encode(`${challenge}:${nonce}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', inputBytes);
    const hashArray = new Uint8Array(hashBuffer);

    // Convert only the needed leading bytes to hex for fast checking
    let hex = '';
    const bytesNeeded = Math.ceil(difficulty / 2);
    for (let i = 0; i < bytesNeeded; i++) {
      hex += hashArray[i].toString(16).padStart(2, '0');
    }

    if (hex.startsWith(prefix)) {
      return nonce;
    }
    nonce++;
  }
}

export async function submitLevel(parameters, metadata, security = {}) {
  const res = await fetch('/api/levels', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Creator-Client-Id': getCreatorClientId()
    },
    body: JSON.stringify({ parameters, metadata, security })
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data.details ? data.details.join(' ') : data.error || 'Submission failed';
    throw new Error(errMsg);
  }
  return data;
}

export async function fetchLevelStatus(token) {
  const res = await fetch(`/api/levels/status/${encodeURIComponent(token)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Could not load level status.');
  }
  return data;
}

/**
 * Admin API helpers (authenticated with X-Admin-Api-Key header)
 */
export async function verifyAdminKey(apiKey) {
  const res = await fetch('/api/admin/verify', {
    headers: { 'X-Admin-Api-Key': apiKey }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Admin authentication failed.');
  }
  return data;
}

export async function fetchAdminLevels(apiKey, status = 'PENDING') {
  const res = await fetch(`/api/admin/levels?status=${encodeURIComponent(status)}`, {
    headers: { 'X-Admin-Api-Key': apiKey }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load admin level queue.');
  }
  return data;
}

export async function updateAdminLevel(apiKey, levelId, payload) {
  const res = await fetch(`/api/admin/levels/${encodeURIComponent(levelId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Api-Key': apiKey
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    const errMsg = data.details ? data.details.join(' ') : data.error || 'Moderation update failed';
    throw new Error(errMsg);
  }
  return data;
}

export async function fetchAdminLogs(apiKey) {
  const res = await fetch('/api/admin/logs', {
    headers: { 'X-Admin-Api-Key': apiKey }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load system logs.');
  }
  return data;
}

/**
 * Playable Levels & Gameplay API helpers
 */
export async function fetchPlayableLevels(filters = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') {
      params.set(k, v);
    }
  }
  const res = await fetch(`/api/levels/playable?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load playable levels.');
  }
  return data;
}

export async function fetchPlayableLevelById(levelId) {
  const res = await fetch(`/api/levels/playable/${encodeURIComponent(levelId)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load level.');
  }
  return data;
}

export async function recordLevelWin(levelId) {
  const res = await fetch(`/api/levels/playable/${encodeURIComponent(levelId)}/win`, {
    method: 'POST'
  });
  return res.json().catch(() => ({}));
}
