// src/config/apiConfig.js

/**
 * Dynamically determines the API base URL based on the environment.
 * Detects Choreo, ngrok, production, and local development environments.
 */
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  const origin = window.location.origin;

  // Check for Choreo deployment (your current deployment)
  if (hostname.includes('choreoapps.dev')) {
    // Your deployed backend on Choreo
    return 'https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev/scottoverhead/backend/v1.0';
  }

  // Check for ngrok
  if (hostname.includes('ngrok.io')) {
    // Use the current origin for ngrok to ensure cookies work correctly
    return origin;
  }
  
  // Production environment (uncomment and customize as needed)
  // if (hostname === 'app.scottohd.com') {
  //   return 'https://api.scottohd.com';
  // }

  // Default to local development
  return 'http://localhost:5000';
};

// Export the dynamically determined URL
export const API_BASE_URL = getApiBaseUrl();

// Log the selected API URL for debugging
console.log(`🔗 API Base URL: ${API_BASE_URL}`);
console.log(`🌐 Current hostname: ${window.location.hostname}`);

/**
 * Get authentication headers for API requests.
 */
export const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
};

/**
 * Format URL with API base.
 */
export const formatApiUrl = (endpoint) => {
  // Remove leading slash from endpoint to prevent double slashes
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  return `${API_BASE_URL}/${formattedEndpoint}`;
};

/**
 * Environment detection utilities
 */
export const isProduction = () => window.location.hostname.includes('choreoapps.dev');
export const isDevelopment = () => window.location.hostname === 'localhost';
export const isNgrok = () => window.location.hostname.includes('ngrok.io');