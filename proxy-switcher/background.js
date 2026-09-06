import { ProxyManager } from './modules/proxy-manager.js';
import { handleAuthRequired, markAuthenticationFailure } from './modules/auth.js';
import { loadState, patchState } from './modules/storage.js';

const manager = new ProxyManager();

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'switch-proxy') return;
  try { await manager.switchToNext(); }
  catch (error) { await patchState({ status: 'ERROR', currentError: error.message || 'CONNECTION FAILED' }); }
});

chrome.webRequest.onAuthRequired.addListener(
  (details, callback) => { handleAuthRequired(details, callback).catch(() => callback()); },
  { urls: ['<all_urls>'] },
  ['asyncBlocking']
);

chrome.webRequest.onErrorOccurred.addListener(async (details) => {
  if (details.isProxy && details.error?.toLowerCase().includes('auth')) await markAuthenticationFailure(details);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'get-state': return manager.getState();
      case 'connect': return manager.connect(message.index);
      case 'disconnect': return manager.disconnect();
      case 'switch-next': return manager.switchToNext();
      case 'add-proxies': return manager.addProxies(message.proxies || []);
      case 'remove-proxy': return manager.removeProxy(message.id);
      case 'clear-proxies': return manager.clearProxies();
      case 'update-settings': return patchState(message.patch || {});
      default: throw new Error('Unknown message');
    }
  })().then(sendResponse).catch((error) => sendResponse({ error: error.message || 'Unexpected error' }));
  return true;
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await loadState();
  if (state.autoConnectOnStartup && state.proxies.length && state.currentIndex >= 0) {
    try { await manager.connect(state.currentIndex); }
    catch (error) { await patchState({ status: 'ERROR', currentError: 'CONNECTION FAILED' }); }
  } else {
    await patchState({ status: 'DISCONNECTED' });
  }
});
