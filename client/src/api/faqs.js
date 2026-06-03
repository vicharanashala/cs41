import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ── Public FAQ submission — no auth required ────────────────────────────────
export const submitFAQ = (data) => api.post('/faqs/submit', data).then(r => r.data);