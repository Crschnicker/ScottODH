/**
 * Authentication Service - Fixed for Azure CORS Issues with Updated Endpoints
 * Handles all authentication-related API calls for Scott Overhead Doors
 */

import { API_BASE_URL, API_ENDPOINTS } from '../config/apiConfig';

class AuthService {
  constructor() {
    // Remove localhost fallback for production environment
    this.baseURL = API_BASE_URL;
    this.isLoggingOut = false;
    this.logoutCompletedAt = null;
    this.LOGOUT_PROTECTION_TIME = 15000; // 15 seconds
    
    // Validate that API_BASE_URL is configured
    if (!this.baseURL) {
      console.error('API_BASE_URL is not configured. Check your apiConfig.js file.');
      throw new Error('API configuration is missing. Unable to initialize AuthService.');
    }
    
    console.log('AuthService initialized with base URL:', this.baseURL);
  }

  /**
   * Make authenticated API request with Azure-optimized CORS handling
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    // FIXED: Simplified CORS configuration for Azure
    const defaultOptions = {
      method: options.method || 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // REMOVED: Origin header as it can cause CORS issues in some browsers
        ...options.headers,
      },
      // FIXED: Always include credentials for auth requests, omit for others
      credentials: this.shouldIncludeCredentials(endpoint) ? 'include' : 'omit',
      ...options,
    };

    // Remove any problematic headers that might cause CORS preflight issues
    if (defaultOptions.method === 'GET') {
      delete defaultOptions.headers['Content-Type'];
    }

    try {
      console.log(`Making ${defaultOptions.method} request to: ${url}`);
      console.log('Request credentials mode:', defaultOptions.credentials);
      
      const response = await fetch(url, defaultOptions);
      
      // Enhanced logging for production debugging
      console.log(`Response status: ${response.status} for ${url}`);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          console.log(`Response data received successfully`);
          return data;
        }
        return { success: true };
      } else {
        // Enhanced error handling for production
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        console.error(`Request failed with status ${response.status}:`, errorData);
        
        // Handle specific HTTP status codes
        if (response.status === 401) {
          this.handleUnauthorized();
          throw new Error('Authentication required. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('Access forbidden. You do not have permission to perform this action.');
        } else if (response.status === 404) {
          throw new Error('Requested resource not found. Please check the URL or contact support.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later or contact support.');
        }
        
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Request error details:', {
        name: error.name,
        message: error.message,
        url: url,
        method: defaultOptions.method
      });
      
      // Better error categorization for production
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('Network error detected:', error);
        throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
      }
      
      // CORS-specific error detection and handling
      if (error.message.includes('CORS') || 
          error.message.includes('cross-origin') ||
          error.message.includes('credentials') ||
          error.message.includes('Access-Control-Allow-Credentials') ||
          error.message.includes('preflight')) {
        console.error('CORS error detected:', error);
        throw new Error('Server connection error. Please contact support if this continues.');
      }
      
      // Timeout handling
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your connection and try again.');
      }
      
      // Re-throw the error if it's already a formatted error
      throw error;
    }
  }

  /**
   * FIXED: Simplified credentials policy for Azure
   */
  shouldIncludeCredentials(endpoint = '') {
    try {
      const apiUrl = new URL(this.baseURL);
      const currentUrl = new URL(window.location.href);
      
      // FIXED: For Azure deployments, always include credentials for auth endpoints
      const isAuthEndpoint = endpoint.includes('/auth/') || 
                           endpoint.includes('/login') || 
                           endpoint.includes('/logout') ||
                           endpoint.includes('/me') ||
                           endpoint.includes('/users');
      
      const isAzureDeployment = apiUrl.hostname.includes('azurewebsites.net') || 
                               apiUrl.hostname.includes('azurestaticapps.net') ||
                               currentUrl.hostname.includes('azurewebsites.net') ||
                               currentUrl.hostname.includes('azurestaticapps.net');
      
      const isLocalDev = apiUrl.hostname.includes('localhost') || 
                        apiUrl.hostname.includes('127.0.0.1') ||
                        currentUrl.hostname.includes('localhost') ||
                        currentUrl.hostname.includes('127.0.0.1');
      
      // FIXED: Always include credentials for local development
      if (isLocalDev) {
        console.log('Using credentials: local development');
        return true;
      }
      
      // FIXED: For Azure, always include credentials for auth endpoints
      if (isAzureDeployment && isAuthEndpoint) {
        console.log('Using credentials: Azure auth endpoint');
        return true;
      }
      
      // FIXED: For non-auth endpoints in Azure, still include credentials to maintain session
      if (isAzureDeployment) {
        console.log('Using credentials: Azure deployment');
        return true;  // Changed from false to true
      }
      
      // For same origin, always include credentials
      if (apiUrl.origin === currentUrl.origin) {
        console.log('Using credentials: same origin');
        return true;
      }
      
      // Default to including credentials for better session management
      console.log('Using credentials: default policy');
      return true;  // Changed from false to true
      
    } catch (error) {
      console.warn('Could not determine credential policy, defaulting to include:', error);
      // FIXED: Default to including credentials since backend expects them
      return true;
    }
  }

