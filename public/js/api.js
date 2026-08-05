// ==============================
// JOB QUEUE SYSTEM - COMPLETE FIXED
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
    isInitialized: false,
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
        if (!date) return 'N/A';
        try {
            return new Date(date).toLocaleString('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return 'N/A';
        }
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
    },

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    isValidUsername(username) {
        return username && username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
    },

    isValidPassword(password) {
        return password && password.length >= 6;
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
            
            // Nếu là lỗi 401 (Unauthorized) => chưa đăng nhập
            if (response.status === 401) {
                state.user = null;
                if (window.app) {
                    window.app.updateUserUI();
                    window.app.clearData();
                }
                throw new Error('Vui lòng đăng nhập để tiếp tục');
            }
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            
            this.retryCount = 0;
            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            if (this.retryCount < CONFIG.MAX_RETRIES && error.message !== 'Vui lòng đăng nhập để tiếp tục') {
                this.retryCount++;
                await Utils.sleep(CONFIG.RETRY_DELAY * this.retryCount);
                return this.request(endpoint, options);
            }
            this.retryCount = 0;
            throw error;
        }
    }

    // ===== AUTH ENDPOINTS =====
    async login(credentials) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: credentials,
        });
    }

    async register(data) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: data,
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

    // ===== API ENDPOINTS =====
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

    // ===== BOT ENDPOINTS =====
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

    // ===== MONITOR ENDPOINTS =====
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

    // ===== CHAT ENDPOINTS =====
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

    // ===== STATS =====
    async getStats() {
        return this.request('/api/stats');
    }

    // ===== SYSTEM =====
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
        
        // Khởi tạo
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkSession();
        this.loadData();
        this.setupAutoRefresh();
        state.isInitialized = true;
    }

    // ===== SESSION CHECK =====
    async checkSession() {
        try {
            const user = await this.api.getCurrentUser();
            if (user && user.id) {
                state.user = user;
            } else {
                state.user = null;
            }
        } catch (error) {
            state.user = null;
            console.log('Chưa đăng nhập hoặc session hết hạn');
        }
        this.updateUserUI();
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
        if (state.user && state.user.id) {
            await this.logout();
        } else {
            this.showAuthOptions();
        }
    }

    showAuthOptions() {
        const html = `
            <div style="text-align:center;padding:10px 0;">
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <button id="showLoginBtn" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;">
                        <i class="fas fa-sign-in-alt"></i> Đăng nhập
                    </button>
                    <button id="showRegisterBtn" class="btn btn-success" style="width:100%;justify-content:center;padding:12px;">
                        <i class="fas fa-user-plus"></i> Đăng ký tài khoản mới
                    </button>
                    <button id="closeAuthModal" class="btn" style="width:100%;justify-content:center;background:transparent;color:var(--text-muted);">
                        <i class="fas fa-times"></i> Hủy
                    </button>
                </div>
            </div>
        `;

        this.modal.open('Chào mừng bạn', html);

        document.getElementById('showLoginBtn').addEventListener('click', () => {
            this.modal.close();
            setTimeout(() => this.showLoginForm(), 300);
        });

        document.getElementById('showRegisterBtn').addEventListener('click', () => {
            this.modal.close();
            setTimeout(() => this.showRegisterForm(), 300);
        });

        document.getElementById('closeAuthModal').addEventListener('click', () => {
            this.modal.close();
        });
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
                <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;">
                    <i class="fas fa-sign-in-alt"></i> Đăng nhập
                </button>
                <div style="text-align:center;margin-top:12px;font-size:0.85rem;color:var(--text-muted);">
                    Chưa có tài khoản? 
                    <a href="#" id="switchToRegister" style="color:var(--primary);text-decoration:none;font-weight:600;">Đăng ký ngay</a>
                </div>
            </form>
        `;

        this.modal.open('Đăng nhập', html);

        document.getElementById('switchToRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.modal.close();
            setTimeout(() => this.showRegisterForm(), 300);
        });

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;

            if (!username || !password) {
                this.toast.warning('Vui lòng nhập đầy đủ thông tin');
                return;
            }

            try {
                const result = await this.api.login({ username, password });
                state.user = result.user || result;
                this.toast.success('Đăng nhập thành công!');
                this.modal.close();
                this.updateUserUI();
                await this.loadData();
            } catch (error) {
                this.toast.error(error.message || 'Đăng nhập thất bại');
            }
        });
    }

    showRegisterForm() {
        const html = `
            <form id="registerForm" class="modal-form">
                <div class="form-group">
                    <label for="registerUsername">Tên đăng nhập</label>
                    <input type="text" id="registerUsername" placeholder="Chọn tên đăng nhập" required autofocus>
                    <small>Tối thiểu 3 ký tự, chỉ chữ và số</small>
                </div>
                <div class="form-group">
                    <label for="registerEmail">Email</label>
                    <input type="email" id="registerEmail" placeholder="Email của bạn" required>
                </div>
                <div class="form-group">
                    <label for="registerPassword">Mật khẩu</label>
                    <input type="password" id="registerPassword" placeholder="Tạo mật khẩu" required>
                    <small>Tối thiểu 6 ký tự</small>
                </div>
                <div class="form-group">
                    <label for="registerConfirmPassword">Xác nhận mật khẩu</label>
                    <input type="password" id="registerConfirmPassword" placeholder="Nhập lại mật khẩu" required>
                </div>
                <div class="form-group checkbox-group">
                    <input type="checkbox" id="registerTerms" required>
                    <label for="registerTerms">Tôi đồng ý với <a href="#" style="color:var(--primary);text-decoration:none;">Điều khoản sử dụng</a></label>
                </div>
                <button type="submit" class="btn btn-success" style="width:100%;justify-content:center;padding:12px;">
                    <i class="fas fa-user-plus"></i> Đăng ký
                </button>
                <div style="text-align:center;margin-top:12px;font-size:0.85rem;color:var(--text-muted);">
                    Đã có tài khoản? 
                    <a href="#" id="switchToLogin" style="color:var(--primary);text-decoration:none;font-weight:600;">Đăng nhập</a>
                </div>
            </form>
        `;

        this.modal.open('Đăng ký tài khoản', html);

        document.getElementById('switchToLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.modal.close();
            setTimeout(() => this.showLoginForm(), 300);
        });

        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('registerUsername').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('registerConfirmPassword').value;
            const terms = document.getElementById('registerTerms').checked;

            // Validation
            if (!Utils.isValidUsername(username)) {
                this.toast.warning('Tên đăng nhập phải có ít nhất 3 ký tự và chỉ chữ, số, gạch dưới');
                return;
            }

            if (!Utils.isValidEmail(email)) {
                this.toast.warning('Vui lòng nhập email hợp lệ');
                return;
            }

            if (!Utils.isValidPassword(password)) {
                this.toast.warning('Mật khẩu phải có ít nhất 6 ký tự');
                return;
            }

            if (password !== confirmPassword) {
                this.toast.warning('Mật khẩu xác nhận không khớp');
                return;
            }

            if (!terms) {
                this.toast.warning('Vui lòng đồng ý với Điều khoản sử dụng');
                return;
            }

            try {
                await this.api.register({ username, email, password });
                this.toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
                this.modal.close();
                setTimeout(() => this.showLoginForm(), 1000);
            } catch (error) {
                this.toast.error(error.message || 'Đăng ký thất bại');
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
            this.clearData();
            await this.loadData();
        } catch (error) {
            this.toast.error('Đăng xuất thất bại');
        }
    }

    clearData() {
        // Reset state data
        state.data.apis = [];
        state.data.bots = [];
        state.data.monitors = [];
        state.data.chat = [];
        
        // Clear UI
        this.renderApis([]);
        this.renderBots([]);
        this.renderMonitors([]);
        this.renderChatMessages([]);
        
        // Reset counts
        DOM.apiCount.textContent = '0';
        DOM.botCount.textContent = '0';
        DOM.monitorCount.textContent = '0';
        DOM.chatCount.textContent = '0';
        DOM.onlineCount.textContent = '0';
        
        // Reset stats
        DOM.totalApis.textContent = '0';
        DOM.totalJobs.textContent = '0';
        DOM.totalUsers.textContent = '0';
        DOM.runningBots.textContent = '0';
        DOM.trendEnabledApis.textContent = '0';
        DOM.trendAvgJobs.textContent = '0';
        DOM.trendSessions.textContent = '0';
        DOM.trendStoppedBots.textContent = '0';
        DOM.statEnabledApis.innerHTML = '0<span class="detail-row-sub">/ 0</span>';
        DOM.statPrivateApis.textContent = '0';
        DOM.statRunningBots.innerHTML = '0<span class="detail-row-sub">/ 0</span>';
        DOM.statOnlineMonitors.innerHTML = '0<span class="detail-row-sub">/ 0</span>';
        DOM.statActiveSessions.textContent = '0';
        DOM.statAvgJobs.textContent = '0';
        DOM.statUsersByRole.innerHTML = '<div class="detail-empty">Chưa có dữ liệu</div>';
        DOM.statTopApis.innerHTML = '<div class="detail-empty">Chưa có dữ liệu</div>';
    }

    updateUserUI() {
        // Kiểm tra state.user có tồn tại và có id không
        if (state.user && state.user.id) {
            // Đã đăng nhập
            DOM.userName.textContent = state.user.username || state.user.name || 'User';
            DOM.userRole.textContent = state.user.role || 'user';
            DOM.authBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Đăng xuất</span>';
            DOM.userAvatar.src = state.user.avatar || '/assets/images/default-avatar.png';
            DOM.userAvatar.alt = `Avatar của ${state.user.username || 'User'}`;
            
            // Hiển thị các nút chỉ dành cho user đã đăng nhập
            DOM.downloadDbBtn.style.display = 'inline-flex';
            DOM.backupBtn.style.display = 'inline-flex';
            
            // Enable các nút tạo
            DOM.createApiBtn.disabled = false;
            DOM.createBotBtn.disabled = false;
            DOM.createMonitorBtn.disabled = false;
        } else {
            // Chưa đăng nhập
            DOM.userName.textContent = 'Guest';
            DOM.userRole.textContent = 'visitor';
            DOM.authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Đăng nhập</span>';
            DOM.userAvatar.src = '/assets/images/default-avatar.png';
            DOM.userAvatar.alt = 'Default avatar';
            
            // Ẩn các nút chỉ dành cho user đã đăng nhập
            DOM.downloadDbBtn.style.display = 'none';
            DOM.backupBtn.style.display = 'none';
            
            // Disable các nút tạo
            DOM.createApiBtn.disabled = true;
            DOM.createBotBtn.disabled = true;
            DOM.createMonitorBtn.disabled = true;
        }
    }

    // ===== TAB MANAGEMENT =====
    switchTab(tabId) {
        if (state.currentTab === tabId) return;
        
        state.currentTab = tabId;

        document.querySelectorAll('.tab-btn').forEach(btn => {
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });

        this.loadTabData(tabId);

        if (tabId === 'chat') {
            this.setupChatRefresh();
        } else if (this.chatTimer) {
            clearInterval(this.chatTimer);
            this.chatTimer = null;
        }
    }

    async loadTabData(tabId) {
        // Nếu chưa đăng nhập thì không load dữ liệu
        if (!state.user || !state.user.id) {
            this.clearData();
            return;
        }
        
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
        // Nếu chưa đăng nhập thì không load dữ liệu
        if (!state.user || !state.user.id) {
            this.clearData();
            return;
        }
        
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
            // Nếu lỗi 401 thì đã được xử lý trong API client
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
            if (error.message !== 'Vui lòng đăng nhập để tiếp tục') {
                DOM.apiList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Không thể tải danh sách API</p></div>';
            }
        }
    }

    renderApis(apis) {
        if (!apis || apis.length === 0) {
            DOM.apiList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-code fa-3x"></i>
                    <p>Chưa có API nào</p>
                    ${state.user && state.user.id ? 
                        `<button class="btn btn-success" onclick="app.showCreateApiForm()">
                            <i class="fas fa-plus"></i> Tạo API đầu tiên
                        </button>` : 
                        `<p style="font-size:0.85rem;color:var(--text-muted);">Vui lòng đăng nhập để tạo API</p>`
                    }
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
                    <span class="stat-item"><i class="fas fa-calendar"></i> ${Utils.formatDate(api.createdAt)}</span>
                </div>
                ${state.user && state.user.id ? `
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
                ` : ''}
            </div>
        `).join('');

        DOM.apiList.innerHTML = html;
    }

    showCreateApiForm() {
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để tạo API');
            this.showAuthOptions();
            return;
        }

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
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để thực hiện');
            this.showAuthOptions();
            return;
        }

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
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để thực hiện');
            this.showAuthOptions();
            return;
        }

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
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để thực hiện');
            this.showAuthOptions();
            return;
        }

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
            if (error.message !== 'Vui lòng đăng nhập để tiếp tục') {
                DOM.botList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Không thể tải danh sách bot</p></div>';
            }
        }
    }

    renderBots(bots) {
        if (!bots || bots.length === 0) {
            DOM.botList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-robot fa-3x"></i>
                    <p>Chưa có bot nào</p>
                    ${state.user && state.user.id ? 
                        `<button class="btn btn-success" onclick="app.showCreateBotForm()">
                            <i class="fas fa-plus"></i> Tạo bot đầu tiên
                        </button>` : 
                        `<p style="font-size:0.85rem;color:var(--text-muted);">Vui lòng đăng nhập để tạo bot</p>`
                    }
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
                        <span class="stat-item"><i class="fas fa-calendar"></i> ${Utils.formatDate(bot.createdAt)}</span>
                    </div>
                    ${state.user && state.user.id ? `
                    <div class="card-actions">
                        ${isRunning 
                            ? `<button onclick="app.stopBot(${bot.id})" class="btn btn-sm btn-danger"><i class="fas fa-stop"></i></button>`
                            : `<button onclick="app.startBot(${bot.id})" class="btn btn-sm btn-success"><i class="fas fa-play"></i></button>`
                        }
                        <button onclick="app.editBot(${bot.id})" class="btn btn-sm btn-primary"><i class="fas fa-edit"></i></button>
                        <button onclick="app.deleteBot(${bot.id})" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        DOM.botList.innerHTML = html;
    }

    showCreateBotForm() {
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để tạo bot');
            this.showAuthOptions();
            return;
        }

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
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để thực hiện');
            this.showAuthOptions();
            return;
        }

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
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để thực hiện');
            this.showAuthOptions();
            return;
        }

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
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để thực hiện');
            this.showAuthOptions();
            return;
        }

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
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để thực hiện');
            this.showAuthOptions();
            return;
        }

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
            if (error.message !== 'Vui lòng đăng nhập để tiếp tục') {
                DOM.monitorList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Không thể tải danh sách monitor</p></div>';
            }
        }
    }

    renderMonitors(monitors) {
        if (!monitors || monitors.length === 0) {
            DOM.monitorList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-heartbeat fa-3x"></i>
                    <p>Chưa có monitor nào</p>
                    ${state.user && state.user.id ? 
                        `<button class="btn btn-success" onclick="app.showCreateMonitorForm()">
                            <i class="fas fa-plus"></i> Tạo monitor đầu tiên
                        </button>` : 
                        `<p style="font-size:0.85rem;color:var(--text-muted);">Vui lòng đăng nhập để tạo monitor</p>`
                    }
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
                        <span class="stat-item"><i class="fas fa-calendar"></i> ${Utils.formatDate(monitor.createdAt)}</span>
                    </div>
                    ${state.user && state.user.id ? `
                    <div class="card-actions">
                        <button onclick="app.editMonitor(${monitor.id})" class="btn btn-sm btn-primary"><i class="fas fa-edit"></i></button>
                        <button onclick="app.deleteMonitor(${monitor.id})" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        DOM.monitorList.innerHTML = html;
    }

    showCreateMonitorForm() {
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để tạo monitor');
            this.showAuthOptions();
            return;
        }

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
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để thực hiện');
            this.showAuthOptions();
            return;
        }

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
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để thực hiện');
            this.showAuthOptions();
            return;
        }

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
        if (!state.user || !state.user.id) {
            DOM.chatMessages.innerHTML = `
                <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
                    <i class="fas fa-comment-dots fa-3x" style="margin-bottom:12px;opacity:0.5;"></i>
                    <p>Vui lòng đăng nhập để tham gia chat</p>
                    <button class="btn btn-primary" onclick="app.showAuthOptions()" style="margin-top:12px;">
                        <i class="fas fa-sign-in-alt"></i> Đăng nhập
                    </button>
                </div>
            `;
            return;
        }

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

        const html = messages.map(msg => {
            const isOwn = msg.userId === state.user?.id;
            return `
                <div class="chat-message ${isOwn ? 'self' : 'other'}">
                    <div class="msg-user">${Utils.escapeHTML(msg.username || 'Anonymous')}</div>
                    <div class="msg-content">${Utils.escapeHTML(msg.content)}</div>
                    <div class="msg-time">${Utils.formatDate(msg.createdAt)}</div>
                </div>
            `;
        }).join('');

        DOM.chatMessages.innerHTML = html;
        DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
    }

    async sendChatMessage() {
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để gửi tin nhắn');
            this.showAuthOptions();
            return;
        }

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
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để thực hiện');
            this.showAuthOptions();
            return;
        }

        try {
            await this.api.downloadDb();
            this.toast.success('Tải database thành công!');
        } catch (error) {
            this.toast.error('Tải database thất bại');
        }
    }

    async handleBackup() {
        if (!state.user || !state.user.id) {
            this.toast.warning('Vui lòng đăng nhập để thực hiện');
            this.showAuthOptions();
            return;
        }

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
            if (state.user && state.user.id) {
                this.loadStats();
                if (state.currentTab !== 'chat') {
                    this.loadTabData(state.currentTab);
                }
            }
        }, CONFIG.REFRESH_INTERVAL);
    }

    setupChatRefresh() {
        if (this.chatTimer) {
            clearInterval(this.chatTimer);
            this.chatTimer = null;
        }
        this.chatTimer = setInterval(() => {
            if (state.currentTab === 'chat' && state.user && state.user.id) {
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
