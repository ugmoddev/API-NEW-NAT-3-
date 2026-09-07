import { parseProxyText } from './modules/proxy-parser.js';

const $ = (selector) => document.querySelector(selector);
const send = (type, payload = {}) => new Promise((resolve, reject) => chrome.runtime.sendMessage({ type, ...payload }, (response) => {
  if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
  if (response?.error) return reject(new Error(response.error));
  resolve(response);
}));

let state;
let selectedFiles = [];

function displayProxy(proxy) {
  if (!proxy) {
    $('#current-address').textContent = 'No proxy selected';
    $('#current-credentials').textContent = state?.proxies?.length ? 'Press the shortcut to connect' : 'Import a list to get started';
    return;
  }
  $('#current-address').textContent = `${proxy.host}:${proxy.port}`;
  $('#current-credentials').textContent = proxy.username ? `Username: ${proxy.username} · ${proxy.type.toUpperCase()}` : proxy.type.toUpperCase();
}

function render() {
  const current = state?.proxies?.[state.currentIndex];
  const status = state?.status || 'DISCONNECTED';
  const pill = $('#header-status');
  pill.className = `status-pill ${status.toLowerCase()}`;
  pill.innerHTML = `<i></i>${status}`;
  displayProxy(current);
  $('#current-number').textContent = current ? `#${state.currentIndex + 1}` : '';
  $('#current-error').textContent = state?.currentError || '';
  $('#current-error').classList.toggle('hidden', !state?.currentError);
  $('#proxy-count').textContent = `${state?.proxies?.length || 0} profile${state?.proxies?.length === 1 ? '' : 's'}`;
  $('#auto-skip').checked = Boolean(state?.autoSkipFailed);
  $('#auto-connect').checked = Boolean(state?.autoConnectOnStartup);
  $('#auto-rotate').checked = Boolean(state?.autoRotate);

  const list = $('#proxy-list');
  list.innerHTML = '';
  if (!state?.proxies?.length) list.innerHTML = '<div class="empty-state">No proxy profiles yet</div>';
  (state?.proxies || []).forEach((proxy, index) => {
    const row = document.createElement('div');
    row.className = `proxy-row ${index === state.currentIndex && status === 'CONNECTED' ? 'active' : ''}`;
    row.innerHTML = `<span class="proxy-index">${String(index + 1).padStart(2, '0')}</span><span class="proxy-dot"></span><span class="proxy-text">${escapeHtml(proxy.host)}:${proxy.port}${proxy.username ? ` · ${escapeHtml(proxy.username)}` : ''}</span><span class="proxy-type">${proxy.type}</span><button class="remove-proxy" title="Remove proxy" aria-label="Remove proxy">×</button>`;
    row.addEventListener('click', async (event) => { if (!event.target.closest('.remove-proxy')) await run(() => send('connect', { index })); });
    row.querySelector('.remove-proxy').addEventListener('click', async (event) => { event.stopPropagation(); await run(() => send('remove-proxy', { id: proxy.id })); });
    list.appendChild(row);
  });
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
async function renderTargetTabs() {
  const list = $('#target-tab-list');
  const tabs = await chrome.tabs.query({});
  const selected = new Set(state?.targetTabIds || []);
  list.innerHTML = '';
  tabs.filter((tab) => tab.id && !tab.url?.startsWith('chrome://')).forEach((tab) => {
    const label = tab.title || tab.url || `Tab ${tab.id}`;
    const row = document.createElement('label');
    row.className = 'target-tab';
    row.innerHTML = `<input type="checkbox" data-tab-id="${tab.id}" ${selected.has(tab.id) ? 'checked' : ''}><span class="target-tab-title">${escapeHtml(label)}</span><span class="target-tab-id">#${tab.id}</span>`;
    row.querySelector('input').addEventListener('change', async () => {
      const ids = [...list.querySelectorAll('input:checked')].map((input) => Number(input.dataset.tabId));
      await run(() => send('update-settings', { patch: { targetTabIds: ids } }));
    });
    list.appendChild(row);
  });
  if (!list.children.length) list.innerHTML = '<div class="empty-state">No selectable tabs</div>';
}
async function refresh() { state = await send('get-state'); render(); await renderTargetTabs(); }
async function run(action) { try { const result = await action(); if (result?.error) throw new Error(result.error); await refresh(); } catch (error) { $('#import-feedback').textContent = error.message; $('#import-feedback').className = 'feedback bad'; await refresh().catch(() => {}); } }

async function importText(text, sourceLabel = '') {
  const type = $('#proxy-type').value;
  const { proxies: parsed, invalid } = parseProxyText(text, type);
  if (!parsed.length) {
    const lines = invalid.map((item) => item.line).join(', ');
    $('#import-feedback').textContent = lines ? `No valid proxies. Invalid lines: ${lines}` : 'Nothing to import.';
    $('#import-feedback').className = 'feedback bad';
    return;
  }
  try {
    await send('add-proxies', { proxies: parsed });
  } catch (error) {
    $('#import-feedback').textContent = `Import failed: ${error.message}`;
    $('#import-feedback').className = 'feedback bad';
    return;
  }
  await refresh();
  $('#import-feedback').textContent = `${parsed.length} proxy${parsed.length === 1 ? '' : 'ies'} imported${sourceLabel ? ` from ${sourceLabel}` : ''}${invalid.length ? ` · skipped ${invalid.length} invalid` : ''}.`;
  $('#import-feedback').className = 'feedback';
}

$('#upload-btn').addEventListener('click', () => $('#file-input').click());
function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Cannot read ${file.name}`));
    reader.readAsText(file);
  });
}
$('#file-input').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  const known = new Set(selectedFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  selectedFiles.push(...files.filter((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (known.has(key)) return false;
    known.add(key);
    return true;
  }));
  $('#selected-files').textContent = selectedFiles.length ? `${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} selected: ${selectedFiles.map((file) => file.name).join(', ')}` : '';
  if (selectedFiles.length) {
    try {
      const contents = await Promise.all(selectedFiles.map((file) => readFileText(file)));
      await importText(contents.join('\n'), `${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'}`);
    } catch (error) {
      $('#import-feedback').textContent = `Upload failed: ${error.message}`;
      $('#import-feedback').className = 'feedback bad';
    }
  }
  event.target.value = '';
});
$('#paste-btn').addEventListener('click', async () => {
  $('#paste-area').classList.remove('hidden');
  $('#import-paste-btn').classList.remove('hidden');
  try {
    const clipboardText = await navigator.clipboard.readText();
    if (clipboardText.trim()) {
      $('#paste-area').value = clipboardText;
      await importText(clipboardText);
    } else {
      $('#import-feedback').textContent = 'Clipboard is empty.';
      $('#import-feedback').className = 'feedback bad';
    }
  } catch (_error) {
    $('#import-feedback').textContent = 'Clipboard access was unavailable. Paste manually below.';
    $('#import-feedback').className = 'feedback bad';
    $('#paste-area').focus();
  }
});
$('#import-paste-btn').addEventListener('click', async () => { await importText($('#paste-area').value); $('#paste-area').value = ''; });
$('#connect-btn').addEventListener('click', () => run(() => send('connect', { index: state.currentIndex >= 0 ? state.currentIndex : 0 })));
$('#disconnect-btn').addEventListener('click', () => run(() => send('disconnect')));
$('#switch-btn').addEventListener('click', () => run(() => send('switch-next')));
$('#clear-btn').addEventListener('click', () => run(() => send('clear-proxies')));
$('#auto-skip').addEventListener('change', (event) => run(() => send('update-settings', { patch: { autoSkipFailed: event.target.checked } })));
$('#auto-connect').addEventListener('change', (event) => run(() => send('update-settings', { patch: { autoConnectOnStartup: event.target.checked } })));
$('#auto-rotate').addEventListener('change', (event) => run(() => send('update-settings', { patch: { autoRotate: event.target.checked } })));
$('#refresh-tabs-btn').addEventListener('click', () => renderTargetTabs());
$('#shortcut-link').addEventListener('click', (event) => { event.preventDefault(); chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); });
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.proxySwitcherState) { state = changes.proxySwitcherState.newValue; render(); } });
refresh().catch((error) => { $('#import-feedback').textContent = error.message; });
