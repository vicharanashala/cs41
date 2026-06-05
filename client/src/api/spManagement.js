import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const BASE = '/faculty/interns';

const get  = (path, params) => api.get(`${BASE}${path}`, { params }).then(r => r.data);
const post = (path, data)    => api.post(`${BASE}${path}`, data).then(r => r.data);
const del  = (path)          => api.delete(`${BASE}${path}`).then(r => r.data);

// ── Overview & Stats ─────────────────────────────────────────────────────────
export const getInternOverview    = ()                    => get('/overview');
export const getInternStats       = (userId, days)        => get('/stats',  { user_id: userId, days });
export const getInternAnomalies   = (params)              => get('/anomalies', params);

// ── Intern list ───────────────────────────────────────────────────────────────
export const getInterns = (params) => get('', params);

// ── Single intern ────────────────────────────────────────────────────────────
export const getIntern = (id) => get(`/${id}`);

// ── SP ledger & adjustments ──────────────────────────────────────────────────
export const getInternLedger      = (id, params) => get(`/${id}/ledger`,      params);
export const getInternAdjustments = (id, params) => get(`/${id}/adjustments`, params);

// ── Freeze / unfreeze ────────────────────────────────────────────────────────
export const freezeIntern   = (id) => post(`/${id}/freeze`,   {});
export const unfreezeIntern = (id) => post(`/${id}/unfreeze`, {});

// ── SP adjustment ────────────────────────────────────────────────────────────
export const adjustIntern = (id, data) => post(`/${id}/adjust`, data);

// ── Watchlist ────────────────────────────────────────────────────────────────
export const getWatchlist = (params)        => get('/watchlist',  params);
export const addToWatchlist = (data)        => post('/watchlist',  data);
export const removeFromWatchlist = (userId) => del(`/watchlist/${userId}`);

// ── Anomaly resolution ───────────────────────────────────────────────────────
export const resolveAnomaly = (id, data) => post(`/anomalies/${id}/resolve`, data);