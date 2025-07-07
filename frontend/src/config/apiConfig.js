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
    // Option 1: If you deploy your backend to Choreo too, replace with your backend URL
    // return 'https://your-backend-choreo-url.choreoapps.dev';
    
    // Option 2: If you're using a different backend service (Railway, Heroku, etc.)
    // return 'https://your-backend-url.com';
    
    // Option 3: If backend is on same Choreo domain but different port/path
    // return `${origin}/api`;
    
    // Temporary fallback - you need to update this with your actual backend URL
    console.warn('⚠️  Choreo deployment detected but backend URL not configured!');
    console.warn('Please update apiConfig.js with your deployed backend URL');
    return 'https://your-backend-url-here.com'; // Replace this!
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