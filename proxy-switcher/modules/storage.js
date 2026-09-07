export const DEFAULT_STATE = {
  proxies: [],
  currentIndex: -1,
  status: 'DISCONNECTED',
  currentError: '',
  autoSkipFailed: false,
  autoConnectOnStartup: false,
  autoRotate: false,
  targetTabIds: [],
  updatedAt: 0
};

export async function loadState() {
  const stored = await chrome.storage.local.get('proxySwitcherState');
  return { ...DEFAULT_STATE, ...(stored.proxySwitcherState || {}) };
}

export async function saveState(state) {
  const next = { ...DEFAULT_STATE, ...state, updatedAt: Date.now() };
  await chrome.storage.local.set({ proxySwitcherState: next });
  return next;
}

export async function patchState(patch) {
  return saveState({ ...(await loadState()), ...patch });
}
