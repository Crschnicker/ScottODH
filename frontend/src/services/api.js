/**
 * Enhanced api.js - Fixed CORS and connection issues
 * 
 * Key fixes:
 * - Removed problematic headers causing CORS failures
 * - Enhanced ngrok tunnel detection and recovery
 * - Improved error handling for connection issues
 * - Better retry logic for unstable connections
 */

import axios from 'axios';

// Enhanced environment configuration with automatic ngrok detection
const API_ENDPOINTS = {
  local: 'http://127.0.0.1:5000/api',
  ngrok: 'https://ScottOhd-api.ngrok.io/api',
  production: process.env.REACT_APP_API_URL || 'https://api.yourdomain.com/api'
};

// Application environment with intelligent defaults
const APP_ENV = process.env.REACT_APP_ENV || 'ngrok';

// Enhanced request configuration with CORS-safe settings
const REQUEST_CONFIG = {
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
    // Removed 'Connection': 'keep-alive' - unsafe header that browsers block
  },
  // Enhanced retry configuration for ngrok tunnels
  retry: {
    retries: 3,
    retryDelay: (retryCount) => {
      return Math.min(1000 * Math.pow(2, retryCount), 5000);
    },
    retryCondition: (error) => {
      // Retry on network errors, timeouts, and 5xx errors, but not CORS errors
      return !error.response || 
             (error.response.status >= 500) || 
             error.code === 'ECONNABORTED' ||
             error.code === 'ERR_NETWORK';
    }
  }
};

/**
 * Creates the full API configuration based on environment with ngrok detection
 */
const createApiConfig = () => {
  const baseURL = API_ENDPOINTS[APP_ENV] || API_ENDPOINTS.ngrok;
  
  return {
    baseURL,
    ...REQUEST_CONFIG
  };
};

// Create axios instance with enhanced configuration
const api = axios.create(createApiConfig());

// Connection state tracking for better error handling
let connectionState = {
  isOnline: navigator.onLine,
  consecutiveFailures: 0,
  lastSuccessfulRequest: Date.now(),
  ngrokTunnelActive: false,
  avgResponseTime: 0,
  requestCount: 0,
  corsErrorCount: 0, // Track CORS-specific errors
  lastCorsError: null
};

/**
 * Enhanced error details extraction with CORS-specific information
 */
const extractErrorDetails = (error) => {
  const details = {
    message: error.message,
    name: error.name,
    code: error.code,
    online: navigator.onLine,
    isNgrok: api.defaults.baseURL.includes('ngrok'),
    consecutiveFailures: connectionState.consecutiveFailures,
    timestamp: new Date().toISOString()
  };
  
  if (error.response) {
    details.type = 'response_error';
    details.status = error.response.status;
    details.statusText = error.response.statusText;
    details.data = error.response.data;
    details.headers = error.response.headers;
  } else if (error.request) {
    details.type = 'request_error';
    details.requestSent = true;
    details.method = error.config?.method;
    details.url = error.config?.url;
    details.timeout = error.config?.timeout;
    
    // Check for CORS-specific errors
    if (error.message.includes('CORS') || error.message.includes('Access-Control')) {
      details.isCorsError = true;
      details.corsType = 'preflight_failure';
      connectionState.corsErrorCount++;
      connectionState.lastCorsError = Date.now();
    }
  } else {
    details.type = 'setup_error';
  }
  
  // Add ngrok-specific diagnostics
  if (details.isNgrok) {
    details.ngrokDiagnostics = {
      tunnelMayBeExpired: connectionState.consecutiveFailures > 3,
      avgResponseTime: connectionState.avgResponseTime,
      timeSinceLastSuccess: Date.now() - connectionState.lastSuccessfulRequest,
      corsIssues: connectionState.corsErrorCount > 0
    };
  }
  
  return details;
};

/**
 * Enhanced server connection check with CORS-aware testing
 */
