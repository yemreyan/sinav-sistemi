// auth.js — Admin oturumunun tek kaynağı: sunucudan alınan imzalı token
const TOKEN_KEY = 'adminToken';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    // Eski sürümden kalan bayrak — artık yetki vermiyor, temizliyoruz
    localStorage.removeItem('adminLoggedIn');
};

export const isLoggedIn = () => Boolean(getToken());