  /**
   * Handle unauthorized responses
   */
  handleUnauthorized() {
    console.log('Unauthorized response received, clearing auth data');
    this.clearAuthData();
  }

  /**
   * Login user with enhanced production error reporting
   */
  async login(username, password) {
    try {
      console.log(`Attempting login for user: ${username}`);
      
      // Validate inputs
      if (!username || !password) {
        throw new Error('Username and password are required');
      }
      
      // Clear logout state when logging in
      this.isLoggingOut = false;
      this.logoutCompletedAt = null;
      localStorage.removeItem('lastLogoutTime');
      localStorage.removeItem('authBlocked');
      
      // FIXED: Use API_ENDPOINTS for consistent endpoint paths
      const response = await this.makeRequest(API_ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ username, password }),
      });

      if (response && response.user) {
        console.log('Login successful for user:', response.user.username);
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        return response;
      }
      
      throw new Error('Login failed: Invalid response from server');
    } catch (error) {
      console.error('Login error:', error);
      
      // More specific error messages for production
      if (error.message.includes('Unable to connect') || 
          error.message.includes('Server connection error')) {
        throw new Error('Cannot connect to the server. Please check your internet connection and try again.');
      }
      
      // Handle authentication-specific errors
      if (error.message.includes('401') || error.message.includes('Authentication')) {
        throw new Error('Invalid username or password. Please check your credentials and try again.');
      }
      
      if (error.message.includes('403')) {
        throw new Error('Access denied. Please contact support.');
      }
      
      if (error.message.includes('500') || error.message.includes('Server error')) {
        throw new Error('Server is currently unavailable. Please try again later.');
      }
      
      throw error;
    }
  }

  /**
   * Enhanced logout with better production error handling
   */
  async logout() {
    try {
      console.log('Starting logout process...');
      
      // Set logout flags immediately
      this.isLoggingOut = true;
      localStorage.setItem('authBlocked', 'true');
      localStorage.setItem('lastLogoutTime', Date.now().toString());
      
      const userData = this.getStoredUser();
      const username = userData ? userData.username : 'unknown';
      console.log(`Logging out user: ${username}`);
      
      // Clear local data first to ensure user is logged out locally
      this.clearAuthData();
      
      // Try server logout with timeout
      try {
        const logoutPromise = this.makeRequest(API_ENDPOINTS.AUTH.LOGOUT, { method: 'POST' });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Logout request timeout')), 10000)
        );
        
        await Promise.race([logoutPromise, timeoutPromise]);
        console.log('Server logout successful');
      } catch (serverError) {
        console.warn('Server logout failed (local logout succeeded):', serverError.message);
        // Don't throw error here - local logout is sufficient
      }
      
      this.logoutCompletedAt = Date.now();
      console.log('Logout completed successfully');
      
      return { success: true, message: 'Logout successful' };
      
    } catch (error) {
      console.error('Logout error, forcing local cleanup:', error);
      this.clearAuthData();
      this.logoutCompletedAt = Date.now();
      
      return { 
        success: true, 
        message: 'Logout completed', 
        warning: 'Local logout completed but server communication failed'
      };
    } finally {
      // Keep logout protection active for security
      setTimeout(() => {
        this.isLoggingOut = false;
        localStorage.removeItem('authBlocked');
        console.log('Logout protection period ended');
      }, this.LOGOUT_PROTECTION_TIME);
    }
  }

  /**
   * Clear authentication data more thoroughly
   */
  clearAuthData() {
    try {
      const keysToRemove = [
        'currentUser',
        'authToken', 
        'sessionData',
        'userCredentials',
        'remember_token',
        'auth_session',
        'user_session',
        'access_token',
        'refresh_token',
        'jwt_token'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(key);
        }
      });
      
      // Clear any cookies related to authentication
      if (document.cookie) {
        const cookies = document.cookie.split(';');
        cookies.forEach(cookie => {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          if (name.toLowerCase().includes('auth') || 
              name.toLowerCase().includes('session') ||
              name.toLowerCase().includes('token')) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          }
        });
      }
      
      console.log('Authentication data cleared successfully');
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  }

  /**
   * Check if authentication is blocked
   */
  isAuthenticationBlocked() {
    if (this.isLoggingOut) {
      console.log('Authentication blocked - logout in progress');
      return true;
    }

    if (localStorage.getItem('authBlocked') === 'true') {
      console.log('Authentication blocked - authBlocked flag set');
      return true;
    }

    if (this.logoutCompletedAt) {
      const timeSinceLogout = Date.now() - this.logoutCompletedAt;
      if (timeSinceLogout < this.LOGOUT_PROTECTION_TIME) {
        console.log('Authentication blocked - recent logout completed');
        return true;
      }
      this.logoutCompletedAt = null;
    }

    const logoutTimestamp = localStorage.getItem('lastLogoutTime');
    if (logoutTimestamp) {
      const timeSinceLogout = Date.now() - parseInt(logoutTimestamp);
      if (timeSinceLogout < this.LOGOUT_PROTECTION_TIME) {
        console.log('Authentication blocked - recent logout timestamp');
        return true;
      }
      localStorage.removeItem('lastLogoutTime');
    }

    return false;
  }

  /**
   * Validate session with enhanced production logging
   */
  async validateSession() {
    try {
      if (this.isAuthenticationBlocked()) {
        console.log('Session validation blocked due to recent logout');
        return false;
      }
      
      console.log('Validating session...');
      const user = await this.getCurrentUser();
      const isValid = user !== null;
      console.log('Session validation result:', isValid ? 'valid' : 'invalid');
      
      return isValid;
    } catch (error) {
      console.error('Session validation failed:', error);
      this.clearAuthData();
      return false;
    }
  }

  /**
   * Get current user information with enhanced error handling
   */
  async getCurrentUser() {
    try {
      if (this.isAuthenticationBlocked()) {
        console.log('getCurrentUser blocked due to recent logout');
        return null;
      }
      
      const response = await this.makeRequest(API_ENDPOINTS.AUTH.ME);
      
      if (response && response.id) {
        localStorage.setItem('currentUser', JSON.stringify(response));
        return response;
      }
      
      console.log('No valid user data received from server');
      return null;
    } catch (error) {
      console.error('getCurrentUser failed:', error);
      localStorage.removeItem('currentUser');
      
      // Don't log out user for network errors, only for auth errors
      if (error.message.includes('Authentication required') || 
          error.message.includes('401')) {
        this.clearAuthData();
      }
      
      return null;
    }
  }

  /**
   * Change password with enhanced validation
   */
  async changePassword(currentPassword, newPassword) {
    try {
      if (!currentPassword || !newPassword) {
        throw new Error('Current password and new password are required');
      }
      
      if (newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long');
      }
      
      const response = await this.makeRequest(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      
      return response;
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    if (this.isAuthenticationBlocked()) {
      console.log('isAuthenticated returning false - authentication blocked');
      return false;
    }
    
    const userData = localStorage.getItem('currentUser');
    const isAuth = userData !== null && userData !== 'null';
    console.log('isAuthenticated check:', isAuth);
    return isAuth;
  }

  /**
   * Get stored user data with better error handling
   */
  getStoredUser() {
    try {
      if (this.isAuthenticationBlocked()) {
        console.log('getStoredUser returning null - authentication blocked');
        return null;
      }
      
      const userData = localStorage.getItem('currentUser');
      if (!userData || userData === 'null') {
        return null;
      }
      
      const parsed = JSON.parse(userData);
      
      // Validate that the user object has required fields
      if (!parsed || !parsed.id || !parsed.username) {
        console.warn('Invalid user data structure found, clearing...');
        localStorage.removeItem('currentUser');
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('Error getting stored user:', error);
      localStorage.removeItem('currentUser');
      return null;
    }
  }

  /**
   * Check if current user has admin role
   */
  isAdmin() {
    const user = this.getStoredUser();
    return user && user.role === 'admin';
  }

  /**
   * Check if current user has field role
   */
  isField() {
    const user = this.getStoredUser();
    return user && user.role === 'field';
  }

  // User Management Methods (Admin only) with enhanced error handling
  async getUsers() {
    try {
      const response = await this.makeRequest(API_ENDPOINTS.AUTH.USERS);
      return response;
    } catch (error) {
      console.error('Get users error:', error);
      throw error;
    }
  }

  async createUser(userData) {
    try {
      if (!userData || !userData.username || !userData.email) {
        throw new Error('Username and email are required to create a user');
      }
      
      const response = await this.makeRequest(API_ENDPOINTS.AUTH.USERS, {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      return response;
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  }

  async updateUser(userId, userData) {
    try {
      if (!userId) {
        throw new Error('User ID is required to update a user');
      }
      
      const response = await this.makeRequest(`${API_ENDPOINTS.AUTH.USERS}/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      });
      return response;
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  }

  async deleteUser(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required to delete a user');
      }
      
      const response = await this.makeRequest(`${API_ENDPOINTS.AUTH.USERS}/${userId}`, {
        method: 'DELETE',
      });
      return response;
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  }

  async resetUserPassword(userId, newPassword) {
    try {
      if (!userId || !newPassword) {
        throw new Error('User ID and new password are required');
      }
      
      if (newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long');
      }
      
      const response = await this.makeRequest(API_ENDPOINTS.AUTH.RESET_PASSWORD(userId), {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      });
      return response;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const authService = new AuthService();
export default authService;