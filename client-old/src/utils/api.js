const BASE = 'http://localhost:3001/api';

function getToken() {
  return localStorage.getItem('csfaq_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  register: (data) => request('POST', '/auth/register', data),
  login:    (data) => request('POST', '/auth/login', data),
  me:       () => request('GET', '/auth/me'),

  // Questions
  getQuestions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/questions${q ? '?' + q : ''}`);
  },
  getQuestion:  (id) => request('GET', `/questions/${id}`),
  createQuestion: (data) => request('POST', '/questions', data),
  voteQuestion: (id, direction) => request('POST', `/questions/${id}/vote`, { direction }),

  // Answers
  createAnswer: (questionId, content) => request('POST', `/questions/${questionId}/answers`, { content }),
  voteAnswer:   (id, direction) => request('POST', `/answers/${id}/vote`, { direction }),
  acceptAnswer: (id) => request('POST', `/answers/${id}/accept`),

  // Categories & Stats
  getCategories: () => request('GET', '/categories'),
  getStats:      () => request('GET', '/stats'),
};

export function isAuthenticated() {
  return !!getToken();
}

export function logout() {
  localStorage.removeItem('csfaq_token');
  localStorage.removeItem('csfaq_user');
}