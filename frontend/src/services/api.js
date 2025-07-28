// frontend/src/services/api.js
import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';

// Create axios instance with correct base URL and API prefix
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`, // ✅ Add /api prefix here
  timeout: 30000,
  withCredentials: true, // Essential for session-based auth
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
      method: config.method?.toUpperCase(),
      fullUrl: `${config.baseURL}${config.url}`,
      withCredentials: config.withCredentials,
      headers: config.headers
    });
    return config;
  },
  (error) => {
    console.error('[API REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for logging and error handling
api.interceptors.response.use(
  (response) => {
    console.log(`[API RESPONSE] ${response.status} ${response.statusText}`, {
      url: response.config.url,
      status: response.status,
      dataSize: JSON.stringify(response.data).length
    });
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`[API ERROR] ${error.response.status} ${error.response.statusText}`, {
        url: error.config?.url,
        status: error.response.status,
        message: error.response.data?.error || error.response.data?.message,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('[API ERROR] No response received', {
        url: error.config?.url,
        message: error.message
      });
    } else {
      console.error('[API ERROR] Request setup failed', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;