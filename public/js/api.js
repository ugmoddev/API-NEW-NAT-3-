// ============================================
// CONFIGURATION
// ============================================
const API_BASE = window.location.origin;
const WS_BASE = window.location.origin.replace('http', 'ws');

let currentUser = null;
let ws = null;
let currentTab = 'apis';
let chatConnected = false;
let statsInterval = null;

// ============================================
// DOM ELEMENTS
// ============================================
const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

const elements = {
    userInfo: $('userInfo'),
    userAvatar: $('userAvatar'),
    userName: $('userName'),
    userRole: $('userRole'),
    authBtn: $('authBtn'),
    
    totalApis: $('totalApis'),
    totalJobs: $('totalJobs'),
    totalUsers: $('totalUsers'),
    runningBots: $('runningBots'),

    trendEnabledApis: $('trendEnabledApis'),
    trendAvgJobs: $('trendAvgJobs'),
    trendSessions: $('trendSessions'),
    trendStoppedBots: $('trendStoppedBots'),

    statEnabledApis: $('statEnabledApis'),
    statPrivateApis: $('statPrivateApis'),
    statRunningBots: $('statRunningBots'),
    statOnlineMonitors: $('statOnlineMonitors'),
    statActiveSessions: $('statActiveSessions'),
    statAvgJobs: $('statAvgJobs'),
    statUsersByRole: $('statUsersByRole'),
    statTopApis: $('statTopApis'),
    
    apiList: $('apiList'),
    botList: $('botList'),
    monitorList: $('monitorList'),
    
    chatMessages: $('chatMessages'),
    chatInput: $('chatInput'),
    chatSendBtn: $('chatSendBtn'),
    onlineCount: $('onlineCount'),
    
    modal: $('modal'),
    modalTitle: $('modalTitle'),
    modalBody: $('modalBody'),
    modalClose: document.querySelector('.modal-close'),
    
    createApiBtn: $('createApiBtn'),
    createBotBtn: $('createBotBtn'),
    createMonitorBtn: $('createMonitorBtn'),
    
    apiCount: $('apiCount'),
    botCount: $('botCount'),
    monitorCount: $('monitorCount'),
    chatCount: $('chatCount'),
};

console.log('✅ DOM elements loaded');

// ============================================
// UTILITY FUNCTIONS
// ============================================
function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    if (token) {
        localStorage.setItem('token', token);
    } else {
        localStorage.removeItem('token');
    }
}

function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) {
        headers['Authorization'] = token;
    }
    return headers;
}

async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                ...getHeaders(),
                ...options.headers,
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('vi-VN');
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('vi-VN');
}

