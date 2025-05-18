/**
 * api.js - Axios configuration for API requests with ngrok support
 * 
 * This module provides a configured axios instance that handles:
 * - Environment-specific API endpoints (local, ngrok, production)
 * - Comprehensive error handling with detailed logging
 * - Request/response interceptors for timing and availability
 * - Connection status monitoring and recovery
 */

import axios from 'axios';

/**
 * Environment configuration settings for API endpoints
 * @typedef {Object} ApiEnvironmentConfig
 * @property {string} local - Local development API URL
 * @property {string} ngrok - ngrok tunnel API URL
 * @property {string} production - Production API URL
 */
const API_ENDPOINTS = {
  local: 'http://127.0.0.1:5000/api',
  ngrok: 'https://ScottOhd-api.ngrok.io/api',
  production: process.env.REACT_APP_API_URL || 'https://api.yourdomain.com/api'
};

/**
 * Application environment - determined from NODE_ENV or defaults to 'ngrok'
 * @type {string}
 */
const APP_ENV = process.env.REACT_APP_ENV || 'ngrok';

/**
 * Basic request configuration
 * @type {Object}
 */
const REQUEST_CONFIG = {
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

/**
 * Creates the full API configuration based on environment
 * @returns {Object} Full axios configuration object
 */
const createApiConfig = () => {
  // Select the appropriate base URL based on environment
  const baseURL = API_ENDPOINTS[APP_ENV] || API_ENDPOINTS.ngrok;
  
  return {
    baseURL,
    ...REQUEST_CONFIG
  };
};

/**
 * Create axios instance with proper configuration
 */
const api = axios.create(createApiConfig());

/**
 * Changes the API environment (local, ngrok, production)
 * @param {string} environment - The environment to switch to
 * @returns {boolean} True if successful, false if invalid environment
 */
export const setApiEnvironment = (environment) => {
  if (!API_ENDPOINTS[environment]) {
    console.error(`Invalid API environment: ${environment}`);
    return false;
  }
  
  // Update the baseURL in the axios instance
  api.defaults.baseURL = API_ENDPOINTS[environment];
  console.log(`API environment switched to: ${environment} (${api.defaults.baseURL})`);
  
  // Store setting in localStorage for persistence
  localStorage.setItem('apiEnvironment', environment);
  
  return true;
};

/**
 * Initializes API with saved environment settings if available
 */
const initializeApi = () => {
  const savedEnvironment = localStorage.getItem('apiEnvironment');
  if (savedEnvironment && API_ENDPOINTS[savedEnvironment]) {
    setApiEnvironment(savedEnvironment);
  }
};

// Run initialization on module load
initializeApi();

/**
 * Check if the server is available
 * @param {string} [url=api.defaults.baseURL] - URL to check
 * @param {number} [timeout=5000] - Timeout in milliseconds
 * @returns {Promise<Object>} Object containing success status and additional info
 */
export const checkServerConnection = async (url, timeout = 5000) => {
  const endpoint = url || api.defaults.baseURL;
  
  try {
    const startTime = Date.now();
    
    // Attempt a HEAD request to the server root
    const response = await axios({
      method: 'head',
      url: endpoint,
      timeout: timeout
    });
    
    const pingTime = Date.now() - startTime;
    
    return {
      success: true,
      status: response.status,
      pingTime,
      message: `Server is available (${pingTime}ms)`
    };
  } catch (error) {
    const errorDetails = extractErrorDetails(error);
    
    return {
      success: false,
      error: errorDetails,
      message: `Server unavailable: ${errorDetails.message}`
    };
  }
};

/**
 * Extracts detailed information from an error object
 * @param {Error} error - The error object
 * @returns {Object} Enhanced error object with detailed information
 */
const extractErrorDetails = (error) => {
  const details = {
    message: error.message,
    name: error.name,
    code: error.code,
    online: window.navigator.onLine
  };
  
  if (error.response) {
    // Server responded with an error status code
    details.type = 'response_error';
    details.status = error.response.status;
    details.statusText = error.response.statusText;
    details.data = error.response.data;
  } else if (error.request) {
    // Request was made but no response received
    details.type = 'request_error';
    details.requestSent = true;
    details.method = error.config?.method;
    details.url = error.config?.url;
    details.timeout = error.config?.timeout;
  } else {
    // Error in setting up the request
    details.type = 'setup_error';
  }
  
  return details;
};

/**
 * Custom error handler with detailed logging
 * @param {Error} error - The error object from axios
 * @returns {Object} Enhanced error object with additional info
 */
const handleApiError = (error) => {
  const enhancedError = { ...error };
  const details = extractErrorDetails(error);
  
  // Merge extracted details into enhanced error
  Object.assign(enhancedError, details);
  
  // Log appropriate error message based on error type
  switch (details.type) {
    case 'response_error':
      console.error(`Server Error: ${details.status} - ${details.statusText}`);
      console.error('Response data:', details.data);
      break;
    case 'request_error':
      console.error('No response received from server');
      console.error('Request details:', {
        method: details.method,
        url: details.url,
        timeout: details.timeout
      });
      break;
    case 'setup_error':
      console.error('Error setting up request:', details.message);
      break;
    default:
      console.error('Unhandled API error:', error);
  }
  
  // Check for connectivity issues
  if (!details.online) {
    console.error('Browser reports offline status - network unavailable');
  }
  
  return enhancedError;
};

/**
 * Request interceptor to add timestamps and handle online status
 */
api.interceptors.request.use(
  (config) => {
    // Add request metadata
    config.metadata = { 
      startTime: Date.now(),
      requestId: generateRequestId()
    };
    
    // Check if the browser is online
    if (!window.navigator.onLine) {
      return Promise.reject(new Error('No internet connection available'));
    }
    
    // Log outgoing requests in development environment
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Request [${config.metadata.requestId}]: ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    console.error('Request setup error:', error);
    return Promise.reject(handleApiError(error));
  }
);

/**
 * Response interceptor for timing, error handling, and logging
 */
api.interceptors.response.use(
  (response) => {
    // Calculate and log response timing
    const metadata = response.config.metadata || {};
    const requestTime = metadata.startTime;
    
    if (requestTime) {
      const duration = Date.now() - requestTime;
      
      // Add timing information to response
      response.metadata = {
        ...(response.metadata || {}),
        duration,
        requestId: metadata.requestId
      };
      
      // Log slow requests
      if (duration > 1000) {
        console.warn(`Slow API call [${metadata.requestId}]: ${response.config.method?.toUpperCase()} ${response.config.url} took ${duration}ms`);
      }
    }
    
    return response;
  },
  (error) => {
    // Enhanced error handling and logging
    return Promise.reject(handleApiError(error));
  }
);

/**
 * Generates a unique request ID for tracking purposes
 * @returns {string} Unique request identifier
 */
const generateRequestId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

/**
 * Automatically attempts to reconnect to the server when it becomes available
 * @param {Function} callback - Function to call when reconnection is successful
 * @param {number} [interval=5000] - Polling interval in milliseconds
 * @returns {Object} Control object with stop method
 */
export const monitorServerConnection = (callback, interval = 5000) => {
  let timerId = null;
  let attempts = 0;
  
  const checkConnection = async () => {
    attempts++;
    
    const result = await checkServerConnection();
    
    if (result.success) {
      if (typeof callback === 'function') {
        callback(result);
      }
      
      // Stop monitoring if reconnection is successful
      stop();
    } else {
      // Log every 5 attempts to avoid console spam
      if (attempts % 5 === 0) {
        console.log(`Reconnection attempt ${attempts}: Server still unavailable`);
      }
    }
  };
  
  // Start polling
  timerId = setInterval(checkConnection, interval);
  
  // Initial check
  checkConnection();
  
  // Return stop function
  const stop = () => {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };
  
  return { stop };
};

// Export the configured axios instance as default
export default api;