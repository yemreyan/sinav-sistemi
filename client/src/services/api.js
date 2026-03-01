import axios from 'axios';

const api = axios.create({
    baseURL: 'https://sinav-backend.onrender.com/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const examAPI = {
    getAll: () => api.get('/exams'),
    create: (data) => api.post('/exams', data),
    archive: (id) => api.put(`/exams/${id}/archive`),
    restore: (id) => api.put(`/exams/${id}/restore`),
    delete: (id) => api.delete(`/exams/${id}`)
};

export const podiumAPI = {
    getAll: () => api.get('/podiums'),
    create: (data) => api.post('/podiums', data),
    updateState: (id, state) => api.put(`/podiums/${id}/state`, { state }),
    update: (id, data) => api.put(`/podiums/${id}`, data),
    delete: (id) => api.delete(`/podiums/${id}`)
};

export const videoAPI = {
    getAll: () => api.get('/videos'),
    create: (data) => api.post('/videos', data),
    update: (id, data) => api.put(`/videos/${id}`, data),
    archive: (id) => api.put(`/videos/${id}`, { isArchived: true }),
    restore: (id) => api.put(`/videos/${id}`, { isArchived: false }),
    delete: (id) => api.delete(`/videos/${id}`)
};

export const refereeAPI = {
    getAll: () => api.get('/referees'),
    create: (data) => api.post('/referees', data),
    update: (id, data) => api.put(`/referees/${id}`, data),
    delete: (id) => api.delete(`/referees/${id}`)
};

export const authAPI = {
    login: (password) => api.post('/admin/login', { password })
};

export const settingsAPI = {
    get: () => api.get('/settings'),
    updateDiff: (diffPoints) => api.put('/settings/diff', { diffPoints }),
    updateMatrix: (matrixOverrides) => api.put('/settings/matrix', { matrixOverrides })
};

export const resultsAPI = {
    getAll: () => api.get('/results'),
    getStats: () => api.get('/stats')
};

export const scoreAPI = {
    auth: (email) => api.post('/scores/auth', { email }),
    submit: (data) => api.post('/scores/submit', data),
    getPodiumState: (podiumId) => api.get(`/scores/podium-state/${podiumId}`),
    getExisting: (email, videoId) => api.get(`/scores/existing?email=${encodeURIComponent(email)}&videoId=${encodeURIComponent(videoId)}`)
};

export default api;
