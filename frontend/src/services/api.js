import axios from 'axios';

/**
 * Dynamic API base URL detection with proper ngrok support
 * This function correctly handles ngrok tunnels and local development
 */
const getApiBaseUrl = () => {
  const currentHost = window.location.hostname;
  const currentProtocol = window.location.protocol;
  const currentPort = window.location.port;
  
  console.log('[API CONFIG] Environment detection:', {
    url: window.location.href,
    host: currentHost,
    protocol: currentProtocol,
    port: currentPort
  });

  // Check if we're running on ngrok
  if (currentHost.includes('ngrok')) {
    const ngrokApiUrl = `${currentProtocol}//${currentHost}/api`;
    console.log('[API CONFIG] Detected ngrok environment, using API URL:', ngrokApiUrl);
    return ngrokApiUrl;
  }
  
  // Check if we're on localhost/127.0.0.1 in development
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    const localApiUrl = 'http://localhost:5000/api';
    console.log('[API CONFIG] Detected local development, using API URL:', localApiUrl);
    return localApiUrl;
  }
  
  // For production or other environments
  let baseUrl = `${currentProtocol}//${currentHost}`;
  if (currentPort && currentPort !== '80' && currentPort !== '443') {
    baseUrl += `:${currentPort}`;
  }
  const productionApiUrl = `${baseUrl}/api`;
  console.log('[API CONFIG] Using production API URL:', productionApiUrl);
  
  return productionApiUrl;
};

// Get the correct API base URL
const API_BASE_URL = getApiBaseUrl();

// Create axios instance with the correct base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout
  
  // Enable credentials to send cookies with requests
  withCredentials: true,
  
  // Set default headers
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
});

/**
 * Log detailed API request information for debugging
 */
