import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nexusit-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const usersAPI = {
  getAll:         ()           => api.get('/users'),
  create:         (data)       => api.post('/users', data),
  update:         (id, data)   => api.put(`/users/${id}`, data),
  delete:         (id)         => api.delete(`/users/${id}`),
  resetPassword:  (id, data)   => api.post(`/users/${id}/reset-password`, data),
  changePassword: (data)       => api.post('/users/me/change-password', data),
};

export default api;
