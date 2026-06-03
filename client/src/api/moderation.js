import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Moderation queue ──────────────────────────────────────────────────────────
export const getModerationQueue = (params) =>
  api.get('/faculty/moderation/queue', { params }).then(r => r.data);

export const getModerationStats = () =>
  api.get('/faculty/moderation/stats').then(r => r.data);

// ── Flag detail ───────────────────────────────────────────────────────────────
export const getFlag = (id) =>
  api.get(`/faculty/moderation/${id}`).then(r => r.data);

// ── Flag resolution ───────────────────────────────────────────────────────────
export const resolveFlag = (id, data) =>
  api.post(`/faculty/moderation/${id}/resolve`, data).then(r => r.data);

export const bulkDismiss = (flagIds, notes) =>
  api.post('/faculty/moderation/bulk-dismiss', { flag_ids: flagIds, notes }).then(r => r.data);

// ── Distinct flagged content (grouped by target) ──────────────────────────────
export const getFlaggedContent = (params) =>
  api.get('/faculty/moderation/flagged-content', { params }).then(r => r.data);