function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} ngày trước`;
    if (hours > 0) return `${hours} giờ trước`;
    if (minutes > 0) return `${minutes} phút trước`;
    return `${seconds} giây trước`;
}

function getStatusColor(status) {
    const colors = {
        'online': 'status-online',
        'offline': 'status-offline',
        'running': 'status-running',
        'stopped': 'status-stopped',
        'waiting': 'status-stopped',
        'restarting': 'status-running',
        'error': 'status-offline'
    };
    return colors[status] || 'status-stopped';
}

function getStatusIcon(status) {
    const icons = {
        'online': 'fa-circle',
        'offline': 'fa-circle',
        'running': 'fa-play',
        'stopped': 'fa-stop',
        'waiting': 'fa-hourglass-half',
        'restarting': 'fa-sync fa-spin',
        'error': 'fa-exclamation-triangle'
    };
    return icons[status] || 'fa-circle';
}

function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ============================================
// AUTH FUNCTIONS
// ============================================
async function checkAuth() {
    const token = getToken();
    if (token) {
        try {
            const data = await apiFetch('/me');
            if (data.user) {
                currentUser = data;
                updateUI();
                return true;
            }
        } catch (e) {
            // Token invalid
        }
    }
    setToken(null);
    currentUser = null;
    updateUI();
    return false;
}

function updateUI() {
    if (currentUser) {
        elements.userAvatar.src = currentUser.avatar || '/assets/images/default-avatar.png';
        elements.userName.textContent = currentUser.user;
        elements.userRole.textContent = currentUser.role || 'member';
        elements.authBtn.innerHTML = `
            <i class="fas fa-sign-out-alt"></i>
            <span>Đăng xuất</span>
        `;
        elements.authBtn.className = 'btn btn-danger';
    } else {
        elements.userAvatar.src = '/assets/images/default-avatar.png';
        elements.userName.textContent = 'Guest';
        elements.userRole.textContent = 'visitor';
        elements.authBtn.innerHTML = `
            <i class="fas fa-sign-in-alt"></i>
            <span>Đăng nhập</span>
        `;
        elements.authBtn.className = 'btn btn-primary';
    }
}

// ============================================
// TAB NAVIGATION
// ============================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const tab = btn.dataset.tab;
        currentTab = tab;
        
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
        
        switch(tab) {
            case 'apis': loadApis(); break;
            case 'bots': loadBots(); break;
            case 'monitors': loadMonitors(); break;
            case 'chat': connectChat(); break;
        }
    });
});

// ============================================
// AUTH HANDLER
// ============================================
elements.authBtn.addEventListener('click', async () => {
    if (currentUser) {
        try {
            await apiFetch('/logout', { method: 'POST' });
            setToken(null);
            currentUser = null;
            updateUI();
            loadStats();
            loadApis();
            showToast('Đã đăng xuất', 'info');
            if (ws) {
                ws.close();
                ws = null;
            }
        } catch (error) {
            showToast('Lỗi đăng xuất', 'error');
        }
    } else {
        showLoginModal();
    }
});

// ============================================
// MODAL FUNCTIONS
// ============================================
function openModal(title, html) {
    elements.modalTitle.innerHTML = title;
    elements.modalBody.innerHTML = html;
    elements.modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    elements.modal.style.display = 'none';
    document.body.style.overflow = '';
}

elements.modalClose.addEventListener('click', closeModal);
window.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModal();
});

// ============================================
// LOGIN / REGISTER
// ============================================
function showLoginModal() {
    openModal('🔐 Đăng nhập', `
        <div class="form-group">
            <label>Tên đăng nhập</label>
            <input type="text" id="loginUser" placeholder="Nhập tên đăng nhập">
        </div>
        <div class="form-group">
            <label>Mật khẩu</label>
            <input type="password" id="loginPass" placeholder="Nhập mật khẩu">
        </div>
        <div class="form-actions">
            <button onclick="closeModal()" class="btn btn-danger">Hủy</button>
            <button onclick="login()" class="btn btn-success">
                <i class="fas fa-sign-in-alt"></i> Đăng nhập
            </button>
        </div>
        <div style="margin-top: 16px; text-align: center;">
            <button onclick="showRegisterModal()" class="btn btn-primary btn-sm">
                <i class="fas fa-user-plus"></i> Đăng ký tài khoản mới
            </button>
        </div>
    `);
}

function showRegisterModal() {
    openModal('📝 Đăng ký', `
        <div class="form-group">
            <label>Tên đăng nhập</label>
            <input type="text" id="registerUser" placeholder="Chọn tên đăng nhập">
        </div>
        <div class="form-group">
            <label>Mật khẩu (ít nhất 8 ký tự)</label>
            <input type="password" id="registerPass" placeholder="Nhập mật khẩu">
        </div>
        <div class="form-group">
            <label>Nhập lại mật khẩu</label>
            <input type="password" id="registerPass2" placeholder="Nhập lại mật khẩu">
        </div>
        <div class="form-actions">
            <button onclick="closeModal()" class="btn btn-danger">Hủy</button>
            <button onclick="register()" class="btn btn-success">
                <i class="fas fa-user-plus"></i> Đăng ký
            </button>
        </div>
        <div style="margin-top: 16px; text-align: center;">
            <button onclick="showLoginModal()" class="btn btn-primary btn-sm">
                <i class="fas fa-sign-in-alt"></i> Đã có tài khoản? Đăng nhập
            </button>
        </div>
    `);
}

async function login() {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    
    if (!user || !pass) {
        showToast('Vui lòng nhập đầy đủ thông tin', 'error');
        return;
    }
    
    try {
        const data = await apiFetch('/login', {
            method: 'POST',
            body: JSON.stringify({ user, pass }),
        });
        
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        setToken(data.token);
        closeModal();
        await checkAuth();
        loadAllData();
        connectChat();
        showToast('Đăng nhập thành công!', 'success');
    } catch (error) {
        showToast('Lỗi đăng nhập', 'error');
    }
}

async function register() {
    const user = document.getElementById('registerUser').value.trim();
    const pass = document.getElementById('registerPass').value;
    const pass2 = document.getElementById('registerPass2').value;
    
    if (!user || !pass || !pass2) {
        showToast('Vui lòng nhập đầy đủ thông tin', 'error');
        return;
    }
    if (pass !== pass2) {
        showToast('Mật khẩu nhập lại không khớp', 'error');
        return;
    }
    if (pass.length < 8) {
        showToast('Mật khẩu phải có ít nhất 8 ký tự', 'error');
        return;
    }
    if (/\s/.test(user)) {
        showToast('Tên đăng nhập không chứa khoảng trắng', 'error');
        return;
    }
    
    try {
        const data = await apiFetch('/register', {
            method: 'POST',
            body: JSON.stringify({ user, pass }),
        });
        
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        showToast('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
        closeModal();
        showLoginModal();
    } catch (error) {
        showToast('Lỗi đăng ký', 'error');
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================
const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member' };

function renderUsersByRole(usersByRole) {
    if (!elements.statUsersByRole) return;
    const entries = Object.entries(usersByRole || {});
    if (!entries.length) {
        elements.statUsersByRole.innerHTML = '<div class="detail-empty">Chưa có dữ liệu</div>';
        return;
    }
    const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1;
    elements.statUsersByRole.innerHTML = entries
        .sort((a, b) => b[1] - a[1])
        .map(([role, count]) => {
            const pct = Math.round((count / total) * 100);
            const label = ROLE_LABELS[role] || role;
            return `
                <div class="detail-row">
                    <span class="detail-row-label">${label}</span>
                    <div class="detail-bar-track"><div class="detail-bar-fill" style="width:${pct}%"></div></div>
                    <span class="detail-row-value">${count}</span>
                </div>`;
        }).join('');
}

function renderTopApis(topApis) {
    if (!elements.statTopApis) return;
    if (!topApis || !topApis.length) {
        elements.statTopApis.innerHTML = '<div class="detail-empty">Chưa có API nào</div>';
        return;
    }
    const max = Math.max(...topApis.map(a => a.jobs), 1);
    elements.statTopApis.innerHTML = topApis.map(a => {
        const pct = Math.round((a.jobs / max) * 100);
        return `
            <div class="detail-row">
                <span class="detail-row-label">${escapeHtml(a.name)}</span>
                <div class="detail-bar-track"><div class="detail-bar-fill" style="width:${pct}%"></div></div>
                <span class="detail-row-value">${a.jobs}</span>
            </div>`;
    }).join('');
}

function renderApis(apis) {
    const container = elements.apiList;
    
    if (!apis || apis.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <img src="/assets/images/empty-state.svg" alt="Empty">
                <h3>Chưa có API nào</h3>
                <p>Hãy tạo API mới để bắt đầu nhận jobs</p>
            </div>
        `;
        return;
    }

    let html = '';
    for (const api of apis) {
        html += `
            <div class="api-card">
                <div class="card-header">
                    <div class="card-title">
                        <i class="fas fa-code"></i>
                        ${escapeHtml(api.displayName || api.name)}
                    </div>
                    <span class="status-badge ${api.enabled ? 'status-online' : 'status-offline'}">
                        ${api.enabled ? 'Online' : 'Offline'}
                    </span>
                </div>
                <div class="card-owner">
                    <i class="fas fa-user"></i> ${escapeHtml(api.owner)}
                </div>
                <div class="card-stats">
                    <span class="stat-item">
                        <i class="fas fa-tasks"></i> ${api.totalJobs || 0} jobs
                    </span>
                    <span class="stat-item">
                        <i class="fas fa-users"></i> ${Object.keys(api.bosses || {}).length} bosses
                    </span>
                    ${api.privateMode ? `<span class="stat-item"><i class="fas fa-lock"></i> Private</span>` : ''}
                </div>
                <div class="card-actions">
                    <button onclick="viewApi('${api.id}')" class="btn btn-info btn-sm">
                        <i class="fas fa-eye"></i> Xem
                    </button>
                    <button onclick="editApi('${api.id}')" class="btn btn-warning btn-sm">
                        <i class="fas fa-edit"></i> Sửa
                    </button>
                    <button onclick="copyApiKey('${api.apiKey}')" class="btn btn-primary btn-sm">
                        <i class="fas fa-key"></i> Key
                    </button>
                    <button onclick="deleteApi('${api.id}')" class="btn btn-danger btn-sm">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function renderBots(bots) {
    const container = elements.botList;
    
    if (!bots || bots.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <img src="/assets/images/empty-state.svg" alt="Empty">
                <h3>Chưa có bot nào</h3>
                <p>Tạo bot Discord và host ngay hôm nay</p>
            </div>
        `;
        return;
    }

    let html = '';
    for (const bot of bots) {
        html += `
            <div class="bot-card">
                <div class="card-header">
                    <div class="card-title">
                        <i class="fas fa-robot"></i>
                        ${escapeHtml(bot.name)}
                    </div>
                    <span class="status-badge ${getStatusColor(bot.status)}">
                        <i class="fas ${getStatusIcon(bot.status)}"></i>
                        ${bot.status}
                    </span>
                </div>
                <div class="card-stats">
                    <span class="stat-item">
                        <i class="fas fa-sync"></i> Restart: ${bot.restartCount || 0}
                    </span>
                    <span class="stat-item">
                        <i class="fas ${bot.autoRestart ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                        ${bot.autoRestart ? 'Auto' : 'Manual'}
                    </span>
                    <span class="stat-item">
                        <i class="fas fa-clock"></i> ${formatRelativeTime(bot.updated_at)}
                    </span>
                </div>
                <div class="card-actions">
                    ${bot.status === 'running' || bot.status === 'restarting' ? 
                        `<button onclick="stopBot('${bot.id}')" class="btn btn-danger btn-sm">
                            <i class="fas fa-stop"></i> Dừng
                        </button>` :
                        `<button onclick="startBot('${bot.id}')" class="btn btn-success btn-sm">
                            <i class="fas fa-play"></i> Chạy
                        </button>`
                    }
                    <button onclick="viewBotLogs('${bot.id}')" class="btn btn-info btn-sm">
                        <i class="fas fa-file-alt"></i> Logs
                    </button>
                    <button onclick="deleteBot('${bot.id}')" class="btn btn-danger btn-sm">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function renderMonitors(monitors) {
    const container = elements.monitorList;
    
    if (!monitors || monitors.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <img src="/assets/images/empty-state.svg" alt="Empty">
                <h3>Chưa có monitor nào</h3>
                <p>Theo dõi uptime website của bạn</p>
            </div>
        `;
        return;
    }

    let html = '';
    for (const m of monitors) {
        html += `
            <div class="monitor-card">
                <div class="card-header">
                    <div class="card-title">
                        <i class="fas fa-heartbeat"></i>
                        ${escapeHtml(m.name)}
                    </div>
                    <span class="status-badge ${getStatusColor(m.lastStatus)}">
                        <i class="fas ${getStatusIcon(m.lastStatus)}"></i>
                        ${m.lastStatus}
                    </span>
                </div>
                <div class="card-owner">
                    <i class="fas fa-link"></i> ${escapeHtml(m.url)}
                </div>
                <div class="card-stats">
                    <span class="stat-item">
                        <i class="fas fa-chart-line"></i> ${m.uptime || 0}%
                    </span>
                    <span class="stat-item">
                        <i class="fas fa-clock"></i> ${m.lastPing || 0}ms
                    </span>
                    <span class="stat-item">
                        <i class="fas fa-check"></i> ${m.goodChecks || 0}/${m.totalChecks || 0}
                    </span>
                </div>
                <div class="card-actions">
                    <button onclick="viewMonitor('${m.id}')" class="btn btn-info btn-sm">
                        <i class="fas fa-eye"></i> Xem
                    </button>
                    <button onclick="deleteMonitor('${m.id}')" class="btn btn-danger btn-sm">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ============================================
// CHAT RENDER
// ============================================
function addChatMessage(msg) {
    const container = elements.chatMessages;
    const isSelf = currentUser && msg.user === currentUser.user;
    
    const html = `
        <div class="chat-message ${isSelf ? 'self' : 'other'}">
            <div class="msg-user">${escapeHtml(msg.user)}</div>
            <div class="msg-content">${escapeHtml(msg.content)}</div>
            <div class="msg-time">${formatTime(msg.timestamp)}</div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
    container.scrollTop = container.scrollHeight;
    
    while (container.children.length > 300) {
        container.removeChild(container.firstChild);
    }
}

