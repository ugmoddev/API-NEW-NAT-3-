// ==============================
// JOB QUEUE SYSTEM - OPTIMIZED
// ==============================

// ===== CONFIGURATION =====
const CONFIG = {
    API_BASE: window.location.origin,
    REFRESH_INTERVAL: 30000,
    CHAT_REFRESH_INTERVAL: 3000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
};

// ===== STATE =====
const state = {
    user: null,
    currentTab: 'apis',
    data: {
        apis: [],
        bots: [],
        monitors: [],
        chat: [],
    },
    refreshTimer: null,
    chatTimer: null,
};

// ===== DOM CACHE =====
const DOM = {
    // Stats
    totalApis: document.getElementById('totalApis'),
    totalJobs: document.getElementById('totalJobs'),
    totalUsers: document.getElementById('totalUsers'),
    runningBots: document.getElementById('runningBots'),
    trendEnabledApis: document.getElementById('trendEnabledApis'),
    trendAvgJobs: document.getElementById('trendAvgJobs'),
    trendSessions: document.getElementById('trendSessions'),
    trendStoppedBots: document.getElementById('trendStoppedBots'),
    statEnabledApis: document.getElementById('statEnabledApis'),
    statPrivateApis: document.getElementById('statPrivateApis'),
    statRunningBots: document.getElementById('statRunningBots'),
    statOnlineMonitors: document.getElementById('statOnlineMonitors'),
    statActiveSessions: document.getElementById('statActiveSessions'),
    statAvgJobs: document.getElementById('statAvgJobs'),
    statUsersByRole: document.getElementById('statUsersByRole'),
    statTopApis: document.getElementById('statTopApis'),
    
    // User
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    authBtn: document.getElementById('authBtn'),
    
    // Counts
    apiCount: document.getElementById('apiCount'),
    botCount: document.getElementById('botCount'),
    monitorCount: document.getElementById('monitorCount'),
    chatCount: document.getElementById('chatCount'),
    
    // Lists
    apiList: document.getElementById('apiList'),
    botList: document.getElementById('botList'),
    monitorList: document.getElementById('monitorList'),
    chatMessages: document.getElementById('chatMessages'),
    
    // Chat
    chatInput: document.getElementById('chatInput'),
    chatSendBtn: document.getElementById('chatSendBtn'),
    onlineCount: document.getElementById('onlineCount'),
    
    // Buttons
    createApiBtn: document.getElementById('createApiBtn'),
    createBotBtn: document.getElementById('createBotBtn'),
    createMonitorBtn: document.getElementById('createMonitorBtn'),
    downloadDbBtn: document.getElementById('downloadDbBtn'),
    backupBtn: document.getElementById('backupBtn'),
    
    // Modal
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalClose: document.querySelector('.modal-close'),
};

// ===== UTILITY FUNCTIONS =====
const Utils = {
    debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    },

    throttle(fn, limit = 300) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                fn(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    formatDate(date) {
        return new Date(date).toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    },

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    },

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    getStatusClass(status) {
        const statusMap = {
            'online': 'status-online',
            'running': 'status-running',
            'offline': 'status-offline',
            'stopped': 'status-stopped',
        };
        return statusMap[status] || 'status-offline';
    },

    getStatusText(status) {
        const textMap = {
            'online': 'Online',
            'running': 'Đang chạy',
            'offline': 'Offline',
            'stopped': 'Đã dừng',
        };
        return textMap[status] || status;
    }
};

