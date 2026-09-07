import { ProxyManager } from './modules/proxy-manager.js';
import { handleAuthRequired, markAuthenticationFailure } from './modules/auth.js';
import { loadState, patchState } from './modules/storage.js';

const manager = new ProxyManager();
let rotateTimeout = null;
let rotationInProgress = false;

async function getTargetTabs(state) {
  state = state || await manager.getState();
  if (state.targetTabIds?.length) {
    const tabs = await chrome.tabs.query({});
    return tabs.filter((tab) => state.targetTabIds.includes(tab.id));
  }
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return active ? [active] : [];
}

async function reloadTargetTabs() {
  const tabs = await getTargetTabs();
  await Promise.all(tabs.filter((tab) => tab.id).map(async (tab) => {
    try { await chrome.tabs.reload(tab.id, { bypassCache: false }); }
    catch (_error) { /* Chrome pages and restricted tabs cannot be reloaded by extensions. */ }
  }));
}

async function rotateOnce() {
  if (rotationInProgress) return;
  const state = await manager.getState();
  if (!state.autoRotate || !state.proxies.length) return;
  rotationInProgress = true;
  try {
    await manager.switchToNext();
    await reloadTargetTabs();
  } catch (error) {
    await patchState({ status: 'ERROR', currentError: error.message || 'CONNECTION FAILED' });
  } finally {
    rotationInProgress = false;
  }
}

async function scheduleAfterLoad(tabId) {
  if (rotateTimeout) clearTimeout(rotateTimeout);
  rotateTimeout = setTimeout(async () => {
    rotateTimeout = null;
    const state = await manager.getState();
    const targets = await getTargetTabs(state);
    if (state.autoRotate && targets.some((tab) => tab.id === tabId)) await rotateOnce();
  }, 1000);
}

function stopAutoRotate() {
  if (rotateTimeout) clearTimeout(rotateTimeout);
  rotateTimeout = null;
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'switch-proxy') return;
  try { await manager.switchToNext(); await reloadTargetTabs(); }
  catch (error) { await patchState({ status: 'ERROR', currentError: error.message || 'CONNECTION FAILED' }); }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  const state = await manager.getState();
  if (!state.autoRotate) return;
  const targets = await getTargetTabs(state);
  if (targets.some((tab) => tab.id === tabId)) await scheduleAfterLoad(tabId);
});

chrome.webRequest.onAuthRequired.addListener(
  (details, callback) => { handleAuthRequired(details, callback).catch(() => callback()); },
  { urls: ['<all_urls>'] },
  ['asyncBlocking']
);

chrome.webRequest.onErrorOccurred.addListener(async (details) => {
  if (details.isProxy && details.error?.toLowerCase().includes('auth')) await markAuthenticationFailure(details);
}, { urls: ['<all_urls>'] });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'get-state': return manager.getState();
      case 'connect': {
        const result = await manager.connect(message.index);
        await reloadTargetTabs();
        return result;
      }
      case 'disconnect': return manager.disconnect();
      case 'switch-next': {
        const result = await manager.switchToNext();
        await reloadTargetTabs();
        return result;
      }
      case 'add-proxies': return manager.addProxies(message.proxies || []);
      case 'remove-proxy': return manager.removeProxy(message.id);
      case 'clear-proxies': return manager.clearProxies();
      case 'update-settings': {
        const patch = message.patch || {};
        const next = await patchState(patch);
        if (Object.prototype.hasOwnProperty.call(patch, 'autoRotate')) {
          if (next.autoRotate) {
            const tabs = await getTargetTabs(next);
            const readyTab = tabs.find((tab) => tab.status === 'complete');
            if (readyTab?.id) await scheduleAfterLoad(readyTab.id);
          }
          else stopAutoRotate();
        }
        return next;
      }
      default: throw new Error('Unknown message');
    }
  })().then(sendResponse).catch((error) => sendResponse({ error: error.message || 'Unexpected error' }));
  return true;
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await loadState();
  if (state.autoRotate) {
    const tabs = await getTargetTabs(state);
    const readyTab = tabs.find((tab) => tab.status === 'complete');
    if (readyTab?.id) await scheduleAfterLoad(readyTab.id);
  }
  if (state.autoConnectOnStartup && state.proxies.length && state.currentIndex >= 0) {
    try { await manager.connect(state.currentIndex); }
    catch (error) { await patchState({ status: 'ERROR', currentError: 'CONNECTION FAILED' }); }
  } else {
    await patchState({ status: 'DISCONNECTED' });
  }
});
