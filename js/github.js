/* =============================================
   GitHub Sync Module
   Handles GitHub repository synchronization
   ============================================= */

window.App = window.App || {};

window.App.getGithubConfig = function() {
  const s        = window.App.state.settings;
  const token    = s?.githubToken?.trim();
  const repo     = s?.githubRepo?.trim();
  const branch   = s?.githubBranch?.trim()   || 'main';
  const filePath = s?.githubFilePath?.trim() || 'academia_data.json';
  if (!token || !repo) return null;
  return { token, repo, branch, filePath };
};

function githubApiHeaders(token) {
  return {
    'Authorization':       `token ${token}`,
    'Accept':              'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type':        'application/json',
  };
}

// --- Crypto helpers (AES-256-GCM + PBKDF2) ---

// Derive an AES-GCM key from a token string and a random salt
async function deriveKey(token, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(token),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt state JSON and return base64 string: [salt(16)][iv(12)][ciphertext]
async function stateToEncryptedContent(token) {
  const safe = Object.assign({}, window.App.state, {
    settings: Object.assign({}, window.App.state.settings, {
      githubToken:  '',   // never stored remotely
      gcalClientId: '',   // OAuth client ID stays local
    }),
  });
  const json  = JSON.stringify(safe, null, 2);
  const salt  = crypto.getRandomValues(new Uint8Array(16));
  const iv    = crypto.getRandomValues(new Uint8Array(12));
  const key   = await deriveKey(token, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(json)
  );
  const combined = new Uint8Array(16 + 12 + cipher.byteLength);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(new Uint8Array(cipher), 28);
  let binary = '';
  combined.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

// Decrypt base64 content from GitHub; falls back to plain base64-JSON for
// files created before encryption was introduced.
async function contentToObj(b64, token) {
  const raw = b64.replace(/\n/g, '');
  try {
    const binary = atob(raw);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const salt       = bytes.slice(0, 16);
    const iv         = bytes.slice(16, 28);
    const ciphertext = bytes.slice(28);
    const key        = await deriveKey(token, salt);
    const decrypted  = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (_) {
    // Fallback: file was stored without encryption (plain base64 JSON)
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  }
}

window.App.setGithubStatusUI = function(status) {
  window.App.setGithubStatus(status);
  const dot = document.getElementById('github-sync-dot');
  if (!dot) return;
  dot.className = `github-sync-dot ${status}`;
  const labels = {
    unconfigured: window.App.MESSAGES.githubUnconfiguredStatus,
    ok:      `Sincronizado${window.App.githubLastSync ? ' ' + window.App.githubLastSync.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : ''}`,
    pending: window.App.MESSAGES.githubPending,
    syncing: window.App.MESSAGES.githubSyncing,
    error:   window.App.MESSAGES.githubError,
  };
  dot.title = labels[status] || status;
  // Update settings modal indicator if open
  const settingsDot   = document.getElementById('settings-github-dot');
  const settingsLabel = document.getElementById('settings-github-label');
  if (settingsDot)   settingsDot.className    = 'gcal-dot ' + (status === 'ok' ? 'connected' : 'disconnected');
  if (settingsLabel) settingsLabel.textContent = labels[status] || status;
};

// Pull remote state from GitHub and reconcile with local
window.App.githubPull = async function() {
  const cfg = window.App.getGithubConfig();
  if (!cfg) return false;

  window.App.setGithubStatusUI('syncing');
  try {
    const filePath = cfg.filePath.split('/').map(encodeURIComponent).join('/');
    const url = `https://api.github.com/repos/${cfg.repo}/contents/${filePath}?ref=${encodeURIComponent(cfg.branch)}`;
    const res = await fetch(url, { headers: githubApiHeaders(cfg.token) });

    if (res.status === 404) {
      // File not yet in repo — first run, local state is the source of truth
      window.App.setGithubFileSha(null);
      window.App.setGithubStatusUI('ok');
      return true;
    }
    if (res.status === 401 || res.status === 403) {
      window.App.setGithubStatusUI('error');
      window.App.showToast(window.App.MESSAGES.errorGithubAccess, 'error');
      return false;
    }
    if (!res.ok) {
      window.App.setGithubStatusUI('error');
      window.App.showToast(`GitHub pull error ${res.status}`, 'error');
      return false;
    }

    const data = await res.json();
    window.App.setGithubFileSha(data.sha);
    const remote = await contentToObj(data.content, cfg.token);
    reconcileWithRemote(remote);
    return true;
  } catch (e) {
    window.App.setGithubStatusUI('error');
    return false;
  }
};

// Merge remote state into local according to timestamps
function reconcileWithRemote(remote) {
  if (!remote || typeof remote !== 'object') return;

  const localTs  = window.App.state.lastModified  ? new Date(window.App.state.lastModified).getTime()  : 0;
  const remoteTs = remote.lastModified ? new Date(remote.lastModified).getTime() : 0;

  if (remoteTs > localTs) {
    // Remote is newer — adopt it, but keep local GitHub credentials
    const localGhCreds = {
      githubToken:    window.App.state.settings?.githubToken    || '',
      githubRepo:     window.App.state.settings?.githubRepo     || '',
      githubBranch:   window.App.state.settings?.githubBranch   || 'main',
      githubFilePath: window.App.state.settings?.githubFilePath || 'academia_data.json',
    };
    window.App.state.courses        = Array.isArray(remote.courses)  ? remote.courses  : [];
    window.App.state.students       = Array.isArray(remote.students) ? remote.students : [];
    window.App.state.classes        = Array.isArray(remote.classes)  ? remote.classes  : [];
    window.App.state.receiptCounter = remote.receiptCounter || 0;
    window.App.state.lastModified   = remote.lastModified;
    window.App.state.settings       = Object.assign({}, remote.settings || {}, localGhCreds);
    // Ensure compat fields
    window.App.state.students.forEach(s => { if (!Array.isArray(s.receipts)) s.receipts = []; });
    window.App.saveLocalOnly();
    window.App.renderAll();
    window.App.showToast(window.App.MESSAGES.githubPullOk, 'success');
  } else {
    // Local is same age or newer — merge in any remote-only records
    const localCourseIds  = new Set((window.App.state.courses  || []).map(c  => c.id));
    const localStudentIds = new Set((window.App.state.students || []).map(s  => s.id));
    const localClassIds   = new Set((window.App.state.classes  || []).map(cl => cl.id));
    let changed = false;
    (remote.courses  || []).forEach(c  => { if (!localCourseIds.has(c.id))  { window.App.state.courses.push(c);  changed = true; } });
    (remote.students || []).forEach(s  => {
      if (!localStudentIds.has(s.id)) {
        if (!s.receipts) s.receipts = [];
        window.App.state.students.push(s);
        changed = true;
      }
    });
    (remote.classes  || []).forEach(cl => { if (!localClassIds.has(cl.id))  { window.App.state.classes.push(cl); changed = true; } });
    window.App.state.receiptCounter = Math.max(window.App.state.receiptCounter || 0, remote.receiptCounter || 0);
    if (changed) {
      window.App.saveLocalOnly();
      window.App.renderAll();
      window.App.showToast(window.App.MESSAGES.remoteChangesMerged, 'success');
    }
    // Local is newer or equal — push our version to GitHub
    window.App.scheduleGithubPush();
  }
  window.App.setGithubStatusUI('ok');
}

// Schedule a debounced push (2 s after last saveState)
window.App.scheduleGithubPush = function() {
  if (!window.App.getGithubConfig()) return;
  window.App.setGithubStatusUI('pending');
  clearTimeout(window.App.githubSyncTimer);
  window.App.setGithubSyncTimer(setTimeout(window.App.githubPush, 2000));
};

// Push current state to GitHub
window.App.githubPush = async function(retry) {
  const cfg = window.App.getGithubConfig();
  if (!cfg || window.App.githubSyncing) return;

  window.App.setGithubSyncing(true);
  window.App.setGithubStatusUI('syncing');

  // If we don't have the SHA, get it first
  if (!window.App.githubFileSha && !retry) {
    const pulled = await window.App.githubPull();
    if (!pulled) {
      window.App.setGithubSyncing(false);
      return;
    }
  }

  try {
    const content = await stateToEncryptedContent(cfg.token);
    const body    = {
      message: `sync ${new Date().toLocaleString('es')}`,
      content,
    };
    if (window.App.githubFileSha) body.sha = window.App.githubFileSha;

    const filePath = cfg.filePath.split('/').map(encodeURIComponent).join('/');
    const url = `https://api.github.com/repos/${cfg.repo}/contents/${filePath}`;
    const res = await fetch(url, {
      method:  'PUT',
      headers: githubApiHeaders(cfg.token),
      body:    JSON.stringify(body),
    });

    if (res.status === 409 && !retry) {
      // SHA mismatch: another device pushed first — pull, reconcile, then push again
      window.App.setGithubSyncing(false);
      const pulled = await window.App.githubPull();
      if (pulled) await window.App.githubPush(true);
      return;
    }
    if (res.status === 401 || res.status === 403) {
      window.App.setGithubSyncing(false);
      window.App.setGithubStatusUI('error');
      const errBody = await res.json().catch(() => ({}));
      console.error(`GitHub push ${res.status}:`, errBody);
      const hint = errBody.message ? ` (${errBody.message})` : '';
      window.App.showToast(window.App.MESSAGES.errorGithubAccess + hint, 'error');
      return;
    }
    if (!res.ok) {
      window.App.setGithubSyncing(false);
      window.App.setGithubStatusUI('error');
      const errorData = await res.json().catch(() => ({}));
      console.error('GitHub push error:', res.status, errorData);
      const msg = errorData.message || `GitHub push error ${res.status}`;
      window.App.showToast(msg, 'error');
      return;
    }

    const data = await res.json();
    window.App.setGithubFileSha(data.content?.sha || window.App.githubFileSha);
    window.App.setGithubSyncing(false);
    window.App.setGithubLastSync(new Date());
    window.App.setGithubStatusUI('ok');
  } catch (e) {
    window.App.setGithubSyncing(false);
    window.App.setGithubStatusUI('error');
  }
};

// Manual sync triggered by the header button
window.App.manualGithubSync = async function() {
  const cfg = window.App.getGithubConfig();
  if (!cfg) {
    window.App.showToast(window.App.MESSAGES.githubUnconfigured, 'error');
    return;
  }
  await window.App.githubPull();
};

// Connection test triggered from settings modal
window.App.testGithubConnection = async function() {
  const token    = document.getElementById('settings-gh-token').value.trim();
  const repo     = document.getElementById('settings-gh-repo').value.trim();
  const branch   = document.getElementById('settings-gh-branch').value.trim() || 'main';
  const filePath = (document.getElementById('settings-gh-path').value.trim() || 'academia_data.json')
    .split('/').map(encodeURIComponent).join('/');

  if (!token || !repo) {
    window.App.showToast('Introduce token y repositorio', 'error');
    return;
  }

  const settingsLabel = document.getElementById('settings-github-label');
  const settingsDot   = document.getElementById('settings-github-dot');
  if (settingsLabel) settingsLabel.textContent = window.App.MESSAGES.checking;

  try {
    const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, { headers: githubApiHeaders(token) });
    if (res.status === 200 || res.status === 404) {
      if (settingsLabel) settingsLabel.textContent = res.status === 200 ? 'Conexión OK ✓' : window.App.MESSAGES.githubRepoFound;
      if (settingsDot)   settingsDot.className = 'gcal-dot connected';
      window.App.showToast(window.App.MESSAGES.githubConnectionOk, 'success');
    } else if (res.status === 401 || res.status === 403) {
      if (settingsLabel) settingsLabel.textContent = 'Acceso denegado';
      if (settingsDot)   settingsDot.className = 'gcal-dot disconnected';
      window.App.showToast(window.App.MESSAGES.errorGithubToken, 'error');
    } else {
      if (settingsLabel) settingsLabel.textContent = `Error ${res.status}`;
      window.App.showToast(`GitHub error ${res.status}`, 'error');
    }
  } catch (e) {
    if (settingsLabel) settingsLabel.textContent = 'Error de red';
    window.App.showToast(window.App.MESSAGES.errorGithubConnection, 'error');
  }
};

// Initialize GitHub status
window.App.initGithubStatus = function() {
  const cfg = window.App.getGithubConfig();
  window.App.setGithubStatusUI(cfg ? 'pending' : 'unconfigured');
};
