import { ProxyManager } from './modules/proxy-manager.js';
import { handleAuthRequired, markAuthenticationFailure } from './modules/auth.js';
import { loadState, patchState } from './modules/storage.js';

const manager = new ProxyManager();
const ROTATE_ALARM = 'auto-rotate-watchdog';
let rotateTimer = null;
let rotationInProgress = false;

async function reloadActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab?.id) return;
  try { await chrome.tabs.reload(tab.id, { bypassCache: false }); }
  catch (_error) { /* Chrome pages and restricted tabs cannot be reloaded by extensions. */ }
}

async function rotateOnce() {
  if (rotationInProgress) return;
  const state = await manager.getState();
  if (!state.autoRotate || !state.proxies.length) return;
  rotationInProgress = true;
  try {
    await manager.switchToNext();
    await reloadActiveTab();
  } catch (error) {
    await patchState({ status: 'ERROR', currentError: error.message || 'CONNECTION FAILED' });
  } finally {
    rotationInProgress = false;
  }
}

function startAutoRotate() {
  if (!rotateTimer) rotateTimer = setInterval(() => rotateOnce(), 5000);
  chrome.alarms.create(ROTATE_ALARM, { periodInMinutes: 0.5 });
}

function stopAutoRotate() {
  if (rotateTimer) clearInterval(rotateTimer);
  rotateTimer = null;
  chrome.alarms.clear(ROTATE_ALARM);
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'switch-proxy') return;
  try { await manager.switchToNext(); await reloadActiveTab(); }
  catch (error) { await patchState({ status: 'ERROR', currentError: error.message || 'CONNECTION FAILED' }); }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ROTATE_ALARM) return;
  const state = await manager.getState();
  if (state.autoRotate) startAutoRotate();
  else stopAutoRotate();
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
        await reloadActiveTab();
        return result;
      }
      case 'disconnect': return manager.disconnect();
      case 'switch-next': {
        const result = await manager.switchToNext();
        await reloadActiveTab();
        return result;
      }
      case 'add-proxies': return manager.addProxies(message.proxies || []);
      case 'remove-proxy': return manager.removeProxy(message.id);
      case 'clear-proxies': return manager.clearProxies();
      case 'update-settings': {
        const patch = message.patch || {};
        const next = await patchState(patch);
        if (Object.prototype.hasOwnProperty.call(patch, 'autoRotate')) {
          if (next.autoRotate) startAutoRotate();
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
  if (state.autoRotate) startAutoRotate();
  if (state.autoConnectOnStartup && state.proxies.length && state.currentIndex >= 0) {
    try { await manager.connect(state.currentIndex); }
    catch (error) { await patchState({ status: 'ERROR', currentError: 'CONNECTION FAILED' }); }
  } else {
    await patchState({ status: 'DISCONNECTED' });
  }
});
