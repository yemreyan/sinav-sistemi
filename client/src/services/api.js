import axios from 'axios';
import { getToken, clearToken } from './auth';

const api = axios.create({
    // Lokal geliştirmede client/.env.local içine VITE_API_URL=http://localhost:3001/api yazın
    baseURL: import.meta.env.VITE_API_URL || 'https://sinav-backend.onrender.com/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Token düştüyse (süre doldu / geçersiz) oturumu kapat ve giriş ekranına dön.
// Giriş denemesinin kendisi hariç — oradaki 401 "hatalı şifre" demek, oturum
// düşmesi değil; sayfayı yenilersek hata mesajı da silinir.
const LOGIN_PATH = '/emre/login';

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isLoginRequest = error.config?.url?.includes('/admin/login');
        const onAdminPage = window.location.pathname.startsWith('/emre');

        if (error.response?.status === 401 && !isLoginRequest && onAdminPage && window.location.pathname !== LOGIN_PATH) {
            clearToken();
            window.location.replace(LOGIN_PATH);
        }
        return Promise.reject(error);
    }
);

export const examAPI = {
    getAll: () => api.get('/exams'),
    archiveImpact: (id) => api.get(`/exams/${id}/archive-impact`),
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
    getGroups: () => api.get('/referee-groups'),
    create: (data) => api.post('/referees', data),
    update: (id, data) => api.put(`/referees/${id}`, data),
    delete: (id) => api.delete(`/referees/${id}`)
};

export const questionAPI = {
    getAll: () => api.get('/questions'),
    create: (data) => api.post('/questions', data),
    update: (id, data) => api.put(`/questions/${id}`, data),
    delete: (id) => api.delete(`/questions/${id}`),
    addVideo: (id, data) => api.post(`/questions/${id}/videos`, data),
    updateVideo: (id, vid, data) => api.put(`/questions/${id}/videos/${vid}`, data),
    deleteVideo: (id, vid) => api.delete(`/questions/${id}/videos/${vid}`),
    distribute: (id, data) => api.post(`/questions/${id}/distribute`, data),
    assignments: (id) => api.get(`/questions/${id}/assignments`),
    clearAssignments: (id) => api.delete(`/questions/${id}/assignments`)
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
    getExisting: (email, videoId) => api.get(`/scores/existing?email=${encodeURIComponent(email)}&videoId=${encodeURIComponent(videoId)}`),
    submissionStatus: (podiumId, group) => api.get(
        `/scores/submission-status/${podiumId}${group ? `?group=${encodeURIComponent(group)}` : ''}`
    ),
    getMakeup: (email) => api.get(`/scores/makeup?email=${encodeURIComponent(email)}`),
    grantMakeup: (refereeIds, videoId) => api.post('/scores/makeup', { refereeIds, videoId }),
    revokeMakeup: (refereeIds, videoId) => api.delete('/scores/makeup', { data: { refereeIds, videoId } }),
    makeupByVideo: (videoId) => api.get(`/scores/makeup-list/${videoId}`),
    coverage: (podiumId, group, apparatus, onlyStarted = true) => {
        const q = new URLSearchParams();
        if (group) q.set('group', group);
        if (apparatus) q.set('apparatus', apparatus);
        if (!onlyStarted) q.set('onlyStarted', 'false');
        return api.get(`/scores/coverage/${podiumId}?${q.toString()}`);
    }
};

export default api;
