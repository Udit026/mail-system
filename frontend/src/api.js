// Production me frontend aur backend alag domain par ho to .env me VITE_API_URL set karo
// (e.g. https://api.yourcompany.com). Development me khali chhodo, Vite proxy kaam karega.
const BASE = (import.meta.env.VITE_API_URL || '') + '/api';
const TOKEN_KEY = 'mail_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }

  // Session expire ho gaya: App ko batao ki login screen dikhaye
  if (res.status === 401 && token) {
    clearToken();
    window.dispatchEvent(new Event('auth:logout'));
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  sendEmail: (payload) => request('/emails/send', { method: 'POST', body: JSON.stringify(payload) }),
  listEmails: ({ page = 1, limit = 15, status = '', search = '' } = {}) => {
    const qs = new URLSearchParams({ page, limit });
    if (status) qs.set('status', status);
    if (search) qs.set('search', search);
    return request(`/emails?${qs.toString()}`);
  },
  getEmail: (id) => request(`/emails/${id}`),
};