// ============================================
// LOAD DATA FUNCTIONS
// ============================================
const loadStatsDebounced = debounce(async function() {
    try {
        const data = await apiFetch('/stats');
        if (data.err) return;

        requestAnimationFrame(() => {
            elements.totalApis.textContent = data.totalApis || 0;
            elements.totalJobs.textContent = data.totalJobs || 0;
            elements.totalUsers.textContent = data.totalUsers || 0;
            elements.runningBots.textContent = data.runningBots || 0;

            elements.apiCount.textContent = data.totalApis || 0;
            elements.botCount.textContent = data.totalBots || 0;
            elements.monitorCount.textContent = data.totalMonitors || 0;

            if (elements.trendEnabledApis) elements.trendEnabledApis.textContent = data.enabledApis || 0;
            if (elements.trendAvgJobs) elements.trendAvgJobs.textContent = data.avgJobsPerApi || 0;
            if (elements.trendSessions) elements.trendSessions.textContent = data.activeSessions || 0;
            if (elements.trendStoppedBots) elements.trendStoppedBots.textContent = data.stoppedBots || 0;

            if (elements.statEnabledApis) {
                elements.statEnabledApis.innerHTML = `${data.enabledApis || 0}<span class="detail-row-sub">/ ${data.totalApis || 0}</span>`;
            }
            if (elements.statPrivateApis) elements.statPrivateApis.textContent = data.privateApis || 0;
            if (elements.statRunningBots) {
                elements.statRunningBots.innerHTML = `${data.runningBots || 0}<span class="detail-row-sub">/ ${data.totalBots || 0}</span>`;
            }
            if (elements.statOnlineMonitors) {
                elements.statOnlineMonitors.innerHTML = `${data.onlineMonitors || 0}<span class="detail-row-sub">/ ${data.totalMonitors || 0}</span>`;
            }
            if (elements.statActiveSessions) elements.statActiveSessions.textContent = data.activeSessions || 0;
            if (elements.statAvgJobs) elements.statAvgJobs.textContent = data.avgJobsPerApi || 0;

            renderUsersByRole(data.usersByRole);
            renderTopApis(data.topApis);
        });
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}, 200);

const loadStats = loadStatsDebounced;

async function loadApis() {
    try {
        const apis = await apiFetch('/my');
        if (Array.isArray(apis)) {
            requestAnimationFrame(() => renderApis(apis));
        }
    } catch (e) {
        console.error('Failed to load APIs:', e);
        showToast('Lỗi tải danh sách API', 'error');
    }
}

async function loadBots() {
    try {
        const bots = await apiFetch('/bot/my');
        if (Array.isArray(bots)) {
            requestAnimationFrame(() => renderBots(bots));
        }
    } catch (e) {
        console.error('Failed to load bots:', e);
    }
}

async function loadMonitors() {
    try {
        const monitors = await apiFetch('/monitor/my');
        if (Array.isArray(monitors)) {
            requestAnimationFrame(() => renderMonitors(monitors));
        }
    } catch (e) {
        console.error('Failed to load monitors:', e);
    }
}

// ============================================
// API ACTIONS
// ============================================
window.viewApi = async function(apiId) {
    try {
        const data = await apiFetch(`/api/${apiId}/stats`);
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        const bossList = Object.entries(data.bosses || {})
            .map(([name, count]) => `<li>${escapeHtml(name)}: ${count} jobs</li>`)
            .join('');
        
        openModal(`📊 ${escapeHtml(data.displayName || data.id)}`, `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div><strong>ID:</strong> ${escapeHtml(data.id)}</div>
                <div><strong>Tổng jobs:</strong> ${data.totalJobs || 0}</div>
                <div><strong>TTL:</strong> ${data.ttl / 1000}s</div>
                <div><strong>Trạng thái:</strong> ${data.enabled ? '✅ Online' : '❌ Offline'}</div>
                <div><strong>Max jobs/boss:</strong> ${data.maxJobsPerBoss || 'Không giới hạn'}</div>
                <div><strong>Private:</strong> ${data.privateMode ? '🔒 Có' : '🔓 Không'}</div>
            </div>
            ${bossList ? `
                <div style="margin-top: 16px;">
                    <strong>Bosses:</strong>
                    <ul style="margin-top: 8px; padding-left: 20px;">${bossList}</ul>
                </div>
            ` : ''}
            <div class="form-actions">
                <button onclick="closeModal()" class="btn btn-primary">Đóng</button>
            </div>
        `);
    } catch (e) {
        showToast('Lỗi khi tải dữ liệu', 'error');
    }
};

window.editApi = async function(apiId) {
    try {
        const apis = await apiFetch('/my');
        const api = apis.find(a => a.id === apiId);
        if (!api) {
            showToast('Không tìm thấy API', 'error');
            return;
        }
        
        openModal(`✏️ Sửa API: ${escapeHtml(api.displayName || api.name)}`, `
            <div class="form-group">
                <label>Tên hiển thị</label>
                <input type="text" id="editDisplayName" value="${escapeHtml(api.displayName || '')}">
            </div>
            <div class="form-group">
                <label>TTL (ms)</label>
                <input type="number" id="editTtl" value="${api.ttl || 60000}">
            </div>
            <div class="form-group">
                <label>Webhook URL</label>
                <input type="url" id="editWebhook" value="${escapeHtml(api.webhook || '')}">
            </div>
            <div class="form-group">
                <label>Prefix</label>
                <input type="text" id="editPrefix" value="${escapeHtml(api.prefix || '')}">
            </div>
            <div class="form-group">
                <label>Suffix</label>
                <input type="text" id="editSuffix" value="${escapeHtml(api.suffix || '')}">
            </div>
            <div class="form-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="editEnabled" ${api.enabled ? 'checked' : ''}>
                    <label>Kích hoạt</label>
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="editPrivate" ${api.privateMode ? 'checked' : ''}>
                    <label>Chế độ riêng tư</label>
                </div>
            </div>
            <div class="form-actions">
                <button onclick="closeModal()" class="btn btn-danger">Hủy</button>
                <button onclick="saveApiSettings('${apiId}')" class="btn btn-success">
                    <i class="fas fa-save"></i> Lưu
                </button>
            </div>
        `);
    } catch (e) {
        showToast('Lỗi khi tải dữ liệu', 'error');
    }
};

window.saveApiSettings = async function(apiId) {
    const settings = {
        id: apiId,
        displayName: document.getElementById('editDisplayName').value,
        ttl: parseInt(document.getElementById('editTtl').value) || 60000,
        webhook: document.getElementById('editWebhook').value,
        prefix: document.getElementById('editPrefix').value,
        suffix: document.getElementById('editSuffix').value,
        enabled: document.getElementById('editEnabled').checked,
        privateMode: document.getElementById('editPrivate').checked,
    };
    
    try {
        const result = await apiFetch('/settings', {
            method: 'POST',
            body: JSON.stringify(settings),
        });
        
        if (result.err) {
            showToast(result.err, 'error');
        } else {
            showToast('Cập nhật thành công!', 'success');
            closeModal();
            loadApis();
            loadStats();
        }
    } catch (e) {
        showToast('Lỗi khi lưu', 'error');
    }
};

window.copyApiKey = function(apiKey) {
    navigator.clipboard.writeText(apiKey).then(() => {
        showToast('Đã sao chép API Key', 'success');
    }).catch(() => {
        showToast('Không thể sao chép', 'error');
    });
};

window.deleteApi = async function(apiId) {
    if (!confirm('Bạn có chắc muốn xóa API này?')) return;
    
    try {
        const result = await apiFetch(`/api/${apiId}`, { method: 'DELETE' });
        if (result.err) {
            showToast(result.err, 'error');
        } else {
            showToast('Đã xóa API', 'success');
            loadApis();
            loadStats();
        }
    } catch (e) {
        showToast('Lỗi khi xóa', 'error');
    }
};

// ============================================
// BOT ACTIONS
// ============================================
window.startBot = async function(botId) {
    try {
        const result = await apiFetch(`/bot/${botId}/start`, {
            method: 'POST',
            body: JSON.stringify({ autoRestart: true })
        });
        
        if (result.err) {
            showToast(result.err, 'error');
        } else {
            showToast('Bot đã được khởi động', 'success');
            loadBots();
            loadStats();
        }
    } catch (e) {
        showToast('Lỗi khi khởi động bot', 'error');
    }
};

window.stopBot = async function(botId) {
    try {
        const result = await apiFetch(`/bot/${botId}/stop`, { method: 'POST' });
        if (result.err) {
            showToast(result.err, 'error');
        } else {
            showToast('Bot đã dừng', 'success');
            loadBots();
            loadStats();
        }
    } catch (e) {
        showToast('Lỗi khi dừng bot', 'error');
    }
};

window.viewBotLogs = async function(botId) {
    try {
        const data = await apiFetch(`/bot/${botId}/logs`);
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        const logsHtml = data.logs.length > 0 
            ? data.logs.map(log => `<div>${escapeHtml(log)}</div>`).join('')
            : '<div style="color: var(--text-muted);">Không có logs</div>';
        
        openModal(`📋 Logs: ${botId}`, `
            <div style="background: #1a1a2e; color: #00ff00; padding: 16px; border-radius: 8px; max-height: 400px; overflow-y: auto; font-family: 'Courier New', monospace; font-size: 0.85rem; white-space: pre-wrap; line-height: 1.5;">
                ${logsHtml}
            </div>
            <div class="form-actions">
                <button onclick="closeModal()" class="btn btn-primary">Đóng</button>
            </div>
        `);
    } catch (e) {
        showToast('Lỗi khi tải logs', 'error');
    }
};

window.deleteBot = async function(botId) {
    if (!confirm('Bạn có chắc muốn xóa bot này?')) return;
    
    try {
        const result = await apiFetch(`/bot/${botId}`, { method: 'DELETE' });
        if (result.err) {
            showToast(result.err, 'error');
        } else {
            showToast('Đã xóa bot', 'success');
            loadBots();
            loadStats();
        }
    } catch (e) {
        showToast('Lỗi khi xóa bot', 'error');
    }
};

// ============================================
// MONITOR ACTIONS
// ============================================
window.viewMonitor = async function(monitorId) {
    try {
        const data = await apiFetch(`/monitor/${monitorId}`);
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        const historyHtml = (data.history || []).slice(-10).map(h => `
            <div style="display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid var(--border-color);">
                <span>${h.s === 'on' ? '🟢' : '🔴'} ${h.s}</span>
                <span>${h.p || 0}ms</span>
                <span style="font-size: 0.8rem; color: var(--text-muted);">${formatTime(h.t)}</span>
            </div>
        `).join('');
        
        openModal(`📡 ${escapeHtml(data.name)}`, `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div><strong>URL:</strong> ${escapeHtml(data.url)}</div>
                <div><strong>Trạng thái:</strong> ${data.lastStatus}</div>
                <div><strong>Uptime:</strong> ${data.uptime || 0}%</div>
                <div><strong>Ping:</strong> ${data.lastPing || 0}ms</div>
                <div><strong>Kiểm tra:</strong> ${data.totalChecks || 0} lần</div>
                <div><strong>Last check:</strong> ${data.lastCheck ? formatDate(data.lastCheck) : 'Chưa kiểm tra'}</div>
            </div>
            ${historyHtml ? `
                <div style="margin-top: 16px;">
                    <strong>Lịch sử gần đây:</strong>
                    <div style="margin-top: 8px; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                        ${historyHtml}
                    </div>
                </div>
            ` : ''}
            <div class="form-actions">
                <button onclick="closeModal()" class="btn btn-primary">Đóng</button>
            </div>
        `);
    } catch (e) {
        showToast('Lỗi khi tải dữ liệu', 'error');
    }
};

window.deleteMonitor = async function(monitorId) {
    if (!confirm('Bạn có chắc muốn xóa monitor này?')) return;
    
    try {
        const result = await apiFetch(`/monitor/${monitorId}`, { method: 'DELETE' });
        if (result.err) {
            showToast(result.err, 'error');
        } else {
            showToast('Đã xóa monitor', 'success');
            loadMonitors();
            loadStats();
        }
    } catch (e) {
        showToast('Lỗi khi xóa monitor', 'error');
    }
};

// ============================================
// CREATE FUNCTIONS
// ============================================
elements.createApiBtn.addEventListener('click', () => {
    if (!currentUser) {
        showToast('Vui lòng đăng nhập để tạo API', 'error');
        return;
    }
    
    openModal('📦 Tạo API mới', `
        <div class="form-group">
            <label>Tên API <span style="color: var(--danger);">*</span></label>
            <input type="text" id="createApiName" placeholder="my_api (chỉ chữ, số, _)">
            <small style="color: var(--text-muted);">Chỉ chứa chữ, số và dấu gạch dưới</small>
        </div>
        <div class="form-group">
            <label>Tên hiển thị</label>
            <input type="text" id="createApiDisplay" placeholder="My API">
        </div>
        <div class="form-group">
            <label>Webhook URL (tùy chọn)</label>
            <input type="url" id="createApiWebhook" placeholder="https://discord.com/api/webhooks/...">
        </div>
        <div class="form-group">
            <div class="checkbox-group">
                <input type="checkbox" id="createApiPrivate">
                <label>Chế độ riêng tư (chỉ IP được phép truy cập)</label>
            </div>
        </div>
        <div class="form-actions">
            <button onclick="closeModal()" class="btn btn-danger">Hủy</button>
            <button onclick="createApi()" class="btn btn-success">
                <i class="fas fa-plus"></i> Tạo
            </button>
        </div>
    `);
});

async function createApi() {
    const name = document.getElementById('createApiName').value.trim();
    const displayName = document.getElementById('createApiDisplay').value.trim() || name;
    const webhook = document.getElementById('createApiWebhook').value.trim();
    const privateMode = document.getElementById('createApiPrivate').checked;
    
    if (!name) {
        showToast('Vui lòng nhập tên API', 'error');
        return;
    }
    if (!/^[\w]+$/.test(name)) {
        showToast('Tên API chỉ được chứa chữ, số và _', 'error');
        return;
    }
    
    try {
        const data = await apiFetch('/create', {
            method: 'POST',
            body: JSON.stringify({ name, displayName, webhook, privateMode }),
        });
        
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        showToast(`Tạo API thành công! API Key: ${data.apiKey}`, 'success');
        closeModal();
        loadApis();
        loadStats();
    } catch (e) {
        showToast('Lỗi khi tạo API', 'error');
    }
}

elements.createBotBtn.addEventListener('click', () => {
    if (!currentUser) {
        showToast('Vui lòng đăng nhập để tạo bot', 'error');
        return;
    }
    
    openModal('🤖 Tạo Bot mới', `
        <div class="form-group">
            <label>Tên bot <span style="color: var(--danger);">*</span></label>
            <input type="text" id="createBotName" placeholder="My Bot">
        </div>
        <div class="form-group">
            <label>Mã nguồn Python <span style="color: var(--danger);">*</span></label>
            <textarea id="createBotCode" placeholder="import discord&#10;from discord.ext import commands&#10;&#10;bot = commands.Bot(command_prefix='!')&#10;&#10;@bot.event&#10;async def on_ready():&#10;    print('Bot is ready!')&#10;&#10;bot.run('YOUR_TOKEN')" style="min-height: 200px;"></textarea>
            <small style="color: var(--text-muted);">Paste mã nguồn Discord bot của bạn</small>
        </div>
        <div class="form-group">
            <label>Environment Variables (JSON)</label>
            <input type="text" id="createBotEnv" placeholder='{"DISCORD_TOKEN": "your_token"}'>
        </div>
        <div class="form-group">
            <div class="checkbox-group">
                <input type="checkbox" id="createBotAutoRestart" checked>
                <label>Tự động restart khi crash</label>
            </div>
        </div>
        <div class="form-actions">
            <button onclick="closeModal()" class="btn btn-danger">Hủy</button>
            <button onclick="createBot()" class="btn btn-success">
                <i class="fas fa-plus"></i> Tạo
            </button>
        </div>
    `);
});

async function createBot() {
    const name = document.getElementById('createBotName').value.trim();
    const code = document.getElementById('createBotCode').value.trim();
    const env = document.getElementById('createBotEnv').value.trim();
    const autoRestart = document.getElementById('createBotAutoRestart').checked;
    
    if (!name) {
        showToast('Vui lòng nhập tên bot', 'error');
        return;
    }
    if (!code) {
        showToast('Vui lòng nhập mã nguồn bot', 'error');
        return;
    }
    
    try {
        const data = await apiFetch('/bot/create', {
            method: 'POST',
            body: JSON.stringify({ name, code, env, autoRestart }),
        });
        
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        showToast('Tạo bot thành công!', 'success');
        closeModal();
        loadBots();
        loadStats();
    } catch (e) {
        showToast('Lỗi khi tạo bot', 'error');
    }
}

elements.createMonitorBtn.addEventListener('click', () => {
    if (!currentUser) {
        showToast('Vui lòng đăng nhập để tạo monitor', 'error');
        return;
    }
    
    openModal('📡 Tạo Monitor mới', `
        <div class="form-group">
            <label>Tên monitor <span style="color: var(--danger);">*</span></label>
            <input type="text" id="createMonitorName" placeholder="My Service">
        </div>
        <div class="form-group">
            <label>URL <span style="color: var(--danger);">*</span></label>
            <input type="url" id="createMonitorUrl" placeholder="https://example.com">
        </div>
        <div class="form-group">
            <label>Interval (ms)</label>
            <input type="number" id="createMonitorInterval" value="60000" min="30000">
            <small style="color: var(--text-muted);">Tối thiểu 30000ms (30s)</small>
        </div>
        <div class="form-group">
            <label>Webhook URL (tùy chọn)</label>
            <input type="url" id="createMonitorWebhook" placeholder="https://discord.com/api/webhooks/...">
        </div>
        <div class="form-actions">
            <button onclick="closeModal()" class="btn btn-danger">Hủy</button>
            <button onclick="createMonitor()" class="btn btn-success">
                <i class="fas fa-plus"></i> Tạo
            </button>
        </div>
    `);
});

async function createMonitor() {
    const name = document.getElementById('createMonitorName').value.trim();
    const url = document.getElementById('createMonitorUrl').value.trim();
    const interval = parseInt(document.getElementById('createMonitorInterval').value);
    const webhook = document.getElementById('createMonitorWebhook').value.trim();
    
    if (!name || !url) {
        showToast('Vui lòng điền đầy đủ thông tin', 'error');
        return;
    }
    if (!url.startsWith('http')) {
        showToast('URL phải bắt đầu bằng http/https', 'error');
        return;
    }
    if (interval < 30000) {
        showToast('Interval tối thiểu là 30000ms', 'error');
        return;
    }
    
    try {
        const data = await apiFetch('/monitor/create', {
            method: 'POST',
            body: JSON.stringify({ name, url, interval, webhook }),
        });
        
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        showToast('Tạo monitor thành công!', 'success');
        closeModal();
        loadMonitors();
        loadStats();
    } catch (e) {
        showToast('Lỗi khi tạo monitor', 'error');
    }
}

// ============================================
// CHAT
// ============================================
function connectChat() {
    const token = getToken();
    if (!token) {
        elements.chatMessages.innerHTML = `
            <div class="empty-state">
                <h3>💬 Đăng nhập để chat</h3>
                <p>Vui lòng đăng nhập để tham gia chat room</p>
            </div>
        `;
        return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        return;
    }
    
    const wsUrl = `${WS_BASE}/ws?token=${token}`;
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        chatConnected = true;
        elements.chatMessages.innerHTML = '';
        elements.onlineCount.textContent = '?';
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'history') {
                elements.chatMessages.innerHTML = '';
                data.messages.forEach(msg => addChatMessage(msg));
            } else if (data.type === 'msg') {
                addChatMessage(data);
            } else if (data.type === 'online') {
                elements.onlineCount.textContent = data.count || 0;
            }
        } catch (e) {
            console.error('WebSocket message error:', e);
        }
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        chatConnected = false;
        elements.onlineCount.textContent = '0';
        setTimeout(() => {
            if (currentUser) connectChat();
        }, 3000);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function sendChatMessage() {
    const content = elements.chatInput.value.trim();
    if (!content) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        showToast('Không kết nối được chat server', 'error');
        return;
    }
    
    ws.send(JSON.stringify({ type: 'msg', content }));
    elements.chatInput.value = '';
}

