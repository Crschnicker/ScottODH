/**
 * Authentication Service
 * Handles all authentication-related API calls for Scott Overhead Doors
 */

import { API_BASE_URL } from '../config/apiConfig';

class AuthService {
  constructor() {
    this.baseURL = API_BASE_URL || 'http://localhost:5000';
    this.isLoggingOut = false;
    this.logoutCompletedAt = null;
    this.LOGOUT_PROTECTION_TIME = 15000; // 15 seconds
  }

  /**
   * Make authenticated API request with improved CORS error handling
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultOptions = {
      credentials: 'include', // Important: include cookies for session management
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log(`Making request to: ${url}`, { method: defaultOptions.method || 'GET' });
      
      const response = await fetch(url, defaultOptions);
      
      // Enhanced logging for debugging
      console.log(`Response status: ${response.status} for ${url}`);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          console.log(`Response data:`, data);
          return data;
        }
        return { success: true };
      } else {
        // Enhanced error handling
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        console.error(`Request failed:`, errorData);
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
    } catch (error) {
      // Better error categorization
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('Network/CORS error:', error);
        throw new Error('Network error: Unable to connect to server. Check if backend is running and CORS is configured.');
      }
      
      // CORS-specific error detection
      if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
        console.error('CORS error detected:', error);
        throw new Error('CORS error: Cross-origin request blocked. Check backend CORS configuration.');
      }
      
      console.error('Request error:', error);
      throw error;
    }
  }

  /**
   * Login user with enhanced error reporting
   */
  async login(username, password) {
    try {
      console.log(`Attempting login for user: ${username}`);
      
      // Clear logout state when logging in
      this.isLoggingOut = false;
      this.logoutCompletedAt = null;
      localStorage.removeItem('lastLogoutTime');
      localStorage.removeItem('authBlocked');
      
      const response = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      if (response.user) {
        console.log('Login successful:', response.user);
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        return response;
      }
      
      throw new Error('Login failed: No user data received');
    } catch (error) {
      console.error('Login error:', error);
      
      // More specific error messages
      if (error.message.includes('Network error')) {
        throw new Error('Cannot connect to server. Please check if the backend is running on http://localhost:5000');
      }
      
      if (error.message.includes('CORS')) {
        throw new Error('Server configuration error. Please check CORS settings.');
      }
      
      throw error;
    }
  }

  /**
   * Simplified logout with better error handling
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
      
      // Clear local data first
      this.clearAuthData();
      
      // Try server logout
      try {
        await this.makeRequest('/api/auth/logout', { method: 'POST' });
        console.log('Server logout successful');
      } catch (serverError) {
        console.warn('Server logout failed (but local logout succeeded):', serverError);
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
        message: 'Logout completed with errors', 
        error: error.message 
      };
    } finally {
      // Keep logout protection active
      setTimeout(() => {
        this.isLoggingOut = false;
        localStorage.removeItem('authBlocked');
        console.log('Logout protection period ended');
      }, this.LOGOUT_PROTECTION_TIME);
    }
  }

  /**
   * Clear authentication data
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
        'user_session'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(key);
        }
      });
      
      console.log('Authentication data cleared');
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
   * Validate session with enhanced logging
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
      console.log('Session validation result:', isValid);
      
      return isValid;
    } catch (error) {
      console.error('Session validation failed:', error);
      this.clearAuthData();
      return false;
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser() {
    try {
      if (this.isAuthenticationBlocked()) {
        console.log('getCurrentUser blocked due to recent logout');
        return null;
      }
      
      const response = await this.makeRequest('/api/auth/me');
      
      if (response.id) {
        localStorage.setItem('currentUser', JSON.stringify(response));
        return response;
      }
      
      return null;
    } catch (error) {
      console.error('getCurrentUser failed:', error);
      localStorage.removeItem('currentUser');
      return null;
    }
  }

  /**
   * Change password
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await this.makeRequest('/api/auth/change-password', {
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
    const isAuth = userData !== null;
    console.log('isAuthenticated check:', isAuth);
    return isAuth;
  }

  /**
   * Get stored user data
   */
  getStoredUser() {
    try {
      if (this.isAuthenticationBlocked()) {
        console.log('getStoredUser returning null - authentication blocked');
        return null;
      }
      
      const userData = localStorage.getItem('currentUser');
      return userData ? JSON.parse(userData) : null;
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

  // User Management Methods (Admin only)
  async getUsers() {
    try {
      const response = await this.makeRequest('/api/users');
      return response;
    } catch (error) {
      console.error('Get users error:', error);
      throw error;
    }
  }

  async createUser(userData) {
    try {
      const response = await this.makeRequest('/api/users', {
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
      const response = await this.makeRequest(`/api/users/${userId}`, {
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
      const response = await this.makeRequest(`/api/users/${userId}`, {
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
      const response = await this.makeRequest(`/api/users/${userId}/reset-password`, {
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