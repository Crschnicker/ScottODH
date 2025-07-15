// src/config/apiConfig.js
// Fixed API Configuration for Choreo deployment with proper error handling

/**
 * Dynamically determines the API base URL based on the environment.
 * Handles Choreo URL prefixes, ngrok tunneling, and local development.
 */
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  const origin = window.location.origin;
  const protocol = window.location.protocol;

  console.log('[API CONFIG] Environment detection:', {
    hostname,
    origin,
    protocol,
    fullUrl: window.location.href
  });

  // Check for Choreo deployment (your current deployment)
  if (hostname.includes('choreoapps.dev')) {
    // FIXED: Your exact deployed backend URL with proper prefix
    const choreoBackendUrl = 'https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev/scottoverhead/backend/v1.0';
    console.log('[API CONFIG] Detected Choreo environment, using:', choreoBackendUrl);
    return choreoBackendUrl;
  }

  // Check for ngrok tunneling
  if (hostname.includes('ngrok.io') || hostname.includes('ngrok-free.app')) {
    // For ngrok, use the backend ngrok URL (usually different from frontend)
    const ngrokBackendUrl = 'https://scottohd.ngrok.io'; // Your backend ngrok tunnel
    console.log('[API CONFIG] Detected ngrok environment, using:', ngrokBackendUrl);
    return ngrokBackendUrl;
  }
  
  // Check for localhost development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const localBackendUrl = 'http://localhost:5000';
    console.log('[API CONFIG] Detected local development, using:', localBackendUrl);
    return localBackendUrl;
  }

  // Production environment fallback
  console.log('[API CONFIG] Using current origin as fallback:', origin);
  return origin;
};

// Export the dynamically determined URL
export const API_BASE_URL = getApiBaseUrl();

// FIXED: Simplified API configuration for better CORS compatibility
export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  withCredentials: true, // Enable credentials for authentication
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
    // REMOVED: Cache-Control and Pragma headers to avoid preflight issues
  }
};

// Log the selected configuration for debugging
console.log(`🔗 API Base URL: ${API_BASE_URL}`);
console.log(`🌐 Current hostname: ${window.location.hostname}`);
console.log(`🛠 API Config:`, API_CONFIG);

/**
 * FIXED: Simplified API health check with better CORS handling
 */
export const checkApiHealth = async () => {
  const healthUrl = `${API_BASE_URL}/api/health`;
  
  console.log(`🏥 Health check URL: ${healthUrl}`);
  
  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include', // FIXED: Include credentials for consistency
      headers: {
        'Accept': 'application/json'
        // REMOVED: Cache-Control header to avoid preflight issues
      }
    });
    
    console.log(`🏥 Health check response:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Health Check Passed:', data);
      return { healthy: true, data, status: response.status };
    } else {
      const errorText = await response.text();
      console.warn(`⚠️ API Health Check Failed:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return { 
        healthy: false, 
        status: response.status, 
        error: `${response.status} ${response.statusText}`,
        body: errorText
      };
    }
  } catch (error) {
    console.error('❌ API Health Check Error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Enhanced error diagnostics
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('🔗 Network connectivity issue detected');
      console.error('🔍 Possible causes:');
      console.error('  - Backend server not running');
      console.error('  - Incorrect API URL configuration');
      console.error('  - CORS configuration issues');
      console.error('  - Network connectivity problems');
    }
    
    return { 
      healthy: false, 
      error: error.message,
      type: error.name,
      url: healthUrl
    };
  }
};

/**
 * FIXED: Simplified CORS test for better compatibility
 */
