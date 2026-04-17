/**
 * API Client
 * Axios instance with interceptors for auth and error handling.
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Token expired - try refresh
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });

        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ─── API Methods ──────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken })
};

export const devicesAPI = {
  getAll: (params) => api.get('/devices', { params }),
  getOne: (id) => api.get(`/devices/${id}`),
  create: (data) => api.post('/devices', data),
  update: (id, data) => api.put(`/devices/${id}`, data),
  delete: (id) => api.delete(`/devices/${id}`),
  getStats: (id) => api.get(`/devices/${id}/stats`)
};

export const sessionsAPI = {
  getAll: (params) => api.get('/sessions', { params }),
  create: (data) => api.post('/sessions', data),
  end: (id, data) => api.put(`/sessions/${id}/end`, data),
  getActive: () => api.get('/sessions/active')
};

export const scriptsAPI = {
  getAll: (params) => api.get('/scripts', { params }),
  create: (data) => api.post('/scripts', data),
  update: (id, data) => api.put(`/scripts/${id}`, data),
  delete: (id) => api.delete(`/scripts/${id}`),
  execute: (id, data) => api.post(`/scripts/${id}/execute`, data)
};

export const aiAPI = {
  diagnose: (data) => api.post('/ai/diagnose', data),
  chat: (data) => api.post('/ai/chat', data),
  analyzeLogs: (data) => api.post('/ai/analyze-logs', data),
  suggestFix: (data) => api.post('/ai/suggest-fix', data),
  feedback: (data) => api.post('/ai/feedback', data),
  history: (params) => api.get('/ai/history', { params })
};

export const logsAPI = {
  getAll: (params) => api.get('/logs', { params }),
  create: (data) => api.post('/logs', data),
  getStats: () => api.get('/logs/stats')
};

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getActivity: () => api.get('/dashboard/activity'),
  getDeviceHealth: () => api.get('/dashboard/device-health')
};

export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getOne: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, data) => api.put(`/users/${id}/reset-password`, data)
};

export const guacamoleAPI = {
  connect: (data) => api.post('/guacamole/connect', data),
  disconnect: (data) => api.post('/guacamole/disconnect', data),
  status: () => api.get('/guacamole/status')
};