export const checkServerConnection = async (url, timeout = 8000) => {
  const endpoint = url || api.defaults.baseURL;
  
  try {
    const startTime = Date.now();
    
    // Use GET instead of HEAD to avoid potential CORS preflight issues
    const response = await axios({
      method: 'get',
      url: `${endpoint}/health`, // Assuming a health check endpoint
      timeout: timeout,
      withCredentials: true,
      headers: {
        'Cache-Control': 'no-cache'
        // Removed custom headers that might trigger CORS preflight
      }
    });
    
    const pingTime = Date.now() - startTime;
    
    // Update connection state on success
    connectionState.consecutiveFailures = 0;
    connectionState.lastSuccessfulRequest = Date.now();
    connectionState.avgResponseTime = (connectionState.avgResponseTime + pingTime) / 2;
    
    return {
      success: true,
      status: response.status,
      pingTime,
      message: `Server responsive (${pingTime}ms)`,
      isNgrok: endpoint.includes('ngrok'),
      consecutiveFailures: connectionState.consecutiveFailures
    };
  } catch (error) {
    const errorDetails = extractErrorDetails(error);
    connectionState.consecutiveFailures++;
    
    return {
      success: false,
      error: errorDetails,
      message: `Server unavailable: ${errorDetails.message}`,
      isNgrok: endpoint.includes('ngrok'),
      consecutiveFailures: connectionState.consecutiveFailures,
      timeSinceLastSuccess: Date.now() - connectionState.lastSuccessfulRequest,
      isCorsError: errorDetails.isCorsError || false
    };
  }
};

/**
 * Enhanced environment switching with CORS error reset
 */
export const setApiEnvironment = (environment) => {
  if (!API_ENDPOINTS[environment]) {
    console.error(`Invalid API environment: ${environment}`);
    return false;
  }
  
  const oldBaseURL = api.defaults.baseURL;
  api.defaults.baseURL = API_ENDPOINTS[environment];
  api.defaults.withCredentials = true;
  
  console.log(`API environment switched from ${oldBaseURL} to: ${environment} (${api.defaults.baseURL})`);
  
  // Reset connection state when switching environments
  connectionState.consecutiveFailures = 0;
  connectionState.corsErrorCount = 0; // Reset CORS error count
  connectionState.lastCorsError = null;
  connectionState.ngrokTunnelActive = environment === 'ngrok' || API_ENDPOINTS[environment].includes('ngrok');
  
  // Store setting for persistence
  localStorage.setItem('apiEnvironment', environment);
  
  // Test new environment immediately
  checkServerConnection(api.defaults.baseURL, 3000).then(result => {
    if (result.success) {
      console.log(`✓ New environment ${environment} is responsive (${result.pingTime}ms)`);
    } else {
      console.warn(`⚠ New environment ${environment} may have issues:`, result.message);
      if (result.isCorsError) {
        console.warn('⚠ CORS configuration may need attention on the server');
      }
    }
  });
  
  return true;
};

/**
 * Initialize API with enhanced environment detection
 */
const initializeApi = () => {
  const savedEnvironment = localStorage.getItem('apiEnvironment');
  if (savedEnvironment && API_ENDPOINTS[savedEnvironment]) {
    setApiEnvironment(savedEnvironment);
  }
  
  // Auto-detect ngrok tunnel status
  if (api.defaults.baseURL.includes('ngrok')) {
    connectionState.ngrokTunnelActive = true;
    console.log('🔗 Ngrok tunnel detected - enhanced error handling enabled');
  }
  
  // Set up online/offline event listeners
  window.addEventListener('online', () => {
    connectionState.isOnline = true;
    console.log('🌐 Connection restored');
  });
  
  window.addEventListener('offline', () => {
    connectionState.isOnline = false;
    console.log('🚫 Connection lost');
  });
};

// Run initialization
initializeApi();

/**
 * Enhanced error handler with CORS-specific recovery strategies
 */