export const testCorsConfiguration = async () => {
  const corsTestUrl = `${API_BASE_URL}/api/health`;
  
  console.log(`🌐 CORS test URL: ${corsTestUrl}`);
  console.log(`🌐 Origin: ${window.location.origin}`);
  
  try {
    // FIXED: Use simple GET request instead of OPTIONS for CORS test
    const response = await fetch(corsTestUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
    };
    
    console.log('🌐 CORS Headers Received:', corsHeaders);
    
    const isOriginAllowed = corsHeaders['Access-Control-Allow-Origin'] === window.location.origin || 
                           corsHeaders['Access-Control-Allow-Origin'] === '*';
    const credentialsSupported = corsHeaders['Access-Control-Allow-Credentials'] === 'true';
    
    return {
      success: response.ok,
      status: response.status,
      corsHeaders,
      isOriginAllowed,
      credentialsSupported,
      diagnosis: {
        corsConfigured: !!corsHeaders['Access-Control-Allow-Origin'],
        originMatches: isOriginAllowed,
        credentialsEnabled: credentialsSupported
      }
    };
  } catch (error) {
    console.error('❌ CORS Test Failed:', error);
    return {
      success: false,
      error: error.message,
      diagnosis: {
        corsConfigured: false,
        originMatches: false,
        credentialsEnabled: false
      }
    };
  }
};

/**
 * Get authentication headers for API requests
 */
export const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
};

/**
 * Format URL with API base - handles trailing slashes properly
 */
export const formatApiUrl = (endpoint) => {
  // Ensure endpoint starts with /api if not already present
  if (!endpoint.startsWith('/api')) {
    endpoint = `/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  }
  
  // Remove leading slash from endpoint to prevent double slashes
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  return `${API_BASE_URL}/${formattedEndpoint}`;
};

/**
 * Environment detection utilities
 */
export const isProduction = () => window.location.hostname.includes('choreoapps.dev');
export const isDevelopment = () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const isNgrok = () => window.location.hostname.includes('ngrok.io') || window.location.hostname.includes('ngrok-free.app');
export const isChoreo = () => window.location.hostname.includes('choreoapps.dev') || window.location.hostname.includes('choreoapis.dev');

/**
 * FIXED: Debug function with simplified API connectivity test
 */
export const debugApiConnectivity = async () => {
  console.log('🔍 Starting comprehensive API connectivity test...');
  
  const results = {
    config: {
      apiBaseUrl: API_BASE_URL,
      currentOrigin: window.location.origin,
      environment: {
        isProduction: isProduction(),
        isDevelopment: isDevelopment(),
        isNgrok: isNgrok(),
        isChoreo: isChoreo()
      }
    },
    healthCheck: null,
    corsTest: null,
    timestamp: new Date().toISOString()
  };
  
  // Test API health
  console.log('🏥 Testing API health...');
  results.healthCheck = await checkApiHealth();
  
  // Test CORS configuration
  console.log('🌐 Testing CORS configuration...');
  results.corsTest = await testCorsConfiguration();
  
  // Log comprehensive results
  console.log('🔍 API Connectivity Test Results:', results);
  
  // Provide actionable recommendations
  if (!results.healthCheck.healthy) {
    console.error('❌ API Health Check Failed - Recommendations:');
    console.error('  1. Verify backend server is running');
    console.error('  2. Check API URL configuration');
    console.error('  3. Test direct API access in browser');
    console.error(`  4. Try: ${API_BASE_URL}/api/health`);
  }
  
  if (!results.corsTest.success || !results.corsTest.diagnosis.corsConfigured) {
    console.error('❌ CORS Configuration Issues - Recommendations:');
    console.error('  1. Update backend CORS origins');
    console.error('  2. Ensure supports_credentials=True in backend');
    console.error('  3. Add exact frontend origin to backend allowed origins');
    console.error(`  4. Add origin: ${window.location.origin}`);
  }
  
  return results;
};

// FIXED: Only run connectivity test in development to avoid production noise
if (isDevelopment()) {
  debugApiConnectivity().then(results => {
    if (results.healthCheck.healthy && results.corsTest.success) {
      console.log('✅ API connectivity test passed');
    } else {
      console.warn('⚠️ API connectivity issues detected - check logs above');
    }
  });
} else {
  console.log('🚀 Production environment detected - skipping connectivity test');
}

export default {
  API_BASE_URL,
  API_CONFIG,
  checkApiHealth,
  testCorsConfiguration,
  debugApiConnectivity,
  getAuthHeaders,
  formatApiUrl,
  isProduction,
  isDevelopment,
  isNgrok,
  isChoreo
};