// src/config/apiConfig.js

/**
 * Dynamically determines the API base URL based on the environment.
 * Detects ngrok, production, and local development environments.
 */
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;

  // Check for ngrok
  if (hostname.includes('ngrok.io')) {
    // Use the current origin for ngrok to ensure cookies work correctly
    return `${window.location.origin}`;
  }
  
  // Add other environments if needed (e.g., production)
  // if (hostname === 'app.scottohd.com') {
  //   return 'https://api.scottohd.com';
  // }

  // Default to local development
  return 'http://localhost:5000'; // Assuming your local API is at /api
};

// Export the dynamically determined URL
export const API_BASE_URL = getApiBaseUrl();

/**
 * Get authentication headers for API requests.
 * (This part remains the same)
 */
export const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
};

/**
 * Format URL with API base.
 * (This part remains the same)
 */
export const formatApiUrl = (endpoint) => {
  // Remove leading slash from endpoint to prevent double slashes
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  return `${API_BASE_URL}/${formattedEndpoint}`;
};