import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Core review ──────────────────────────────────────────────────────────────
export const getDashboard       = () => api.get('/faculty/dashboard').then(r => r.data);
export const getQueue           = (params) => api.get('/faculty/queue', { params }).then(r => r.data);
export const getQueueStats      = () => api.get('/faculty/queue/stats').then(r => r.data);
export const getQuestion        = (id) => api.get(`/faculty/questions/${id}`).then(r => r.data);
export const getQuestionAnswers = (id) => api.get(`/faculty/questions/${id}/answers`).then(r => r.data);
export const getQuestionHistory = (id) => api.get(`/faculty/questions/${id}/history`).then(r => r.data);
export const postReview         = (id, data) => api.post(`/faculty/questions/${id}/review`, data).then(r => r.data);

// ── AI Analysis ──────────────────────────────────────────────────────────────
export const runAnalysis = (id) => api.post(`/faculty/questions/${id}/analyze`).then(r => r.data);

// ── Tags ─────────────────────────────────────────────────────────────────────
export const getTags       = () => api.get('/faculty/tags').then(r => r.data);
export const createTag     = (data) => api.post('/faculty/tags', data).then(r => r.data);
export const deleteTag     = (tagId) => api.delete(`/faculty/tags/${tagId}`).then(r => r.data);
export const applyTags     = (questionId, tag_ids) => api.post(`/faculty/tags/apply/${questionId}`, { tag_ids }).then(r => r.data);
export const removeTag     = (questionId, tagId) => api.delete(`/faculty/tags/remove/${questionId}/${tagId}`).then(r => r.data);

// ── Bulk Operations ───────────────────────────────────────────────────────────
export const bulkAction = (data) => api.post('/faculty/bulk-action', data).then(r => r.data);

// ── Analytics ──────────────────────────────────────────────────────────────────
export const getAnalyticsKPI       = () => api.get('/faculty/analytics/kpi').then(r => r.data);
export const getAnalyticsFaqDaily = (days) => api.get('/faculty/analytics/faq/daily', { params: { days } }).then(r => r.data);
export const getAnalyticsFaqMonthly = (months) => api.get('/faculty/analytics/faq/monthly', { params: { months } }).then(r => r.data);
export const getAnalyticsFaqStatus = () => api.get('/faculty/analytics/faq/status-breakdown').then(r => r.data);
export const getAnalyticsThroughput = (weeks) => api.get('/faculty/analytics/throughput/weekly', { params: { weeks } }).then(r => r.data);
export const getAnalyticsAvgTime   = () => api.get('/faculty/analytics/throughput/avg-time').then(r => r.data);
export const getAnalyticsModDaily  = (days) => api.get('/faculty/analytics/moderation/daily', { params: { days } }).then(r => r.data);
export const getAnalyticsModSummary = () => api.get('/faculty/analytics/moderation/summary').then(r => r.data);
export const getAnalyticsSPDist    = () => api.get('/faculty/analytics/sp/distribution').then(r => r.data);
export const getAnalyticsSPLeaders = (limit) => api.get('/faculty/analytics/sp/leaderboard', { params: { limit } }).then(r => r.data);
export const refreshAnalytics     = () => api.post('/faculty/analytics/refresh').then(r => r.data);

// ── Settings ───────────────────────────────────────────────────────────────────
export const getSettings        = () => api.get('/faculty/settings').then(r => r.data);
export const updateSettings     = (patches) => api.patch('/faculty/settings', patches).then(r => r.data);
export const resetSettings      = () => api.post('/faculty/settings/reset').then(r => r.data);
export const getFacultyList     = () => api.get('/faculty/settings/faculty').then(r => r.data);
export const updateFacultyRole  = (id, role) => api.patch(`/faculty/settings/faculty/${id}/role`, { role }).then(r => r.data);

// ── Audit Log ─────────────────────────────────────────────────────────────────
export const getAuditLog = (params) => api.get('/faculty/audit', { params }).then(r => r.data);