elements.chatSendBtn.addEventListener('click', sendChatMessage);
elements.chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

// ============================================
// DOWNLOAD DB FUNCTIONS - KHÔNG CẦN ROLE
// ============================================

async function downloadDatabase() {
    console.log('📥 downloadDatabase called');
    openModal('📥 Tải Database', `
        <div style="margin-bottom: 16px;">
            <div style="background: #e8f5e9; padding: 12px; border-radius: 8px; border-left: 4px solid #4caf50; margin-bottom: 16px;">
                <strong>📌 Hướng dẫn:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 0.9rem;">
                    <li>Nhập mật khẩu để tải file DB</li>
                    <li>File sẽ được tải xuống thư mục <strong>Downloads</strong></li>
                    <li>File bao gồm: API, Users, Bots, Monitors, Jobs</li>
                </ul>
            </div>
            
            <div class="form-group">
                <label>🔑 Mật khẩu <span style="color: var(--danger);">*</span></label>
                <input type="password" id="downloadDbPassword" placeholder="Nhập mật khẩu" style="font-size: 1.1rem; padding: 12px;">
                <small style="color: var(--text-muted);">Mật khẩu mặc định: <strong>hoitatsuya@.,123</strong></small>
            </div>
            
            <div id="downloadDbStatus" style="margin-top: 12px; padding: 10px; border-radius: 8px; display: none; text-align: center;">
                <i class="fas fa-spinner fa-spin"></i> Đang tạo file...
            </div>
            
            <div class="form-actions" style="margin-top: 16px;">
                <button onclick="closeModal()" class="btn btn-danger">Hủy</button>
                <button onclick="confirmDownloadDb()" class="btn btn-success" style="flex: 2;">
                    <i class="fas fa-download"></i> Tải DB ngay
                </button>
            </div>
        </div>
    `);
    
    const statusDiv = document.getElementById('downloadDbStatus');
    if (statusDiv) {
        statusDiv.style.display = 'none';
        statusDiv.innerHTML = '';
    }
}