const handleApiError = (error) => {
  const enhancedError = { ...error };
  const details = extractErrorDetails(error);
  
  Object.assign(enhancedError, details);
  
  // Enhanced CORS error handling
  if (details.isCorsError) {
    console.warn('🚫 CORS error detected - this may require server configuration changes');
    
    // Suggest solutions for CORS issues
    if (details.isNgrok) {
      console.log('💡 Ngrok CORS solution: Ensure backend allows custom headers in Access-Control-Allow-Headers');
    }
    
    // Dispatch custom event for UI components to handle CORS issues
    window.dispatchEvent(new CustomEvent('corsError', { 
      detail: { 
        corsErrorCount: connectionState.corsErrorCount,
        lastCorsError: connectionState.lastCorsError,
        suggestion: 'The server needs to allow custom headers in CORS configuration'
      } 
    }));
  }
  
  // Enhanced ngrok tunnel error detection and handling
  if (details.isNgrok && !details.isCorsError) {
    // Only treat as tunnel issue if it's not a CORS problem
    if (details.consecutiveFailures > 2) {
      console.warn('🔗 Ngrok tunnel may be unstable - consecutive failures:', details.consecutiveFailures);
      
      window.dispatchEvent(new CustomEvent('ngrokTunnelIssue', { 
        detail: { 
          consecutiveFailures: details.consecutiveFailures,
          timeSinceLastSuccess: details.timeSinceLastSuccess,
          suggestion: details.consecutiveFailures > 5 ? 'restart_tunnel' : 'wait_and_retry'
        } 
      }));
    }
  }
  
  // Enhanced authentication error handling
  if (details.status === 401 || details.status === 403) {
    console.warn('🔐 Authentication error detected:', details.status);
    window.dispatchEvent(new CustomEvent('authError', { 
      detail: { 
        status: details.status, 
        message: details.data?.error || details.message,
        requiresReauth: details.status === 401
      } 
    }));
  }
  
  // Log comprehensive error information based on severity
  if (details.type === 'response_error') {
    if (details.status >= 500) {
      console.error(`🚨 Server Error: ${details.status} - ${details.statusText}`);
    } else if (details.status >= 400) {
      console.warn(`⚠ Client Error: ${details.status} - ${details.statusText}`);
    }
    
    if (details.data && Object.keys(details.data).length > 0) {
      console.error('Response data:', details.data);
    }
  } else if (details.type === 'request_error') {
    if (details.isCorsError) {
      console.error('🚫 CORS policy blocked the request');
    } else {
      console.error('🌐 No response received from server');
    }
    console.error('Request details:', {
      method: details.method,
      url: details.url,
      timeout: details.timeout,
      isNgrok: details.isNgrok,
      isCorsError: details.isCorsError
    });
  } else {
    console.error('⚙️ Request setup error:', details.message);
  }
  
  // Check for connectivity issues
  if (!details.online) {
    console.error('📶 Browser reports offline status - network unavailable');
  }
  
  return enhancedError;
};

/**
 * Generate simple request ID that won't cause CORS issues
 */
