// ── API SERVICE ────────────────────────────────────────────
// Remplace progressivement localStorage par des appels API.
// Injecte automatiquement le token JWT dans chaque requête.

const API_BASE = 'http://localhost:3001/api';

const Api = {
  _token: null,

  async init() {
    this._token = sessionStorage.getItem('ftr_api_token');
    return !!this._token;
  },

  setToken(token) {
    this._token = token;
    if (token) sessionStorage.setItem('ftr_api_token', token);
    else sessionStorage.removeItem('ftr_api_token');
  },

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this._token) headers['Authorization'] = `Bearer ${this._token}`;

    const opts = { method, headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(err.error || `Erreur ${res.status}`);
    }
    return res.json();
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  patch(path, body) { return this.request('PATCH', path, body); },
  del(path) { return this.request('DELETE', path); },

  // ── AUTH ──
  async login(username, password, establishmentSlug = null) {
    const data = await this.post('/auth/login', { username, password, establishmentSlug });
    this.setToken(data.token);
    return data;
  },

  async me() { return this.get('/auth/me'); },
  logout() { this.setToken(null); },

  // ── ESTABLISHMENTS ──
  async getEstablishment(slug) { return this.get(`/establishments/slug/${slug}`); },
  async register(data) { return this.post('/establishments/register', data); },
  async markOnboarded() { return this.patch('/establishments/onboarded', {}); },
  async checkOnboarding() { return this.get('/establishments/check-onboarding'); },

  // ── RESIDENTS ──
  async getResidents(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/residents${q ? '?' + q : ''}`);
  },
  async getResident(id) { return this.get(`/residents/${id}`); },
  async createResident(data) { return this.post('/residents', data); },
  async updateResident(id, data) { return this.put(`/residents/${id}`, data); },
  async deleteResident(id) { return this.del(`/residents/${id}`); },
  async getDocuments(residentId) { return this.get(`/residents/${residentId}/documents`); },
  async deleteDocument(residentId, docId) { return this.del(`/residents/${residentId}/documents/${docId}`); },

  // ── JOURNAL ──
  async getJournal(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/journal${q ? '?' + q : ''}`);
  },
  async getEntry(id) { return this.get(`/journal/${id}`); },
  async createEntry(data) { return this.post('/journal', data); },
  async updateEntry(id, data) { return this.put(`/journal/${id}`, data); },
  async deleteEntry(id) { return this.del(`/journal/${id}`); },

  // ── PLANNING ──
  async getPlanning(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/planning${q ? '?' + q : ''}`);
  },
  async getEvent(id) { return this.get(`/planning/${id}`); },
  async createEvent(data) { return this.post('/planning', data); },
  async updateEvent(id, data) { return this.put(`/planning/${id}`, data); },
  async deleteEvent(id) { return this.del(`/planning/${id}`); },

  // ── PRESENCES ──
  async getPresences(date) { return this.get(`/presences?date=${date}`); },
  async getPresenceStats(date) { return this.get(`/presences/stats?date=${date}`); },
  async setPresence(residentId, date, status) { return this.put(`/presences/${residentId}`, { date, status }); },
  async markAllPresent(date) { return this.post('/presences/all-present', { date }); },

  // ── ADMIN ──
  async getStats() { return this.get('/admin/stats'); },
  async getSettings() { return this.get('/admin/settings'); },
  async saveSettings(data) { return this.put('/admin/settings', data); },
  async saveTypeStructure(typeStructure) { return this.put('/admin/settings/type', { typeStructure }); },
  async getBranding() { return this.get('/admin/branding'); },
  async saveBranding(data) { return this.put('/admin/branding', data); },
  async getCategories() { return this.get('/admin/categories'); },
  async createCategory(data) { return this.post('/admin/categories', data); },
  async updateCategory(id, data) { return this.put(`/admin/categories/${id}`, data); },
  async deleteCategory(id) { return this.del(`/admin/categories/${id}`); },
  async getObjectives() { return this.get('/admin/objectives'); },
  async createObjective(data) { return this.post('/admin/objectives', data); },
  async updateObjective(id, data) { return this.put(`/admin/objectives/${id}`, data); },
  async deleteObjective(id) { return this.del(`/admin/objectives/${id}`); },
  async getUsers() { return this.get('/admin/users'); },
  async createUser(data) { return this.post('/admin/users', data); },
  async updateUser(id, data) { return this.put(`/admin/users/${id}`, data); },
  async deleteUser(id) { return this.del(`/admin/users/${id}`); },
  async getAccount() { return this.get('/admin/account'); },
  async updateAccount(data) { return this.put('/admin/account/profile', data); },
  async updateCredentials(data) { return this.put('/admin/account/credentials', data); },
  async getVehicles() { return this.get('/admin/vehicles'); },
  async createVehicle(name) { return this.post('/admin/vehicles', { name }); },
  async deleteVehicle(id) { return this.del(`/admin/vehicles/${id}`); },
  async exportData(type) { return this.get(`/admin/export?type=${type}`); },
  async resetData(target) { return this.post('/admin/reset', { target }); },
};
