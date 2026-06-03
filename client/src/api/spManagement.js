import axios from 'axios';

const BASE = '/api/faculty/students';

const get  = (path, params) => axios.get(`${BASE}${path}`, { params }).then(r => r.data);
const post = (path, data)    => axios.post(`${BASE}${path}`, data).then(r => r.data);
const del  = (path)          => axios.delete(`${BASE}${path}`).then(r => r.data);

// ── Overview & Stats ─────────────────────────────────────────────────────────
export const getStudentOverview  = ()                    => get('/overview');
export const getStudentStats     = (userId, days)        => get('/stats',  { user_id: userId, days });
export const getStudentAnomalies = (params)              => get('/anomalies', params);

// ── Student list ─────────────────────────────────────────────────────────────
export const getStudents = (params) => get('', params);

// ── Single student ───────────────────────────────────────────────────────────
export const getStudent = (id) => get(`/${id}`);

// ── SP ledger & adjustments ──────────────────────────────────────────────────
export const getStudentLedger     = (id, params) => get(`/${id}/ledger`,      params);
export const getStudentAdjustments = (id, params) => get(`/${id}/adjustments`, params);

// ── Freeze / unfreeze ────────────────────────────────────────────────────────
export const freezeStudent   = (id) => post(`/${id}/freeze`,   {});
export const unfreezeStudent = (id) => post(`/${id}/unfreeze`, {});

// ── SP adjustment ────────────────────────────────────────────────────────────
export const adjustStudent = (id, data) => post(`/${id}/adjust`, data);

// ── Watchlist ────────────────────────────────────────────────────────────────
export const getWatchlist = (params)        => get('/watchlist',  params);
export const addToWatchlist = (data)        => post('/watchlist',  data);
export const removeFromWatchlist = (userId) => del(`/watchlist/${userId}`);

// ── Anomaly resolution ───────────────────────────────────────────────────────
export const resolveAnomaly = (id, data) => post(`/anomalies/${id}/resolve`, data);