async function confirmDownloadDb() {
    console.log('🔑 confirmDownloadDb called');
    const password = document.getElementById('downloadDbPassword').value.trim();
    
    if (!password) {
        showToast('Vui lòng nhập mật khẩu', 'error');
        return;
    }
    
    const statusDiv = document.getElementById('downloadDbStatus');
    if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tạo file backup...';
        statusDiv.style.background = 'var(--bg-secondary)';
        statusDiv.style.color = 'var(--text-primary)';
    }
    
    try {
        const data = await apiFetch('/backup/download', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
        console.log('📦 Backup data received:', data);
        
        if (data.err) {
            showToast(data.err, 'error');
            if (statusDiv) {
                statusDiv.innerHTML = `<i class="fas fa-exclamation-circle" style="color: var(--danger);"></i> Lỗi: ${data.err}`;
                statusDiv.style.background = '#ffebee';
                statusDiv.style.color = '#c62828';
            }
            return;
        }
        
        const blob = new Blob([data.backup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = `database_${new Date(data.timestamp).toISOString().slice(0,10)}.json`;
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (statusDiv) {
            statusDiv.innerHTML = `
                <i class="fas fa-check-circle" style="color: var(--success);"></i>
                ✅ Tải thành công!<br>
                <span style="font-size: 0.85rem;">File: ${filename} (${(data.size / 1024).toFixed(2)} KB)</span>
            `;
            statusDiv.style.background = '#e8f5e9';
            statusDiv.style.color = '#2e7d32';
        }
        
        showToast(`✅ Đã tải DB: ${filename}`, 'success');
        
        setTimeout(() => {
            closeModal();
        }, 2000);
        
    } catch (e) {
        console.error('❌ Lỗi tải DB:', e);
        showToast('Lỗi tải DB: ' + e.message, 'error');
        if (statusDiv) {
            statusDiv.innerHTML = `<i class="fas fa-exclamation-circle" style="color: var(--danger);"></i> Lỗi: ${e.message}`;
            statusDiv.style.background = '#ffebee';
            statusDiv.style.color = '#c62828';
        }
    }
}

// ============================================
// BACKUP FUNCTIONS - KHÔNG CẦN ROLE
// ============================================

async function showBackupModal() {
    console.log('💾 showBackupModal called');
    openModal('💾 Backup & Restore Database', `
        <div style="margin-bottom: 16px;">
            <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 8px 0;">📊 Thông tin hiện tại</h4>
                <div id="backupStats" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.9rem;">
                    <div>Đang tải...</div>
                </div>
            </div>
            
            <div class="form-group">
                <label>🔑 Mật khẩu backup <span style="color: var(--danger);">*</span></label>
                <input type="password" id="backupPassword" placeholder="Nhập mật khẩu backup">
                <small style="color: var(--text-muted);">Mật khẩu mặc định: hoitatsuya@.,123</small>
            </div>
            
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px;">
                <button onclick="downloadBackup()" class="btn btn-success" style="flex: 1;">
                    <i class="fas fa-download"></i> Tải backup về máy
                </button>
                <button onclick="saveBackupLocal()" class="btn btn-primary" style="flex: 1;">
                    <i class="fas fa-save"></i> Lưu vào server
                </button>
            </div>
            
            <hr style="margin: 16px 0; border-color: var(--border-color);">
            
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <button onclick="showRestoreModal()" class="btn btn-warning" style="flex: 1;">
                    <i class="fas fa-upload"></i> Restore từ file
                </button>
                <button onclick="viewServerBackups()" class="btn btn-info" style="flex: 1;">
                    <i class="fas fa-folder"></i> Xem backup trên server
                </button>
            </div>
        </div>
    `);
    
    loadBackupStats();
}

async function loadBackupStats() {
    try {
        const data = await apiFetch('/backup/info');
        if (data.err) return;
        
        const statsHtml = `
            <div><strong>API:</strong> ${data.stats.apis}</div>
            <div><strong>Users:</strong> ${data.stats.users}</div>
            <div><strong>Bots:</strong> ${data.stats.bots}</div>
            <div><strong>Monitors:</strong> ${data.stats.monitors}</div>
            <div><strong>Jobs:</strong> ${data.stats.totalJobs}</div>
            <div><strong>Sessions:</strong> ${data.stats.sessions}</div>
        `;
        
        document.getElementById('backupStats').innerHTML = statsHtml;
    } catch (e) {
        console.error('Failed to load backup stats:', e);
    }
}

async function downloadBackup() {
    const password = document.getElementById('backupPassword').value.trim();
    
    if (!password) {
        showToast('Vui lòng nhập mật khẩu backup', 'error');
        return;
    }
    
    try {
        const btn = document.querySelector('.btn-success');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tạo...';
        }
        
        const data = await apiFetch('/backup/download', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
        
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        const blob = new Blob([data.backup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = `backup_${new Date(data.timestamp).toISOString().slice(0,10)}.json`;
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast(`✅ Backup tạo thành công! (${(data.size / 1024).toFixed(2)} KB)`, 'success');
        closeModal();
    } catch (e) {
        showToast('Lỗi tạo backup: ' + e.message, 'error');
    } finally {
        const btn = document.querySelector('.btn-success');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-download"></i> Tải backup về máy';
        }
    }
}

async function saveBackupLocal() {
    const password = document.getElementById('backupPassword').value.trim();
    
    if (!password) {
        showToast('Vui lòng nhập mật khẩu backup', 'error');
        return;
    }
    
    try {
        const btn = document.querySelector('.btn-primary');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
        }
        
        const data = await apiFetch('/backup/save-local', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
        
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        showToast(`✅ Backup đã lưu vào server: ${data.filename} (${(data.size / 1024).toFixed(2)} KB)`, 'success');
        closeModal();
    } catch (e) {
        showToast('Lỗi lưu backup: ' + e.message, 'error');
    } finally {
        const btn = document.querySelector('.btn-primary');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Lưu vào server';
        }
    }
}

function showRestoreModal() {
    const password = document.getElementById('backupPassword').value.trim();
    
    if (!password) {
        showToast('Vui lòng nhập mật khẩu backup trước khi restore', 'error');
        return;
    }
    
    openModal('📤 Restore Database', `
        <div style="margin-bottom: 16px;">
            <div style="background: #fff3cd; padding: 12px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 16px;">
                <strong>⚠️ Cảnh báo:</strong> Restore sẽ <strong>thay thế toàn bộ dữ liệu hiện tại</strong> bằng dữ liệu từ backup. 
                Hãy chắc chắn bạn đã tạo backup hiện tại trước khi tiếp tục.
            </div>
            
            <div class="form-group">
                <label>Chọn file backup <span style="color: var(--danger);">*</span></label>
                <input type="file" id="restoreFile" accept=".json" style="padding: 8px; border: 1px solid var(--border-color); border-radius: 8px; width: 100%;">
                <small style="color: var(--text-muted);">Chọn file backup đã tải về hoặc từ server</small>
            </div>
            
            <div class="form-group">
                <label>🔑 Mật khẩu backup <span style="color: var(--danger);">*</span></label>
                <input type="password" id="restorePassword" value="${password}" placeholder="Nhập mật khẩu backup">
            </div>
            
            <div class="form-actions" style="margin-top: 16px;">
                <button onclick="closeModal()" class="btn btn-danger">Hủy</button>
                <button onclick="restoreBackup()" class="btn btn-warning">
                    <i class="fas fa-exclamation-triangle"></i> Xác nhận Restore
                </button>
            </div>
        </div>
    `);
}

async function restoreBackup() {
    const fileInput = document.getElementById('restoreFile');
    const password = document.getElementById('restorePassword').value.trim();
    
    if (!fileInput.files || !fileInput.files[0]) {
        showToast('Vui lòng chọn file backup', 'error');
        return;
    }
    
    if (!password) {
        showToast('Vui lòng nhập mật khẩu backup', 'error');
        return;
    }
    
    if (!confirm('⚠️ Bạn có chắc chắn muốn RESTORE toàn bộ dữ liệu? Hành động này KHÔNG THỂ HOÀN TÁC!')) {
        return;
    }
    
    try {
        const btn = document.querySelector('.btn-warning');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang restore...';
        }
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                const backupData = e.target.result;
                
                const data = await apiFetch('/backup/restore', {
                    method: 'POST',
                    body: JSON.stringify({ password, backup: backupData })
                });
                
                if (data.err) {
                    showToast(data.err, 'error');
                    return;
                }
                
                showToast(`✅ Restore thành công! Đã khôi phục ${data.stats.apis} API, ${data.stats.users} users, ${data.stats.bots} bots, ${data.stats.monitors} monitors`, 'success');
                closeModal();
                
                await loadAllData();
                
            } catch (error) {
                showToast('Lỗi restore: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
        
    } catch (e) {
        showToast('Lỗi restore: ' + e.message, 'error');
    } finally {
        const btn = document.querySelector('.btn-warning');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Xác nhận Restore';
        }
    }
}

async function viewServerBackups() {
    try {
        const data = await apiFetch('/backup/list');
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        if (!data.files || data.files.length === 0) {
            showToast('Chưa có file backup nào trên server', 'info');
            return;
        }
        
        let filesHtml = data.files.map(f => `
            <div style="display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border-color); align-items: center;">
                <div>
                    <div style="font-weight: 500;">${escapeHtml(f.name)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        ${(f.size / 1024).toFixed(2)} KB • ${new Date(f.modified).toLocaleString('vi-VN')}
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="downloadServerBackup('${escapeHtml(f.name)}')" class="btn btn-info btn-sm">
                        <i class="fas fa-download"></i>
                    </button>
                    <button onclick="deleteServerBackup('${escapeHtml(f.name)}')" class="btn btn-danger btn-sm">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        openModal('📁 Danh sách backup trên server', `
            <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
                ${filesHtml}
            </div>
            <div style="margin-top: 16px; display: flex; gap: 12px;">
                <button onclick="closeModal()" class="btn btn-primary">Đóng</button>
                <button onclick="refreshBackupList()" class="btn btn-info">
                    <i class="fas fa-sync"></i> Làm mới
                </button>
            </div>
            <div style="margin-top: 12px; padding: 8px; background: var(--bg-secondary); border-radius: 8px; font-size: 0.85rem; color: var(--text-muted);">
                📁 Đường dẫn: <strong>/tmp/</strong>
            </div>
        `);
    } catch (e) {
        showToast('Lỗi tải danh sách backup: ' + e.message, 'error');
    }
}

async function downloadServerBackup(filename) {
    try {
        const password = document.getElementById('backupPassword')?.value?.trim() || prompt('Nhập mật khẩu backup:');
        
        if (!password) {
            showToast('Vui lòng nhập mật khẩu backup', 'error');
            return;
        }
        
        const data = await apiFetch('/backup/download-server', {
            method: 'POST',
            body: JSON.stringify({ password, filename })
        });
        
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        const blob = new Blob([data.backup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast(`✅ Đã tải xuống: ${filename}`, 'success');
    } catch (e) {
        showToast('Lỗi tải backup: ' + e.message, 'error');
    }
}

async function deleteServerBackup(filename) {
    if (!confirm(`Bạn có chắc muốn xóa file ${filename}?`)) return;
    
    try {
        const password = document.getElementById('backupPassword')?.value?.trim() || prompt('Nhập mật khẩu backup:');
        
        if (!password) {
            showToast('Vui lòng nhập mật khẩu backup', 'error');
            return;
        }
        
        const data = await apiFetch('/backup/delete', {
            method: 'POST',
            body: JSON.stringify({ password, filename })
        });
        
        if (data.err) {
            showToast(data.err, 'error');
            return;
        }
        
        showToast(`✅ Đã xóa: ${filename}`, 'success');
        viewServerBackups();
    } catch (e) {
        showToast('Lỗi xóa backup: ' + e.message, 'error');
    }
}

async function refreshBackupList() {
    await viewServerBackups();
}

// ============================================
// BUTTON EVENTS - QUAN TRỌNG
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 DOM fully loaded, attaching events...');
    
    const downloadBtn = document.getElementById('downloadDbBtn');
    const backupBtn = document.getElementById('backupBtn');
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('📥 Download DB button clicked');
            downloadDatabase();
        });
        console.log('✅ Download DB button event attached');
    } else {
        console.error('❌ downloadDbBtn not found');
    }
    
    if (backupBtn) {
        backupBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('💾 Backup button clicked');
            showBackupModal();
        });
        console.log('✅ Backup button event attached');
    } else {
        console.error('❌ backupBtn not found');
    }
});

// ============================================
// INITIALIZATION
// ============================================
async function loadAllData() {
    const promises = [loadStats(), loadApis()];
    if (currentUser) {
        promises.push(loadBots(), loadMonitors());
        connectChat();
    }
    await Promise.all(promises);
}

async function init() {
    await checkAuth();
    await loadAllData();
    
    if (statsInterval) clearInterval(statsInterval);
    statsInterval = setInterval(loadStats, 30000);
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab === 'bots' && elements.botList.children.length === 0) {
                loadBots();
            }
            if (tab === 'monitors' && elements.monitorList.children.length === 0) {
                loadMonitors();
            }
        });
    });
    
    console.log('🚀 Job Queue System loaded successfully!');
}

// Start the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ============================================
// GLOBAL ERROR HANDLING
// ============================================
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('Đã xảy ra lỗi, vui lòng thử lại', 'error');
});