// ===== API CLIENT =====
class ApiClient {
    constructor() {
        this.baseUrl = CONFIG.API_BASE;
        this.retryCount = 0;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            
            this.retryCount = 0;
            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            if (this.retryCount < CONFIG.MAX_RETRIES) {
                this.retryCount++;
                await Utils.sleep(CONFIG.RETRY_DELAY * this.retryCount);
                return this.request(endpoint, options);
            }
            this.retryCount = 0;
            throw error;
        }
    }

    // Auth endpoints
    async login(credentials) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: credentials,
        });
    }

    async logout() {
        return this.request('/api/auth/logout', {
            method: 'POST',
        });
    }

    async getCurrentUser() {
        return this.request('/api/auth/me');
    }

    // API endpoints
    async getApis() {
        return this.request('/api/apis');
    }

    async createApi(data) {
        return this.request('/api/apis', {
            method: 'POST',
            body: data,
        });
    }

    async updateApi(id, data) {
        return this.request(`/api/apis/${id}`, {
            method: 'PUT',
            body: data,
        });
    }

    async deleteApi(id) {
        return this.request(`/api/apis/${id}`, {
            method: 'DELETE',
        });
    }

    // Bot endpoints
    async getBots() {
        return this.request('/api/bots');
    }

    async createBot(data) {
        return this.request('/api/bots', {
            method: 'POST',
            body: data,
        });
    }

    async updateBot(id, data) {
        return this.request(`/api/bots/${id}`, {
            method: 'PUT',
            body: data,
        });
    }

    async deleteBot(id) {
        return this.request(`/api/bots/${id}`, {
            method: 'DELETE',
        });
    }

    async startBot(id) {
        return this.request(`/api/bots/${id}/start`, {
            method: 'POST',
        });
    }

    async stopBot(id) {
        return this.request(`/api/bots/${id}/stop`, {
            method: 'POST',
        });
    }

    // Monitor endpoints
    async getMonitors() {
        return this.request('/api/monitors');
    }

    async createMonitor(data) {
        return this.request('/api/monitors', {
            method: 'POST',
            body: data,
        });
    }

    async updateMonitor(id, data) {
        return this.request(`/api/monitors/${id}`, {
            method: 'PUT',
            body: data,
        });
    }

    async deleteMonitor(id) {
        return this.request(`/api/monitors/${id}`, {
            method: 'DELETE',
        });
    }

    // Chat endpoints
    async getChatMessages() {
        return this.request('/api/chat/messages');
    }

    async sendChatMessage(content) {
        return this.request('/api/chat/messages', {
            method: 'POST',
            body: { content },
        });
    }

    async getOnlineUsers() {
        return this.request('/api/chat/online');
    }

    // Stats
    async getStats() {
        return this.request('/api/stats');
    }

    // System
    async downloadDb() {
        const response = await fetch(`${this.baseUrl}/api/system/download-db`);
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${new Date().toISOString().slice(0,10)}.db`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    async backup() {
        return this.request('/api/system/backup', {
            method: 'POST',
        });
    }
}

// ===== TOAST NOTIFICATION =====
class Toast {
    constructor() {
        this.container = document.getElementById('toastContainer');
    }

    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${this.getIcon(type)}"></i>
            <span>${message}</span>
        `;

        this.container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (toast.parentNode) toast.remove();
                }, 300);
            }
        }, duration);
    }

    getIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle',
        };
        return icons[type] || icons.info;
    }

    success(message, duration) {
        this.show(message, 'success', duration);
    }

    error(message, duration) {
        this.show(message, 'error', duration);
    }

    warning(message, duration) {
        this.show(message, 'warning', duration);
    }

    info(message, duration) {
        this.show(message, 'info', duration);
    }
}

// ===== MODAL MANAGER =====
class ModalManager {
    constructor() {
        this.modal = DOM.modal;
        this.title = DOM.modalTitle;
        this.body = DOM.modalBody;
        this.closeBtn = DOM.modalClose;
        this.isOpen = false;

        this.closeBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
    }

    open(title, html) {
        this.title.textContent = title;
        this.body.innerHTML = html;
        this.modal.style.display = 'flex';
        this.isOpen = true;
        document.body.style.overflow = 'hidden';
        // Focus trap
        this.modal.focus();
    }

    close() {
        this.modal.style.display = 'none';
        this.isOpen = false;
        document.body.style.overflow = '';
    }
}

// ===== MAIN APP =====
class JobQueueApp {
    constructor() {
        this.api = new ApiClient();
        this.toast = new Toast();
        this.modal = new ModalManager();

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUser();
        this.loadData();
        this.setupAutoRefresh();
    }

    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Auth
        DOM.authBtn.addEventListener('click', () => this.handleAuth());

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Create buttons
        DOM.createApiBtn.addEventListener('click', () => this.showCreateApiForm());
        DOM.createBotBtn.addEventListener('click', () => this.showCreateBotForm());
        DOM.createMonitorBtn.addEventListener('click', () => this.showCreateMonitorForm());

        // System
        DOM.downloadDbBtn.addEventListener('click', () => this.handleDownloadDb());
        DOM.backupBtn.addEventListener('click', () => this.handleBackup());

