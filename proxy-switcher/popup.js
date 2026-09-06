const $ = (selector) => document.querySelector(selector);
const send = (type, payload = {}) => new Promise((resolve, reject) => chrome.runtime.sendMessage({ type, ...payload }, (response) => {
  if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
  if (response?.error) return reject(new Error(response.error));
  resolve(response);
}));

let state;

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
async function refresh() { state = await send('get-state'); render(); }
async function run(action) { try { const result = await action(); if (result?.error) throw new Error(result.error); await refresh(); } catch (error) { $('#import-feedback').textContent = error.message; $('#import-feedback').className = 'feedback bad'; await refresh().catch(() => {}); } }

async function importText(text) {
  const type = $('#proxy-type').value;
  const lines = String(text).split(/\r?\n/);
  const parsed = []; const seen = new Set(); const invalid = [];
  lines.forEach((line, index) => {
    const value = line.trim(); if (!value) return;
    const parts = value.split(':');
    if (![2, 4].includes(parts.length) || !parts[0] || !/^\d+$/.test(parts[1]) || Number(parts[1]) < 1 || Number(parts[1]) > 65535 || (parts.length === 4 && (!parts[2] || !parts[3]))) { invalid.push(index + 1); return; }
    const key = `${type}|${value}`; if (seen.has(key)) return; seen.add(key);
    parsed.push({ host: parts[0], port: Number(parts[1]), type, username: parts[2] || '', password: parts[3] || '', source: value });
  });
  if (!parsed.length) { $('#import-feedback').textContent = invalid.length ? `No valid proxies. Invalid lines: ${invalid.join(', ')}` : 'Nothing to import.'; $('#import-feedback').className = 'feedback bad'; return; }
  await run(() => send('add-proxies', { proxies: parsed }));
  $('#import-feedback').textContent = `${parsed.length} proxy${parsed.length === 1 ? '' : 'ies'} imported${invalid.length ? ` · skipped ${invalid.length} invalid` : ''}.`;
  $('#import-feedback').className = 'feedback';
}

$('#upload-btn').addEventListener('click', () => $('#file-input').click());
$('#file-input').addEventListener('change', async (event) => { const file = event.target.files[0]; if (file) await importText(await file.text()); event.target.value = ''; });
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
$('#shortcut-link').addEventListener('click', (event) => { event.preventDefault(); chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); });
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.proxySwitcherState) { state = changes.proxySwitcherState.newValue; render(); } });
refresh().catch((error) => { $('#import-feedback').textContent = error.message; });
