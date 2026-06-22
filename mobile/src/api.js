// Change this to your server IP when testing on a physical device
// e.g. const BASE_URL = 'http://192.168.1.5:5000/api';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your server IP when testing on a physical device
// e.g. const BASE_URL = 'http://192.168.1.5:5000/api';
const BASE_URL = 'https://spilt-reclining-negation.ngrok-free.dev/api';
const SERVER_ROOT = BASE_URL.replace(/\/api\/?$/, ''); // e.g. http://localhost:5000

const USER_TOKEN_KEY = 'ncc_user_token';

const API = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// Attach the logged-in user's token to any request that needs it.
// Admin actions are not exposed in the mobile app (admin stays web-only),
// so the mobile app only ever needs the user token.
API.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(USER_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      if (url.startsWith('/users') || url.startsWith('/playlists')) {
        await AsyncStorage.removeItem(USER_TOKEN_KEY);
      }
    }
    return Promise.reject(err);
  }
);

/* ── Songs ─────────────────────────────────────────────────────── */
export const fetchSongs          = (params) => API.get('/songs', { params }).then(r => r.data);
export const fetchSong           = (id)     => API.get(`/songs/${id}`).then(r => r.data);
export const fetchRecommended    = ()       => API.get('/songs/recommendations').then(r => r.data);
export const fetchRecentlyPlayed = ()       => API.get('/songs/me/recent').then(r => r.data);

/* ── User auth ─────────────────────────────────────────────────── */
export const userRegister       = (data)  => API.post('/users/register', data).then(r => r.data);
export const userLogin          = (data)  => API.post('/users/login', data).then(r => r.data);
export const userForgotPassword = (email) => API.post('/users/forgot-password', { email }).then(r => r.data);
export const userResetPassword  = (data)  => API.post('/users/reset-password', data).then(r => r.data);
export const getUserMe          = ()      => API.get('/users/me').then(r => r.data);
export const updateUserProfile  = (data)  => API.put('/users/me', data).then(r => r.data);
export const toggleFavourite    = (songId)=> API.post(`/users/favourites/${songId}`).then(r => r.data);
export const fetchFavourites    = ()      => API.get('/users/favourites').then(r => r.data);

export { USER_TOKEN_KEY };

/* ── Playlists (folders) ──────────────────────────────────────────── */
export const fetchPlaylists         = ()             => API.get('/playlists').then(r => r.data);
export const fetchPlaylist          = (id)            => API.get(`/playlists/${id}`).then(r => r.data);
export const createPlaylist         = (data)          => API.post('/playlists', data).then(r => r.data);
export const updatePlaylist         = (id, data)      => API.put(`/playlists/${id}`, data).then(r => r.data);
export const deletePlaylist         = (id)            => API.delete(`/playlists/${id}`).then(r => r.data);
export const addSongToPlaylist      = (id, songId)    => API.post(`/playlists/${id}/songs`, { songId }).then(r => r.data);
export const removeSongFromPlaylist = (id, songId)    => API.delete(`/playlists/${id}/songs/${songId}`).then(r => r.data);

/* Note: mobile PDF export does NOT use a server download URL — it
   generates the PDF on-device from the populated playlist data via
   expo-print + expo-sharing (see PlaylistDetailScreen.js). This avoids
   needing a separate authenticated file-download flow on mobile. */

/* Resolves a stored audioUrl — could be a full external link, or a relative
   /uploads/... path returned from the admin's "Upload MP3" option. */
export const resolveAudioUrl = (audioUrl) => {
  if (!audioUrl) return '';
  if (/^https?:\/\//i.test(audioUrl)) return audioUrl;
  return `${SERVER_ROOT}${audioUrl}`;
};

// Used by ShareButton to build a deep link that opens this song directly
// when tapped from WhatsApp etc. Mirrors the web app's ?song= handling —
// opening it in a browser lands on the web song view; opening it inside
// the app (if a deep-link scheme is configured) could route natively too.
export const getSongShareUrl = (songId) => {
  // Update WEB_BASE_URL to your deployed website once you have one —
  // this is what recipients actually open when they tap the shared link.
  const WEB_BASE_URL = 'https://nccsongs.church';
  return `${WEB_BASE_URL}/?song=${songId}`;
};

export default API;