        // Chat
        DOM.chatSendBtn.addEventListener('click', () => this.sendChatMessage());
        DOM.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
    }

    // ===== AUTH =====
    async handleAuth() {
        if (state.user) {
            await this.logout();
        } else {
            this.showLoginForm();
        }
    }

    showLoginForm() {
        const html = `
            <form id="loginForm" class="modal-form">
                <div class="form-group">
                    <label for="loginUsername">Tên đăng nhập</label>
                    <input type="text" id="loginUsername" placeholder="Username" required autofocus>
                </div>
                <div class="form-group">
                    <label for="loginPassword">Mật khẩu</label>
                    <input type="password" id="loginPassword" placeholder="Password" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">
                    <i class="fas fa-sign-in-alt"></i> Đăng nhập
                </button>
            </form>
        `;

        this.modal.open('Đăng nhập', html);

        const form = document.getElementById('loginForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;

            if (!username || !password) {
                this.toast.warning('Vui lòng nhập đầy đủ thông tin');
                return;
            }

            try {
                await this.api.login({ username, password });
                this.toast.success('Đăng nhập thành công!');
                this.modal.close();
                await this.loadUser();
                await this.loadData();
            } catch (error) {
                this.toast.error(error.message || 'Đăng nhập thất bại');
            }
        });
    }

    async logout() {
        if (!confirm('Bạn có chắc muốn đăng xuất?')) return;

        try {
            await this.api.logout();
            this.toast.success('Đã đăng xuất');
            state.user = null;
            this.updateUserUI();
            await this.loadData();
        } catch (error) {
            this.toast.error('Đăng xuất thất bại');
        }
    }

    async loadUser() {
        try {
            const user = await this.api.getCurrentUser();
            state.user = user;
            this.updateUserUI();
        } catch (error) {
            state.user = null;
            this.updateUserUI();
        }
    }

    updateUserUI() {
        if (state.user) {
            DOM.userName.textContent = state.user.username || state.user.name || 'User';
            DOM.userRole.textContent = state.user.role || 'user';
            DOM.authBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Đăng xuất</span>';
            DOM.userAvatar.src = state.user.avatar || '/assets/images/default-avatar.png';
            DOM.userAvatar.alt = `Avatar của ${state.user.username}`;
        } else {
            DOM.userName.textContent = 'Guest';
            DOM.userRole.textContent = 'visitor';
            DOM.authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Đăng nhập</span>';
            DOM.userAvatar.src = '/assets/images/default-avatar.png';
            DOM.userAvatar.alt = 'Default avatar';
        }
    }

    // ===== TAB MANAGEMENT =====
    switchTab(tabId) {
        if (state.currentTab === tabId) return;
        
        state.currentTab = tabId;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });

        // Load data for the tab
        this.loadTabData(tabId);

        // Setup chat refresh if needed
        if (tabId === 'chat') {
            this.setupChatRefresh();
        } else if (this.chatTimer) {
            clearInterval(this.chatTimer);
            this.chatTimer = null;
        }
    }

    async loadTabData(tabId) {
        switch (tabId) {
            case 'apis':
                await this.loadApis();
                break;
            case 'bots':
                await this.loadBots();
                break;
            case 'monitors':
                await this.loadMonitors();
                break;
            case 'chat':
                await this.loadChat();
                break;
        }
    }

    // ===== DATA LOADING =====
    async loadData() {
        try {
            await Promise.all([
                this.loadStats(),
                this.loadApis(),
                this.loadBots(),
                this.loadMonitors(),
            ]);
            
            if (state.currentTab === 'chat') {
                await this.loadChat();
            }
        } catch (error) {
            console.error('Load data error:', error);
            this.toast.error('Lỗi tải dữ liệu');
        }
    }

    async loadStats() {
        try {
            const stats = await this.api.getStats();
            this.updateStats(stats);
        } catch (error) {
            console.error('Load stats error:', error);
        }
    }

    updateStats(stats) {
        // Main stats
        DOM.totalApis.textContent = stats.totalApis || 0;
        DOM.totalJobs.textContent = stats.totalJobs || 0;
        DOM.totalUsers.textContent = stats.totalUsers || 0;
        DOM.runningBots.textContent = stats.runningBots || 0;
        DOM.trendEnabledApis.textContent = stats.enabledApis || 0;
        DOM.trendAvgJobs.textContent = stats.avgJobsPerApi || 0;
        DOM.trendSessions.textContent = stats.activeSessions || 0;
        DOM.trendStoppedBots.textContent = stats.stoppedBots || 0;

        // Detailed stats
        DOM.statEnabledApis.innerHTML = `${stats.enabledApis || 0}<span class="detail-row-sub">/ ${stats.totalApis || 0}</span>`;
        DOM.statPrivateApis.textContent = stats.privateApis || 0;
        DOM.statRunningBots.innerHTML = `${stats.runningBots || 0}<span class="detail-row-sub">/ ${stats.totalBots || 0}</span>`;
        DOM.statOnlineMonitors.innerHTML = `${stats.onlineMonitors || 0}<span class="detail-row-sub">/ ${stats.totalMonitors || 0}</span>`;
        DOM.statActiveSessions.textContent = stats.activeSessions || 0;
        DOM.statAvgJobs.textContent = stats.avgJobsPerApi || 0;

        // Users by role
        this.updateUsersByRole(stats.usersByRole);

        // Top APIs
        this.updateTopApis(stats.topApis);
    }

    updateUsersByRole(usersByRole) {
        if (!usersByRole || Object.keys(usersByRole).length === 0) {
            DOM.statUsersByRole.innerHTML = '<div class="detail-empty">Chưa có dữ liệu</div>';
            return;
        }

        const roleColors = {
            admin: '#ef4444',
            user: '#10b981',
            moderator: '#f59e0b',
            visitor: '#6c5ce7',
        };

        const html = Object.entries(usersByRole)
            .map(([role, count]) => `
                <div class="detail-row">
                    <span class="detail-row-label">
                        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${roleColors[role] || '#888'};margin-right:8px;"></span>
                        ${Utils.escapeHTML(role)}
                    </span>
                    <span class="detail-row-value">${count}</span>
                </div>
            `).join('');

        DOM.statUsersByRole.innerHTML = html;
    }

    updateTopApis(topApis) {
        if (!topApis || topApis.length === 0) {
            DOM.statTopApis.innerHTML = '<div class="detail-empty">Chưa có dữ liệu</div>';
            return;
        }

        const html = topApis
            .slice(0, 5)
            .map((api, index) => `
                <div class="detail-row">
                    <span class="detail-row-label">
                        <span style="display:inline-block;width:20px;text-align:center;font-weight:bold;color:${index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#cd7f32' : '#666'};margin-right:8px;">
                            #${index + 1}
                        </span>
                        ${Utils.escapeHTML(api.name)}
                    </span>
                    <span class="detail-row-value">${api.jobCount} jobs</span>
                </div>
            `).join('');

        DOM.statTopApis.innerHTML = html;
    }

    // ===== API CRUD =====
    async loadApis() {
        try {
            const apis = await this.api.getApis();
            state.data.apis = apis;
            DOM.apiCount.textContent = apis.length;
            this.renderApis(apis);
        } catch (error) {
            console.error('Load APIs error:', error);
            DOM.apiList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Không thể tải danh sách API</p></div>';
        }
    }

    renderApis(apis) {
        if (!apis || apis.length === 0) {
            DOM.apiList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-code fa-3x"></i>
                    <p>Chưa có API nào</p>
                    <button class="btn btn-success" onclick="app.showCreateApiForm()">
                        <i class="fas fa-plus"></i> Tạo API đầu tiên
                    </button>
                </div>
            `;
            return;
        }

        const html = apis.map(api => `
            <div class="api-card ${api.enabled ? 'enabled' : 'disabled'}">
                <div class="card-header">
                    <div class="card-title">
                        <i class="fas fa-${api.enabled ? 'check-circle' : 'times-circle'}" style="color:${api.enabled ? 'var(--success)' : 'var(--danger)'}"></i>
                        ${Utils.escapeHTML(api.name)}
                    </div>
                    <span class="status-badge ${api.enabled ? 'status-running' : 'status-stopped'}">
                        ${api.enabled ? 'Đang chạy' : 'Đã dừng'}
                    </span>
                </div>
                ${api.owner ? `<div class="card-owner"><i class="fas fa-user"></i> ${Utils.escapeHTML(api.owner)}</div>` : ''}
                ${api.description ? `<p style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:8px;">${Utils.escapeHTML(api.description)}</p>` : ''}
                <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">
                    <code style="background:var(--bg-secondary);padding:2px 8px;border-radius:4px;">${Utils.escapeHTML(api.endpoint || `/api/${api.name}`)}</code>
                    ${api.private ? ' <span class="status-badge status-stopped">Riêng tư</span>' : ''}
                </div>
                <div class="card-stats">
                    <span class="stat-item"><i class="fas fa-tasks"></i> ${api.jobCount || 0} jobs</span>
                    <span class="stat-item"><i class="fas fa-calendar"></i> ${Utils.formatDate(api.createdAt || Date.now())}</span>
                </div>
                <div class="card-actions">
                    <button onclick="app.toggleApi(${api.id})" class="btn btn-sm ${api.enabled ? 'btn-warning' : 'btn-success'}">
                        <i class="fas ${api.enabled ? 'fa-pause' : 'fa-play'}"></i>
                    </button>
                    <button onclick="app.editApi(${api.id})" class="btn btn-sm btn-primary">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="app.deleteApi(${api.id})" class="btn btn-sm btn-danger">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        DOM.apiList.innerHTML = html;
    }

    showCreateApiForm() {
        const html = `
            <form id="apiForm" class="modal-form">
                <div class="form-group">
                    <label for="apiName">Tên API</label>
                    <input type="text" id="apiName" placeholder="Nhập tên API" required autofocus>
                </div>
                <div class="form-group">
                    <label for="apiDescription">Mô tả</label>
                    <textarea id="apiDescription" rows="3" placeholder="Mô tả API"></textarea>
                </div>
                <div class="form-group">
                    <label for="apiEndpoint">Endpoint</label>
                    <input type="text" id="apiEndpoint" placeholder="/api/your-endpoint">
                </div>
                <div class="form-group checkbox-group">
                    <input type="checkbox" id="apiEnabled" checked>
                    <label for="apiEnabled">Bật API</label>
                </div>
                <div class="form-group checkbox-group">
                    <input type="checkbox" id="apiPrivate">
                    <label for="apiPrivate">API riêng tư</label>
                </div>
                <button type="submit" class="btn btn-success" style="width:100%;justify-content:center;">
                    <i class="fas fa-plus"></i> Tạo API
                </button>
            </form>
        `;

        this.modal.open('Tạo API mới', html);

        document.getElementById('apiForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('apiName').value.trim(),
                description: document.getElementById('apiDescription').value.trim(),
                endpoint: document.getElementById('apiEndpoint').value.trim() || undefined,
                enabled: document.getElementById('apiEnabled').checked,
                private: document.getElementById('apiPrivate').checked,
            };

            if (!data.name) {
                this.toast.warning('Vui lòng nhập tên API');
                return;
            }

            try {
                await this.api.createApi(data);
                this.toast.success('Tạo API thành công!');
                this.modal.close();
                await this.loadApis();
                await this.loadStats();
            } catch (error) {
                this.toast.error(error.message || 'Tạo API thất bại');
            }
        });
    }

    async toggleApi(id) {
        try {
            const api = state.data.apis.find(a => a.id === id);
            if (!api) return;

            await this.api.updateApi(id, { enabled: !api.enabled });
            this.toast.success(`Đã ${api.enabled ? 'tắt' : 'bật'} API`);
            await this.loadApis();
            await this.loadStats();
        } catch (error) {
            this.toast.error('Thao tác thất bại');
        }
    }

    editApi(id) {
        const api = state.data.apis.find(a => a.id === id);
        if (!api) return;

        const html = `
            <form id="editApiForm" class="modal-form">
                <div class="form-group">
                    <label for="editApiName">Tên API</label>
                    <input type="text" id="editApiName" value="${Utils.escapeHTML(api.name)}" required autofocus>
                </div>
                <div class="form-group">
                    <label for="editApiDescription">Mô tả</label>
                    <textarea id="editApiDescription" rows="3">${Utils.escapeHTML(api.description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label for="editApiEndpoint">Endpoint</label>
                    <input type="text" id="editApiEndpoint" value="${Utils.escapeHTML(api.endpoint || '')}">
                </div>
                <div class="form-group checkbox-group">
                    <input type="checkbox" id="editApiEnabled" ${api.enabled ? 'checked' : ''}>
                    <label for="editApiEnabled">Bật API</label>
                </div>
                <div class="form-group checkbox-group">
                    <input type="checkbox" id="editApiPrivate" ${api.private ? 'checked' : ''}>
                    <label for="editApiPrivate">API riêng tư</label>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">
                    <i class="fas fa-save"></i> Cập nhật
                </button>
            </form>
        `;

        this.modal.open('Sửa API', html);

        document.getElementById('editApiForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('editApiName').value.trim(),
                description: document.getElementById('editApiDescription').value.trim(),
                endpoint: document.getElementById('editApiEndpoint').value.trim() || undefined,
                enabled: document.getElementById('editApiEnabled').checked,
                private: document.getElementById('editApiPrivate').checked,
            };

            if (!data.name) {
                this.toast.warning('Vui lòng nhập tên API');
                return;
            }

            try {
                await this.api.updateApi(id, data);
                this.toast.success('Cập nhật API thành công!');
                this.modal.close();
                await this.loadApis();
                await this.loadStats();
            } catch (error) {
                this.toast.error(error.message || 'Cập nhật thất bại');
            }
        });
    }

    async deleteApi(id) {
        if (!confirm('Bạn có chắc muốn xóa API này?')) return;

        try {
            await this.api.deleteApi(id);
            this.toast.success('Xóa API thành công!');
            await this.loadApis();
            await this.loadStats();
        } catch (error) {
            this.toast.error('Xóa API thất bại');
        }
    }

    // ===== BOT CRUD =====
    async loadBots() {
        try {
            const bots = await this.api.getBots();
            state.data.bots = bots;
            DOM.botCount.textContent = bots.length;
            this.renderBots(bots);
        } catch (error) {
            console.error('Load bots error:', error);
            DOM.botList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Không thể tải danh sách bot</p></div>';
        }
    }

    renderBots(bots) {
        if (!bots || bots.length === 0) {
            DOM.botList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-robot fa-3x"></i>
                    <p>Chưa có bot nào</p>
                    <button class="btn btn-success" onclick="app.showCreateBotForm()">
                        <i class="fas fa-plus"></i> Tạo bot đầu tiên
                    </button>
                </div>
            `;
            return;
        }

        const html = bots.map(bot => {
            const isRunning = bot.status === 'running';
            return `
                <div class="bot-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fas fa-robot" style="color:${isRunning ? 'var(--success)' : 'var(--danger)'}"></i>
                            ${Utils.escapeHTML(bot.name)}
                        </div>
                        <span class="status-badge ${isRunning ? 'status-running' : 'status-stopped'}">
                            ${isRunning ? 'Đang chạy' : 'Đã dừng'}
                        </span>
                    </div>
                    ${bot.owner ? `<div class="card-owner"><i class="fas fa-user"></i> ${Utils.escapeHTML(bot.owner)}</div>` : ''}
                    <p style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:8px;">${Utils.escapeHTML(bot.description || 'Không có mô tả')}</p>
                    <div class="card-stats">
                        <span class="stat-item"><i class="fab fa-discord"></i> ${bot.botToken ? 'Đã kết nối' : 'Chưa kết nối'}</span>
                        <span class="stat-item"><i class="fas fa-calendar"></i> ${Utils.formatDate(bot.createdAt || Date.now())}</span>
                    </div>
                    <div class="card-actions">
                        ${isRunning 
                            ? `<button onclick="app.stopBot(${bot.id})" class="btn btn-sm btn-danger"><i class="fas fa-stop"></i></button>`
                            : `<button onclick="app.startBot(${bot.id})" class="btn btn-sm btn-success"><i class="fas fa-play"></i></button>`
                        }
                        <button onclick="app.editBot(${bot.id})" class="btn btn-sm btn-primary"><i class="fas fa-edit"></i></button>
                        <button onclick="app.deleteBot(${bot.id})" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        DOM.botList.innerHTML = html;
    }

    showCreateBotForm() {
        const html = `
            <form id="botForm" class="modal-form">
                <div class="form-group">
                    <label for="botName">Tên Bot</label>
                    <input type="text" id="botName" placeholder="Nhập tên bot" required autofocus>
                </div>
                <div class="form-group">
                    <label for="botDescription">Mô tả</label>
                    <textarea id="botDescription" rows="3" placeholder="Mô tả bot"></textarea>
                </div>
                <div class="form-group">
                    <label for="botToken">Discord Bot Token</label>
                    <input type="password" id="botToken" placeholder="Nhập token Discord bot">
                    <small>Bắt buộc nếu bạn muốn bot hoạt động</small>
                </div>
                <button type="submit" class="btn btn-success" style="width:100%;justify-content:center;">
                    <i class="fas fa-plus"></i> Tạo Bot
                </button>
            </form>
        `;

        this.modal.open('Tạo Bot mới', html);

        document.getElementById('botForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('botName').value.trim(),
                description: document.getElementById('botDescription').value.trim(),
                botToken: document.getElementById('botToken').value.trim() || undefined,
            };

            if (!data.name) {
                this.toast.warning('Vui lòng nhập tên bot');
                return;
            }

            try {
                await this.api.createBot(data);
                this.toast.success('Tạo bot thành công!');
                this.modal.close();
                await this.loadBots();
                await this.loadStats();
            } catch (error) {
                this.toast.error(error.message || 'Tạo bot thất bại');
            }
        });
    }

    async startBot(id) {
        try {
            await this.api.startBot(id);
            this.toast.success('Bot đã được khởi động');
            await this.loadBots();
            await this.loadStats();
        } catch (error) {
            this.toast.error('Khởi động bot thất bại');
        }
    }

    async stopBot(id) {
        try {
            await this.api.stopBot(id);
            this.toast.success('Bot đã được dừng');
            await this.loadBots();
            await this.loadStats();
        } catch (error) {
            this.toast.error('Dừng bot thất bại');
        }
    }

    editBot(id) {
        const bot = state.data.bots.find(b => b.id === id);
        if (!bot) return;

        const html = `
            <form id="editBotForm" class="modal-form">
                <div class="form-group">
                    <label for="editBotName">Tên Bot</label>
                    <input type="text" id="editBotName" value="${Utils.escapeHTML(bot.name)}" required autofocus>
                </div>
                <div class="form-group">
                    <label for="editBotDescription">Mô tả</label>
                    <textarea id="editBotDescription" rows="3">${Utils.escapeHTML(bot.description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label for="editBotToken">Discord Bot Token</label>
                    <input type="password" id="editBotToken" placeholder="Nhập token Discord bot">
                    <small>Để trống nếu không muốn thay đổi</small>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">
                    <i class="fas fa-save"></i> Cập nhật
                </button>
            </form>
        `;

        this.modal.open('Sửa Bot', html);

        document.getElementById('editBotForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('editBotName').value.trim(),
                description: document.getElementById('editBotDescription').value.trim(),
                botToken: document.getElementById('editBotToken').value.trim() || undefined,
            };

            if (!data.name) {
                this.toast.warning('Vui lòng nhập tên bot');
                return;
            }

            try {
                await this.api.updateBot(id, data);
                this.toast.success('Cập nhật bot thành công!');
                this.modal.close();
                await this.loadBots();
            } catch (error) {
                this.toast.error(error.message || 'Cập nhật thất bại');
            }
        });
    }

    async deleteBot(id) {
        if (!confirm('Bạn có chắc muốn xóa bot này?')) return;

        try {
            await this.api.deleteBot(id);
            this.toast.success('Xóa bot thành công!');
            await this.loadBots();
            await this.loadStats();
        } catch (error) {
            this.toast.error('Xóa bot thất bại');
        }
    }

    // ===== MONITOR CRUD =====
    async loadMonitors() {
        try {
            const monitors = await this.api.getMonitors();
            state.data.monitors = monitors;
            DOM.monitorCount.textContent = monitors.length;
            this.renderMonitors(monitors);
        } catch (error) {
            console.error('Load monitors error:', error);
            DOM.monitorList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Không thể tải danh sách monitor</p></div>';
        }
    }

    renderMonitors(monitors) {
        if (!monitors || monitors.length === 0) {
            DOM.monitorList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-heartbeat fa-3x"></i>
                    <p>Chưa có monitor nào</p>
                    <button class="btn btn-success" onclick="app.showCreateMonitorForm()">
                        <i class="fas fa-plus"></i> Tạo monitor đầu tiên
                    </button>
                </div>
            `;
            return;
        }

        const html = monitors.map(monitor => {
            const isOnline = monitor.status === 'online';
            return `
                <div class="monitor-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fas fa-heartbeat" style="color:${isOnline ? 'var(--success)' : 'var(--danger)'}"></i>
                            ${Utils.escapeHTML(monitor.name)}
                        </div>
                        <span class="status-badge ${isOnline ? 'status-online' : 'status-offline'}">
                            ${isOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>
                    ${monitor.owner ? `<div class="card-owner"><i class="fas fa-user"></i> ${Utils.escapeHTML(monitor.owner)}</div>` : ''}
                    <div style="font-size:0.9rem;margin-bottom:8px;">
                        <a href="${Utils.escapeHTML(monitor.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:none;">
                            ${Utils.escapeHTML(monitor.url)}
                        </a>
                    </div>
                    <div class="card-stats">
                        <span class="stat-item"><i class="fas fa-clock"></i> ${monitor.interval || 60}s</span>
                        <span class="stat-item"><i class="fas fa-calendar"></i> ${Utils.formatDate(monitor.createdAt || Date.now())}</span>
                    </div>
                    <div class="card-actions">
                        <button onclick="app.editMonitor(${monitor.id})" class="btn btn-sm btn-primary"><i class="fas fa-edit"></i></button>
                        <button onclick="app.deleteMonitor(${monitor.id})" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        DOM.monitorList.innerHTML = html;
    }

    showCreateMonitorForm() {
        const html = `
            <form id="monitorForm" class="modal-form">
                <div class="form-group">
                    <label for="monitorName">Tên Monitor</label>
                    <input type="text" id="monitorName" placeholder="Nhập tên monitor" required autofocus>
                </div>
                <div class="form-group">
                    <label for="monitorUrl">URL</label>
                    <input type="url" id="monitorUrl" placeholder="https://example.com" required>
                </div>
                <div class="form-group">
                    <label for="monitorInterval">Thời gian kiểm tra (giây)</label>
                    <input type="number" id="monitorInterval" value="60" min="10" max="3600">
                </div>
                <button type="submit" class="btn btn-success" style="width:100%;justify-content:center;">
                    <i class="fas fa-plus"></i> Tạo Monitor
                </button>
            </form>
        `;

        this.modal.open('Tạo Monitor mới', html);

        document.getElementById('monitorForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('monitorName').value.trim(),
                url: document.getElementById('monitorUrl').value.trim(),
                interval: parseInt(document.getElementById('monitorInterval').value) || 60,
            };

            if (!data.name || !data.url) {
                this.toast.warning('Vui lòng nhập đầy đủ thông tin');
                return;
            }

            try {
                await this.api.createMonitor(data);
                this.toast.success('Tạo monitor thành công!');
                this.modal.close();
                await this.loadMonitors();
                await this.loadStats();
            } catch (error) {
                this.toast.error(error.message || 'Tạo monitor thất bại');
            }
        });
    }

    editMonitor(id) {
        const monitor = state.data.monitors.find(m => m.id === id);
        if (!monitor) return;

        const html = `
            <form id="editMonitorForm" class="modal-form">
                <div class="form-group">
                    <label for="editMonitorName">Tên Monitor</label>
                    <input type="text" id="editMonitorName" value="${Utils.escapeHTML(monitor.name)}" required autofocus>
                </div>
                <div class="form-group">
                    <label for="editMonitorUrl">URL</label>
                    <input type="url" id="editMonitorUrl" value="${Utils.escapeHTML(monitor.url)}" required>
                </div>
                <div class="form-group">
                    <label for="editMonitorInterval">Thời gian kiểm tra (giây)</label>
                    <input type="number" id="editMonitorInterval" value="${monitor.interval || 60}" min="10" max="3600">
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">
                    <i class="fas fa-save"></i> Cập nhật
                </button>
            </form>
        `;

        this.modal.open('Sửa Monitor', html);

        document.getElementById('editMonitorForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('editMonitorName').value.trim(),
                url: document.getElementById('editMonitorUrl').value.trim(),
                interval: parseInt(document.getElementById('editMonitorInterval').value) || 60,
            };

            if (!data.name || !data.url) {
                this.toast.warning('Vui lòng nhập đầy đủ thông tin');
                return;
            }

            try {
                await this.api.updateMonitor(id, data);
                this.toast.success('Cập nhật monitor thành công!');
                this.modal.close();
                await this.loadMonitors();
                await this.loadStats();
            } catch (error) {
                this.toast.error(error.message || 'Cập nhật thất bại');
            }
        });
    }

    async deleteMonitor(id) {
        if (!confirm('Bạn có chắc muốn xóa monitor này?')) return;

        try {
            await this.api.deleteMonitor(id);
            this.toast.success('Xóa monitor thành công!');
            await this.loadMonitors();
            await this.loadStats();
        } catch (error) {
            this.toast.error('Xóa monitor thất bại');
        }
    }

    // ===== CHAT =====
    async loadChat() {
        try {
            const [messages, online] = await Promise.all([
                this.api.getChatMessages(),
                this.api.getOnlineUsers(),
            ]);

            state.data.chat = messages;
            DOM.chatCount.textContent = messages.length;
            DOM.onlineCount.textContent = online.count || 0;
            this.renderChatMessages(messages);
        } catch (error) {
            console.error('Load chat error:', error);
        }
    }

    renderChatMessages(messages) {
        if (!messages || messages.length === 0) {
            DOM.chatMessages.innerHTML = `
                <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
                    <i class="fas fa-comment-dots fa-3x" style="margin-bottom:12px;opacity:0.5;"></i>
                    <p>Chưa có tin nhắn nào</p>
                </div>
            `;
            return;
        }

        const isOwn = (msg) => msg.userId === state.user?.id;
        
        const html = messages.map(msg => {
            const own = isOwn(msg);
            return `
                <div class="chat-message ${own ? 'self' : 'other'}">
                    <div class="msg-user">${Utils.escapeHTML(msg.username || 'Anonymous')}</div>
                    <div class="msg-content">${Utils.escapeHTML(msg.content)}</div>
                    <div class="msg-time">${Utils.formatDate(msg.createdAt || Date.now())}</div>
                </div>
            `;
        }).join('');

        DOM.chatMessages.innerHTML = html;
        DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
    }

    async sendChatMessage() {
        const content = DOM.chatInput.value.trim();
        if (!content) {
            this.toast.warning('Vui lòng nhập tin nhắn');
            return;
        }

        DOM.chatSendBtn.disabled = true;

        try {
            await this.api.sendChatMessage(content);
            DOM.chatInput.value = '';
            await this.loadChat();
        } catch (error) {
            this.toast.error('Gửi tin nhắn thất bại');
        } finally {
            DOM.chatSendBtn.disabled = false;
        }
    }

    // ===== SYSTEM FUNCTIONS =====
    async handleDownloadDb() {
        try {
            await this.api.downloadDb();
            this.toast.success('Tải database thành công!');
        } catch (error) {
            this.toast.error('Tải database thất bại');
        }
    }

    async handleBackup() {
        try {
            const result = await this.api.backup();
            this.toast.success(result.message || 'Backup thành công!');
        } catch (error) {
            this.toast.error('Backup thất bại');
        }
    }

    // ===== AUTO REFRESH =====
    setupAutoRefresh() {
        this.refreshTimer = setInterval(() => {
            this.loadStats();
            if (state.currentTab !== 'chat') {
                this.loadTabData(state.currentTab);
            }
        }, CONFIG.REFRESH_INTERVAL);
    }

    setupChatRefresh() {
        if (this.chatTimer) {
            clearInterval(this.chatTimer);
            this.chatTimer = null;
        }
        this.chatTimer = setInterval(() => {
            if (state.currentTab === 'chat') {
                this.loadChat();
            }
        }, CONFIG.CHAT_REFRESH_INTERVAL);
    }

    // ===== CLEANUP =====
    destroy() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        if (this.chatTimer) {
            clearInterval(this.chatTimer);
            this.chatTimer = null;
        }
    }
}

// ===== INITIALIZE =====
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new JobQueueApp();
});

// Make app globally accessible for inline onclick handlers
window.app = app;