const generateRequestId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${timestamp}-${random}`;
};

/**
 * Enhanced request interceptor with CORS-safe headers
 */
api.interceptors.request.use(
  (config) => {
    // Add request metadata with enhanced tracking
    config.metadata = { 
      startTime: Date.now(),
      requestId: generateRequestId(),
      attempt: 1
    };
    
    // Ensure credentials for session-based auth
    config.withCredentials = true;
    
    // CORS-safe headers only - removed problematic custom headers
    config.headers = {
      ...config.headers,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
      // Removed: X-Request-ID, X-Ngrok-Request, Connection, User-Agent
      // These headers can trigger CORS preflight failures
    };
    
    // Enhanced timeout for ngrok tunnels without custom headers
    if (connectionState.ngrokTunnelActive) {
      if (!config.timeout || config.timeout < 20000) {
        config.timeout = Math.max(config.timeout || 15000, 20000);
      }
    }
    
    // Online status check
    if (!navigator.onLine) {
      return Promise.reject(new Error('No internet connection available'));
    }
    
    // Log outgoing requests in development with enhanced info
    if (process.env.NODE_ENV === 'development') {
      const method = config.method?.toUpperCase();
      const url = config.url;
      const isNgrok = config.baseURL?.includes('ngrok') || connectionState.ngrokTunnelActive;
      console.log(`🚀 API Request [${config.metadata.requestId}]: ${method} ${url}${isNgrok ? ' (ngrok)' : ''}`);
    }
    
    return config;
  },
  (error) => {
    console.error('⚙️ Request setup error:', error);
    return Promise.reject(handleApiError(error));
  }
);

/**
 * Enhanced response interceptor with CORS error detection
 */
api.interceptors.response.use(
  (response) => {
    const metadata = response.config.metadata || {};
    const requestTime = metadata.startTime;
    
    if (requestTime) {
      const duration = Date.now() - requestTime;
      
      // Update connection state on successful request
      connectionState.consecutiveFailures = 0;
      connectionState.lastSuccessfulRequest = Date.now();
      connectionState.requestCount++;
      connectionState.avgResponseTime = connectionState.requestCount === 1 
        ? duration 
        : (connectionState.avgResponseTime + duration) / 2;
      
      // Add timing information to response
      response.metadata = {
        ...(response.metadata || {}),
        duration,
        requestId: metadata.requestId,
        consecutiveFailures: 0
      };
      
      // Log slow requests with enhanced context
      const slowThreshold = connectionState.ngrokTunnelActive ? 2000 : 1000;
      if (duration > slowThreshold) {
        const method = response.config.method?.toUpperCase();
        const url = response.config.url;
        const context = connectionState.ngrokTunnelActive ? ' (ngrok tunnel)' : '';
        console.warn(`🐌 Slow API call [${metadata.requestId}]: ${method} ${url} took ${duration}ms${context}`);
      }
      
      // Success logging for development
      if (process.env.NODE_ENV === 'development' && duration > 100) {
        console.log(`✅ API Response [${metadata.requestId}]: ${duration}ms`);
      }
    }
    
    return response;
  },
  (error) => {
    const handledError = handleApiError(error);
    
    // Update connection state on error
    connectionState.consecutiveFailures++;
    
    // Enhanced CORS error recovery suggestions
    if (handledError.isCorsError) {
      console.warn('🚫 CORS error - consider these solutions:');
      console.warn('   1. Server needs to include custom headers in Access-Control-Allow-Headers');
      console.warn('   2. Consider using standard headers only');
      console.warn('   3. Check if preflight requests are being handled correctly');
      
      // For ngrok specifically
      if (connectionState.ngrokTunnelActive) {
        console.warn('   4. Ngrok may require additional CORS configuration on the backend');
      }
    }
    
    // Enhanced ngrok tunnel error recovery (only for non-CORS errors)
    if (connectionState.ngrokTunnelActive && !handledError.isCorsError && connectionState.consecutiveFailures > 3) {
      console.warn('🔗 Multiple ngrok failures detected, may need tunnel restart');
      
      // Suggest environment switch if local is available
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('💡 Consider switching to local environment');
        window.dispatchEvent(new CustomEvent('suggestEnvironmentSwitch', { 
          detail: { 
            currentEnv: 'ngrok',
            suggestedEnv: 'local',
            reason: 'ngrok_instability'
          } 
        }));
      }
    }
    
    return Promise.reject(handledError);
  }
);

/**
 * Enhanced connection monitoring with CORS-aware checks
 */
export const monitorServerConnection = (callback, interval = 8000) => {
  let timerId = null;
  let attempts = 0;
  let consecutiveSuccesses = 0;
  
  const checkConnection = async () => {
    attempts++;
    
    const result = await checkServerConnection();
    
    if (result.success) {
      consecutiveSuccesses++;
      
      if (typeof callback === 'function') {
        callback({
          ...result,
          attempts,
          consecutiveSuccesses,
          recoveryComplete: consecutiveSuccesses >= 2
        });
      }
      
      // Stop monitoring after successful recovery (2 consecutive successes)
      if (consecutiveSuccesses >= 2) {
        console.log(`✅ Connection stable after ${attempts} attempts`);
        stop();
      }
    } else {
      consecutiveSuccesses = 0;
      
      // Enhanced logging for different error types
      if (result.isCorsError) {
        if (attempts % 2 === 0) { // Less frequent logging for CORS errors
          console.log(`🚫 CORS issue check ${attempts}: Server configuration needed`);
        }
      } else if (result.isNgrok && attempts % 3 === 0) {
        console.log(`🔗 Ngrok tunnel check ${attempts}: Still unavailable (${result.consecutiveFailures} consecutive failures)`);
        
        if (attempts > 10) {
          console.warn('🔗 Consider restarting ngrok tunnel - extended unavailability detected');
        }
      } else if (!result.isNgrok && attempts % 5 === 0) {
        console.log(`🌐 Server check ${attempts}: Still unavailable`);
      }
    }
  };
  
  // Start polling with initial check
  timerId = setInterval(checkConnection, interval);
  checkConnection(); // Initial check
  
  const stop = () => {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };
  
  return { 
    stop,
    getStats: () => ({
      attempts,
      consecutiveSuccesses,
      interval,
      isNgrok: connectionState.ngrokTunnelActive,
      corsErrorCount: connectionState.corsErrorCount
    })
  };
};

/**
 * Enhanced authentication status check with CORS-safe headers
 */
export const checkAuthStatus = async () => {
  try {
    const response = await api.get('/auth/me', { 
      timeout: 5000,
      headers: {
        'Cache-Control': 'no-cache'
        // Only standard headers to avoid CORS issues
      }
    });
    
    // Reset auth failure count on successful auth check
    connectionState.consecutiveAuthFailures = 0;
    
    return {
      authenticated: true,
      user: response.data,
      sessionValid: true
    };
  } catch (error) {
    console.log('🔐 Auth check failed:', error.message);
    
    connectionState.consecutiveAuthFailures = (connectionState.consecutiveAuthFailures || 0) + 1;
    
    return {
      authenticated: false,
      error: error.message,
      sessionValid: false,
      consecutiveFailures: connectionState.consecutiveAuthFailures,
      isCorsError: error.message.includes('CORS') || error.message.includes('Access-Control')
    };
  }
};

// Export connection state for debugging
export const getConnectionState = () => ({ 
  ...connectionState,
  corsErrorCount: connectionState.corsErrorCount,
  lastCorsError: connectionState.lastCorsError 
});

// Export configured axios instance as default
export default api;