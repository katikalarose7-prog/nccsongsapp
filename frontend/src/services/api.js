import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 10000,
});
console.log('API URL:', process.env.REACT_APP_API_URL);
/* Two separate auth tokens are kept — admins and regular users are
   completely different identities with different permissions, so they
   must never share a storage key (that would let an admin session leak
   into user-only endpoints or vice versa). */
const ADMIN_TOKEN_KEY = 'ncc_admin_token';
const USER_TOKEN_KEY  = 'ncc_user_token';

API.interceptors.request.use((config) => {
  const isAdminRoute = config.url.startsWith('/auth') || config.url.startsWith('/upload')
    || (config.url.startsWith('/songs') && ['post','put','delete'].includes(config.method));
  const isUserRoute = config.url.startsWith('/users') || config.url.startsWith('/playlists');

  const token = isAdminRoute
    ? localStorage.getItem(ADMIN_TOKEN_KEY)
    : isUserRoute
      ? localStorage.getItem(USER_TOKEN_KEY)
      : (localStorage.getItem(USER_TOKEN_KEY) || null); // optional-auth GET routes prefer user token if present

  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear the relevant stale token so the UI doesn't keep retrying with a dead session
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      if (url.startsWith('/auth')) localStorage.removeItem(ADMIN_TOKEN_KEY);
      if (url.startsWith('/users') || url.startsWith('/playlists')) localStorage.removeItem(USER_TOKEN_KEY);
    }
    return Promise.reject(err);
  }
);

// Simple in-memory cache for song list requests
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

const cached = async (key, fn) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;
  const data = await fn();
  cache.set(key, { data, ts: Date.now() });
  return data;
};

/* ── Songs ─────────────────────────────────────────────────────── */
export const fetchSongs = (params) => {
  cache.clear(); // temporary — remove after fix confirmed
  const key = JSON.stringify(params);
  return cached(key, () => API.get('/songs', { params }).then(r => r.data));
};



export const fetchSong         = (id)       => API.get(`/songs/${id}`).then(r => r.data);
export const fetchRecommended  = ()         => API.get('/songs/recommendations').then(r => r.data);
export const fetchRecentlyPlayed = ()       => API.get('/songs/me/recent').then(r => r.data);
export const createSong        = (data)     => { cache.clear(); return API.post('/songs', data).then(r => r.data); };
export const updateSong        = (id, data) => { cache.clear(); return API.put(`/songs/${id}`, data).then(r => r.data); };
export const deleteSong        = (id)       => { cache.clear(); return API.delete(`/songs/${id}`).then(r => r.data); };
export const fetchStats        = ()         => API.get('/stats').then(r => r.data);

export const bulkImport = (file) => {
  cache.clear();
  const fd = new FormData();
  fd.append('file', file);
  return API.post('/songs/bulk-import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const downloadTemplate = () =>
  API.get('/songs/export/template', { responseType: 'blob' }).then(r => {
    const url = window.URL.createObjectURL(new Blob([r.data]));
    const a   = document.createElement('a');
    a.href = url; a.download = 'songs_import_template.xlsx'; a.click();
  });

/* ── Admin auth ────────────────────────────────────────────────── */
export const adminLogin    = (data) => API.post('/auth/login', data).then(r => r.data);
export const adminRegister = (data) => API.post('/auth/register', data).then(r => r.data);
export const getAdminMe    = ()     => API.get('/auth/me').then(r => r.data);
export { ADMIN_TOKEN_KEY, USER_TOKEN_KEY };

/* ── Public user auth ─────────────────────────────────────────────
   Note: register/login on /users are intentionally public routes —
   the interceptor above sends no admin token for them. */
export const userRegister      = (data) => API.post('/users/register', data).then(r => r.data);
export const userLogin         = (data) => API.post('/users/login', data).then(r => r.data);
export const userForgotPassword= (email)=> API.post('/users/forgot-password', { email }).then(r => r.data);
export const userResetPassword = (data) => API.post('/users/reset-password', data).then(r => r.data);
export const verifyEmail       = (token)=> API.get('/users/verify-email', { params: { token } }).then(r => r.data);
export const getUserMe         = ()     => API.get('/users/me').then(r => r.data);
export const updateUserProfile = (data) => API.put('/users/me', data).then(r => r.data);
export const toggleFavourite   = (songId)=> API.post(`/users/favourites/${songId}`).then(r => r.data);
export const fetchFavourites   = ()     => API.get('/users/favourites').then(r => r.data);

/* ── Playlists (folders) ──────────────────────────────────────────── */
export const fetchPlaylists      = ()              => API.get('/playlists').then(r => r.data);
export const fetchPlaylist       = (id)             => API.get(`/playlists/${id}`).then(r => r.data);
export const createPlaylist      = (data)           => API.post('/playlists', data).then(r => r.data);
export const updatePlaylist      = (id, data)       => API.put(`/playlists/${id}`, data).then(r => r.data);
export const deletePlaylist      = (id)             => API.delete(`/playlists/${id}`).then(r => r.data);
export const addSongToPlaylist   = (id, songId)     => API.post(`/playlists/${id}/songs`, { songId }).then(r => r.data);
export const removeSongFromPlaylist = (id, songId)  => API.delete(`/playlists/${id}/songs/${songId}`).then(r => r.data);
export const downloadPlaylistPdf = async (id, name) => {
  const token = localStorage.getItem('ncc_user_token');
  const base  = (process.env.REACT_APP_API_URL || '/api').replace(/\/api\/?$/, '');
  const url   = `${base}/api/playlists/${id}/pdf-download`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to download PDF');
  }

  const blob = await res.blob();
  const link = document.createElement('a');
  link.href  = URL.createObjectURL(blob);
  link.download = `${name || 'playlist'}.pdf`;
  link.click();
  URL.revokeObjectURL(link.href);
};

/* ── Audio file upload (admin only) ───────────────────────────────── */
export const uploadAudio = (file, onProgress) => {
  const fd = new FormData();
  fd.append('audio', file);
  return API.post('/upload/audio', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  }).then(r => r.data);
};

export const deleteAudio = (filename) => API.delete(`/upload/audio/${filename}`).then(r => r.data);

/* Resolves a stored audioUrl (which may be a relative /uploads/... path
   from a server upload, or a full external URL) to a playable absolute URL. */
export const resolveAudioUrl = (audioUrl) => {
  if (!audioUrl) return '';
  if (/^https?:\/\//i.test(audioUrl)) return audioUrl;
  const base = (process.env.REACT_APP_API_URL || '/api').replace(/\/api\/?$/, '');
  return `${base}${audioUrl}`;
};

export default API;