const logApiRequest = (config) => {
  console.log('[API REQUEST]', {
    method: config.method?.toUpperCase(),
    url: config.url,
    baseURL: config.baseURL,
    fullUrl: `${config.baseURL}${config.url}`,
    withCredentials: config.withCredentials,
    headers: config.headers,
    hasData: !!config.data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log detailed API response information for debugging
 */
const logApiResponse = (response) => {
  console.log('[API RESPONSE]', {
    status: response.status,
    statusText: response.statusText,
    url: response.config?.url,
    method: response.config?.method?.toUpperCase(),
    hasData: !!response.data,
    headers: response.headers,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log detailed API error information for debugging
 */
const logApiError = (error) => {
  console.error('[API ERROR]', {
    message: error.message,
    status: error.response?.status,
    statusText: error.response?.statusText,
    url: error.config?.url,
    method: error.config?.method?.toUpperCase(),
    responseData: error.response?.data,
    requestHeaders: error.config?.headers,
    responseHeaders: error.response?.headers,
    withCredentials: error.config?.withCredentials,
    timestamp: new Date().toISOString(),
    
    // Additional debugging information
    browserInfo: {
      userAgent: navigator.userAgent,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      language: navigator.language
    },
    
    // Network debugging
    networkInfo: {
      origin: window.location.origin,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      port: window.location.port,
      detectedApiUrl: API_BASE_URL
    }
  });

  // Enhanced error detection for ngrok issues
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    console.error('[NETWORK ERROR] This is likely a configuration issue:', {
      issue: 'Cannot reach API server',
      currentApiUrl: API_BASE_URL,
      currentLocation: window.location.href,
      possibleCauses: [
        'API server not running',
        'Incorrect API URL configuration',
        'CORS issues',
        'Ngrok tunnel configuration mismatch',
        'Firewall blocking requests'
      ],
      debugSteps: [
        `Try accessing ${API_BASE_URL}/health directly in browser`,
        'Check if Flask server is running',
        'Verify ngrok tunnel is forwarding to correct port',
        'Check Flask CORS configuration',
        'Verify both frontend and backend are using same ngrok tunnel'
      ]
    });
  }

  // Log specific authentication issues
  if (error.response?.status === 401) {
    console.error('[AUTH ERROR] 401 Unauthorized detected:', {
      possibleCauses: [
        'Session cookie missing or expired',
        'CORS credentials not being sent',
        'Flask session configuration issue',
        'Different domain/port blocking cookies'
      ],
      debugSteps: [
        'Check browser dev tools -> Application -> Cookies',
        'Verify withCredentials is true',
        'Check Flask CORS configuration',
        'Try logging out and back in'
      ]
    });
  }

  if (error.response?.status === 403) {
    console.error('[PERMISSION ERROR] 403 Forbidden detected:', {
      possibleCauses: [
        'User authenticated but lacks required permissions',
        'Admin role required for this operation',
        'User account may be deactivated'
      ]
    });
  }
};

// Request interceptor for debugging and authentication
api.interceptors.request.use(
  (config) => {
    // Log the request for debugging
    logApiRequest(config);
    
    // Ensure credentials are always included
    config.withCredentials = true;
    
    // Add timestamp to prevent caching issues
    config.headers['X-Request-Timestamp'] = new Date().getTime();
    
    // Add browser information for server-side debugging
    config.headers['X-Client-Info'] = `${navigator.userAgent.substring(0, 100)}`;
    
    // For ngrok environments, add special headers
    if (window.location.hostname.includes('ngrok')) {
      config.headers['X-Forwarded-Proto'] = window.location.protocol.replace(':', '');
      config.headers['X-Forwarded-Host'] = window.location.hostname;
    }
    
    return config;
  },
  (error) => {
    console.error('[API REQUEST INTERCEPTOR ERROR]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for debugging and error handling
api.interceptors.response.use(
  (response) => {
    // Log successful response for debugging
    logApiResponse(response);
    return response;
  },
  (error) => {
    // Log error details for debugging
    logApiError(error);
    
    // Handle specific authentication errors
    if (error.response?.status === 401) {
      console.warn('[API] Authentication required - session may have expired');
    }
    
    // Handle network errors with enhanced messaging
    if (!error.response) {
      console.error('[API] Network error - no response received');
      
      // Provide more specific error message for network issues
      if (error.code === 'ERR_NETWORK') {
        error.message = `Network error: Cannot reach API server at ${API_BASE_URL}. Please check server configuration.`;
      } else {
        error.message = 'Network error. Please check your connection and try again.';
      }
    }
    
    return Promise.reject(error);
  }
);

/**
 * Test API connectivity and authentication
 * @returns {Promise<Object>} API health status
 */
export const testApiConnection = async () => {
  try {
    console.log('[API TEST] Testing API connectivity and authentication...');
    console.log('[API TEST] Using API URL:', API_BASE_URL);
    
    const healthResponse = await api.get('/health');
    console.log('[API TEST] Health check passed:', healthResponse.data);
    
    // Test authentication
    try {
      const authResponse = await api.get('/auth/me');
      console.log('[API TEST] Authentication check passed:', authResponse.data);
      
      return {
        connected: true,
        authenticated: true,
        user: authResponse.data,
        health: healthResponse.data,
        apiUrl: API_BASE_URL,
        timestamp: new Date().toISOString()
      };
    } catch (authError) {
      console.warn('[API TEST] Authentication check failed:', authError.response?.status);
      
      return {
        connected: true,
        authenticated: false,
        authError: authError.response?.status,
        health: healthResponse.data,
        apiUrl: API_BASE_URL,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('[API TEST] API connectivity test failed:', error);
    
    return {
      connected: false,
      authenticated: false,
      error: error.message,
      status: error.response?.status,
      apiUrl: API_BASE_URL,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Helper function to handle authentication-required scenarios
 * @returns {Promise<boolean>} True if authenticated, false otherwise
 */
export const ensureAuthenticated = async () => {
  try {
    const authResponse = await api.get('/auth/me');
    console.log('[AUTH CHECK] User is authenticated:', authResponse.data);
    return true;
  } catch (error) {
    console.warn('[AUTH CHECK] User is not authenticated:', error.response?.status);
    return false;
  }
};

/**
 * Login function that properly handles session creation
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Object>} Login response
 */
export const login = async (username, password) => {
  try {
    console.log('[LOGIN] Attempting to log in user:', username);
    console.log('[LOGIN] Using API URL:', API_BASE_URL);
    
    const response = await api.post('/auth/login', {
      username,
      password
    });
    
    console.log('[LOGIN] Login successful:', response.data);
    
    // Test that the session was created properly
    const testAuth = await ensureAuthenticated();
    if (!testAuth) {
      throw new Error('Login appeared successful but session was not created properly');
    }
    
    return response.data;
  } catch (error) {
    console.error('[LOGIN] Login failed:', error);
    throw error;
  }
};

/**
 * Logout function that properly clears the session
 * @returns {Promise<Object>} Logout response
 */
export const logout = async () => {
  try {
    console.log('[LOGOUT] Logging out user...');
    
    const response = await api.post('/auth/logout');
    
    console.log('[LOGOUT] Logout successful:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('[LOGOUT] Logout failed:', error);
    throw error;
  }
};

/**
 * Debug function to check current configuration
 */
export const debugApiConfiguration = () => {
  const config = {
    baseURL: api.defaults.baseURL,
    timeout: api.defaults.timeout,
    withCredentials: api.defaults.withCredentials,
    headers: api.defaults.headers,
    detectedApiUrl: API_BASE_URL,
    
    // Environment information
    environment: {
      nodeEnv: process.env.NODE_ENV,
      currentUrl: window.location.href,
      currentOrigin: window.location.origin,
      currentHost: window.location.hostname,
      currentPort: window.location.port,
      currentProtocol: window.location.protocol,
      isNgrok: window.location.hostname.includes('ngrok'),
      isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    },
    
    // Browser information
    browser: {
      userAgent: navigator.userAgent,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      language: navigator.language
    }
  };
  
  console.log('[API DEBUG] Current API configuration:', config);
  
  return config;
};

/**
 * Quick fix test - call this to verify the configuration is working
 */
export const quickConnectivityTest = async () => {
  try {
    console.log('[QUICK TEST] Testing API connectivity...');
    console.log('[QUICK TEST] Current window location:', window.location.href);
    console.log('[QUICK TEST] Detected API URL:', API_BASE_URL);
    
    // Test the health endpoint
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('[QUICK TEST] ✅ API connectivity successful:', data);
      return { success: true, data };
    } else {
      console.error('[QUICK TEST] ❌ API returned error:', response.status, response.statusText);
      return { success: false, error: `${response.status} ${response.statusText}` };
    }
  } catch (error) {
    console.error('[QUICK TEST] ❌ API connectivity failed:', error.message);
    return { success: false, error: error.message };
  }
};

// Log the configuration when the module loads
console.log('[API CONFIG] Initialized with:', {
  apiBaseUrl: API_BASE_URL,
  currentLocation: window.location.href,
  isNgrok: window.location.hostname.includes('ngrok'),
  timestamp: new Date().toISOString()
});

// Export the configured axios instance
export default api;