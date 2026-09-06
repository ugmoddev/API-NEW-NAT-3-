import { loadState, saveState } from './storage.js';
import { sanitizeProxy } from './proxy-parser.js';

const MAX_AUTO_SKIP_ATTEMPTS = 10;

function setChromeProxy(config) {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.set({ value: config, scope: 'regular' }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

function clearChromeProxy() {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.clear({ scope: 'regular' }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

export class ProxyManager {
  async getState() {
    return loadState();
  }

  async getCurrentProxy() {
    const state = await this.getState();
    return state.currentIndex >= 0 ? state.proxies[state.currentIndex] || null : null;
  }

  async getProxyList() {
    return (await this.getState()).proxies;
  }

  async connect(proxyOrIndex) {
    const state = await this.getState();
    const index = typeof proxyOrIndex === 'number'
      ? proxyOrIndex
      : state.proxies.findIndex((item) => item.id === proxyOrIndex?.id);
    const proxy = state.proxies[index];
    if (!proxy) throw new Error('Proxy not found');

    // Chrome's fixed_servers scheme applies the setting atomically. The state
    // is marked CONNECTED only after the API callback succeeds.
    const scheme = proxy.type === 'http' || proxy.type === 'https' ? 'http' : proxy.type;
    await setChromeProxy({
      mode: 'fixed_servers',
      rules: { singleProxy: { scheme, host: proxy.host, port: proxy.port } }
    });
    return saveState({ ...state, currentIndex: index, status: 'CONNECTED', currentError: '' });
  }

  async disconnect() {
    const state = await this.getState();
    await clearChromeProxy();
    return saveState({ ...state, status: 'DISCONNECTED', currentError: '' });
  }

  async switchToNext() {
    let state = await this.getState();
    if (!state.proxies.length) {
      return saveState({ ...state, status: 'ERROR', currentError: 'No proxies imported' });
    }

    // Always clear the old setting before changing the index, preventing two
    // profiles from being represented as active during a switch.
    if (state.status !== 'DISCONNECTED') await this.disconnect();
    state = await this.getState();
    let nextIndex = state.status === 'DISCONNECTED' && state.currentIndex < 0
      ? 0
      : (state.currentIndex + 1) % state.proxies.length;
    let attempts = 0;
    let lastError = 'CONNECTION FAILED';

    while (attempts < Math.min(MAX_AUTO_SKIP_ATTEMPTS, state.proxies.length)) {
      try {
        return await this.connect(nextIndex);
      } catch (error) {
        lastError = error.message || 'CONNECTION FAILED';
        state = await saveState({ ...(await this.getState()), currentIndex: nextIndex, status: 'ERROR', currentError: 'CONNECTION FAILED' });
        if (!state.autoSkipFailed) throw new Error('CONNECTION FAILED');
        nextIndex = (nextIndex + 1) % state.proxies.length;
        attempts += 1;
      }
    }
    return saveState({ ...(await this.getState()), status: 'ERROR', currentError: lastError });
  }

  async addProxies(proxies) {
    const state = await this.getState();
    const merged = [...state.proxies];
    const keys = new Set(merged.map((p) => `${p.type}|${p.host}|${p.port}|${p.username}|${p.password}`));
    for (const item of proxies) {
      const proxy = sanitizeProxy(item);
      const key = `${proxy.type}|${proxy.host}|${proxy.port}|${proxy.username}|${proxy.password}`;
      if (!keys.has(key)) { keys.add(key); merged.push(proxy); }
    }
    return saveState({ ...state, proxies: merged });
  }

  async removeProxy(id) {
    const state = await this.getState();
    const wasCurrent = state.proxies[state.currentIndex]?.id === id;
    const removedIndex = state.proxies.findIndex((proxy) => proxy.id === id);
    if (wasCurrent && state.status !== 'DISCONNECTED') await this.disconnect();
    const next = await this.getState();
    const proxies = next.proxies.filter((proxy) => proxy.id !== id);
    let currentIndex = next.currentIndex;
    if (!wasCurrent && removedIndex >= 0 && removedIndex < currentIndex) currentIndex -= 1;
    if (currentIndex >= proxies.length) currentIndex = proxies.length - 1;
    return saveState({ ...next, proxies, currentIndex, status: wasCurrent ? 'DISCONNECTED' : next.status });
  }

  async clearProxies() {
    const state = await this.getState();
    if (state.status !== 'DISCONNECTED') await this.disconnect();
    return saveState({ ...(await this.getState()), proxies: [], currentIndex: -1, status: 'DISCONNECTED', currentError: '' });
  }
}
