/**
 * API configuration file
 * Contains API base URL and authentication header utilities
 */

// Base URL for API requests - update this to match your backend
export const API_BASE_URL = 'http://localhost:5000';

/**
 * Get authentication headers for API requests
 * This retrieves the auth token from localStorage and adds it to request headers
 * 
 * @returns {Object} Authentication headers object
 */
export const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    return {};
  }
  
  return {
    'Authorization': `Bearer ${token}`
  };
};

/**
 * Format URL with API base
 * Helps create full URLs by combining API_BASE_URL with endpoints
 * 
 * @param {string} endpoint - API endpoint path
 * @returns {string} Complete API URL
 */
export const formatApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  return `${API_BASE_URL}/${formattedEndpoint}`;
};