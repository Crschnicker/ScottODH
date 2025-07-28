// frontend/src/services/api.js

import axios from 'axios';
// Import the CORRECT base URL from your configuration file
import { API_BASE_URL } from '../config/apiConfig';

console.log(`[API Service] Initializing with base URL: ${API_BASE_URL}`);

// Create a single, centralized Axios instance
const api = axios.create({
  // Use the correctly determined base URL
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // Crucial for sending session cookies
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// You can keep your helpful interceptors for logging
api.interceptors.request.use(
  (config) => {
    console.log('[API REQUEST]', {
      method: config.method?.toUpperCase(),
      fullUrl: `${config.baseURL}${config.url}`,
      withCredentials: config.withCredentials,
    });
    return config;
  },
  (error) => {
    console.error('[API REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log('[API RESPONSE]', {
      status: response.status,
      url: response.config?.url,
    });
    return response;
  },
  (error) => {
    console.error('[API ERROR]', {
      message: error.message,
      status: error.response?.status,
      url: error.config?.url,
    });
    
    if (error.response?.status === 401) {
      console.error('[AUTH ERROR] Session may be invalid or expired. Please log in again.');
      // Optionally redirect to login page here
    }

    return Promise.reject(error);
  }
);

// Export the single, correctly configured instance
export default api;