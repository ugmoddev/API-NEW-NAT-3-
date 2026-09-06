import { loadState, patchState } from './storage.js';

export async function handleAuthRequired(details, callback) {
  if (!details.isProxy) return callback();
  const state = await loadState();
  const proxy = state.proxies[state.currentIndex];
  if (!proxy?.username) return callback();

  // Credentials remain in chrome.storage.local and are only supplied to Chrome
  // for the currently active proxy challenge.
  callback({ authCredentials: { username: proxy.username, password: proxy.password } });
}

export async function markAuthenticationFailure(details) {
  if (!details.isProxy) return;
  await patchState({ status: 'ERROR', currentError: 'AUTHENTICATION FAILED' });
}
