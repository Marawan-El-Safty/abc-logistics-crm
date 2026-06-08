import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000, // 20s — covers Railway cold starts
});

// Retry GET requests on network errors or 5xx — up to 2 times with backoff
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
api.interceptors.response.use(null, async (error) => {
  const cfg = error.config;
  if (!cfg) return Promise.reject(error);
  cfg._retryCount = cfg._retryCount || 0;
  const isTransient = !error.response || error.response.status >= 500;
  if (cfg._retryCount < 2 && isTransient && cfg.method === 'get') {
    cfg._retryCount += 1;
    await sleep(cfg._retryCount * 1000);
    return api(cfg);
  }
  return Promise.reject(error);
});

// Offline queue
const OFFLINE_QUEUE_KEY = 'crm_offline_queue';

const getQueue = () => JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
const saveQueue = (q) => localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));

export const queueOfflineRequest = (config) => {
  const q = getQueue();
  q.push({ ...config, timestamp: Date.now() });
  saveQueue(q);
};

export const syncOfflineQueue = async () => {
  const q = getQueue();
  if (!q.length) return;
  const remaining = [];
  for (const req of q) {
    try {
      await api.request(req);
    } catch {
      remaining.push(req);
    }
  }
  saveQueue(remaining);
};

// Intercept requests — attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Intercept responses — handle 401 with refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!navigator.onLine) {
      queueOfflineRequest(originalRequest);
      return Promise.reject(new Error('You are offline. Request queued.'));
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = res.data;
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', newRefresh);
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
