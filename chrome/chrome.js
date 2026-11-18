(() => {
  'use strict';
  const config = window.ORBIT_CHROME || {};
  const $ = id => document.getElementById(id);
  const store = $('store-link'), pending = $('store-pending');
  const indicator = $('install-indicator'), status = $('install-status');
  const workspaceLinks = [$('workspace-link'), $('setup-link')];
  const params = new URLSearchParams(location.search);
  const validId = id => typeof id === 'string' && /^[a-p]{32}$/.test(id);
  const validateStore = url => {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' &&
        ['chromewebstore.google.com','chrome.google.com'].includes(u.hostname) &&
        (u.pathname.startsWith('/detail/') || u.pathname.startsWith('/webstore/detail/'));
    } catch { return false; }
  };
  const storeUrl = config.storeUrl || '';
  if (validateStore(storeUrl)) {
    store.href = storeUrl;
    store.hidden = false;
    pending.hidden = true;
  }
  let extensionId = null;
  try {
    const requested = params.get('extensionId');
    const stored = sessionStorage.getItem('orbit_verified_chrome_id');
    extensionId = validId(requested) ? requested :
      validId(config.storeExtensionId) ? config.storeExtensionId :
        validId(stored) ? stored : null;
  } catch {
    extensionId = validId(params.get('extensionId')) ? params.get('extensionId') : null;
  }
  let busy = false;
  function setStatus(kind, text) {
    status.textContent = text;
    indicator.className = 'indicator ' + (kind || '');
  }
  const trustedWorkspace = () => {
    try {
      const u = new URL(config.privateBetaWorkspace);
      return u.protocol === 'https:' && u.hostname === 'extension-beta-backend-staging.up.railway.app' &&
        u.pathname === '/extension-beta' ? u : null;
    } catch { return null; }
  };
  function setWorkspaceLink(verifiedId) {
    const u = trustedWorkspace();
    if (!u) {
      workspaceLinks.forEach(link => { link.removeAttribute('href'); link.setAttribute('aria-disabled','true'); });
      return;
    }
    if (verifiedId) {
      u.searchParams.set('extensionId', verifiedId);
      u.searchParams.set('source', 'orbit-chrome');
    }
    workspaceLinks.forEach(link => { link.href = u.href; link.removeAttribute('aria-disabled'); });
  }
  setWorkspaceLink(null);

  async function ping(id) {
    return new Promise(resolve => {
      if (!validId(id) || !window.chrome?.runtime?.sendMessage) return resolve(false);
      let settled = false;
      const finish = answer => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(answer);
      };
      const timer = setTimeout(() => finish(false), 1600);
      try {
        chrome.runtime.sendMessage(id, { type:'orbit-installed-ping' }, response => {
          if (chrome.runtime.lastError) return finish(false);
          finish(response?.installed === true && response?.extensionId === id);
        });
      } catch { finish(false); }
    });
  }
  async function checkInstalled() {
    if (busy) return;
    busy = true;
    $('check-extension').disabled = true;
    setStatus('reconnecting','Checking Chrome for Orbit…');
    try {
      const found = await ping(extensionId);
      if (found) {
        setStatus('ready','Orbit Extension installed');
        setWorkspaceLink(extensionId);
        try { sessionStorage.setItem('orbit_verified_chrome_id', extensionId); } catch {}
      } else {
        setStatus('', extensionId ? 'Extension not detected. Open it and try again.' :
          'Install from the Store or open this page from Orbit Extension.');
        setWorkspaceLink(null);
      }
    } finally {
      busy = false;
      $('check-extension').disabled = false;
    }
  }
  $('check-extension').addEventListener('click', checkInstalled);
  void checkInstalled();
  window.addEventListener('focus', () => { if (!document.hidden) void checkInstalled(); });
})();