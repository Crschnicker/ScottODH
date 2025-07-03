/**
 * Authentication Service
 * Handles all authentication-related API calls for Scott Overhead Doors
 */

import { API_BASE_URL } from '../config/apiConfig';

class AuthService {
  constructor() {
    this.baseURL = API_BASE_URL || 'http://localhost:5000';
    this.isLoggingOut = false; // Track logout state to prevent re-authentication
    this.logoutCompletedAt = null; // Track when logout completed
    this.LOGOUT_PROTECTION_TIME = 15000; // 15 seconds of protection after logout
  }

  /**
   * Make authenticated API request with proper error handling
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
      const response = await fetch(url, defaultOptions);
      
      // Handle different response types
      if (response.ok) {
        // Check if response has content
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        return { success: true };
      } else {
        // Try to get error message from response
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
    } catch (error) {
      // Network errors or other issues
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server');
      }
      throw error;
    }
  }

  /**
   * Login user with username and password
   */
  async login(username, password) {
    try {
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
        // Store user data in localStorage for persistence
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        return response;
      }
      
      throw new Error('Login failed: No user data received');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Logout current user with enhanced error handling and forced cleanup
   * Prevents automatic re-authentication by thoroughly clearing all data
   */
  async logout() {
    try {
      // Set logout flags immediately and aggressively to prevent any re-authentication
      this.isLoggingOut = true;
      localStorage.setItem('authBlocked', 'true');
      localStorage.setItem('lastLogoutTime', Date.now().toString());
      
      // Always clear local data first to prevent auto-re-login
      const userData = this.getStoredUser();
      const username = userData ? userData.username : 'unknown';
      
      console.log(`Attempting logout for user: ${username}`);
      
      // Clear stored data immediately and aggressively
      this.clearAuthData();
      
      // Attempt server logout (but don't fail if it doesn't work)
      try {
        const response = await this.makeRequest('/api/auth/logout', {
          method: 'POST',
        });
        
        console.log('Server logout successful:', response);
        
        // If server indicates force reauth required, ensure complete cleanup
        if (response.force_reauth_required) {
          this.clearAuthData();
          // Clear any browser cached credentials
          if (typeof document !== 'undefined') {
            document.cookie.split(";").forEach(function(c) { 
              document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
            });
          }
        }
        
        // Set logout completed timestamp for extended protection
        this.logoutCompletedAt = Date.now();
        
        return { success: true, message: 'Logout successful' };
        
      } catch (serverError) {
        // Server logout failed, but local logout already succeeded
        console.warn('Server logout failed, but local logout completed:', serverError);
        
        // Still set logout completed timestamp
        this.logoutCompletedAt = Date.now();
        
        // Don't throw error - logout should always succeed from user perspective
        return { 
          success: true, 
          message: 'Logged out locally', 
          serverError: serverError.message 
        };
      }
      
    } catch (error) {
      // Even if everything fails, ensure local data is cleared
      console.error('Logout error, forcing local cleanup:', error);
      this.clearAuthData();
      this.logoutCompletedAt = Date.now();
      
      // Always return success for logout
      return { 
        success: true, 
        message: 'Logout completed with errors', 
        error: error.message 
      };
    } finally {
      // Keep logout flag active for extended period to prevent immediate re-auth
      setTimeout(() => {
        this.isLoggingOut = false;
        localStorage.removeItem('authBlocked');
      }, this.LOGOUT_PROTECTION_TIME);
    }
  }

  /**
   * Enhanced method to clear all authentication data
   * Ensures complete cleanup to prevent automatic re-login
   */
  clearAuthData() {
    try {
      // Remove all possible stored authentication data
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
      
      console.log('All authentication data cleared from local storage');
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  }

  /**
   * Check if authentication is currently blocked due to recent logout
   * @returns {boolean} True if auth should be blocked
   */
  isAuthenticationBlocked() {
    // Check if currently logging out
    if (this.isLoggingOut) {
      console.log('Authentication blocked - logout in progress');
      return true;
    }

    // Check for auth blocked flag
    if (localStorage.getItem('authBlocked') === 'true') {
      console.log('Authentication blocked - authBlocked flag set');
      return true;
    }

    // Check if we recently completed logout
    if (this.logoutCompletedAt) {
      const timeSinceLogout = Date.now() - this.logoutCompletedAt;
      if (timeSinceLogout < this.LOGOUT_PROTECTION_TIME) {
        console.log('Authentication blocked - recent logout completed');
        return true;
      }
      // Clear old logout timestamp
      this.logoutCompletedAt = null;
    }

    // Check localStorage logout timestamp
    const logoutTimestamp = localStorage.getItem('lastLogoutTime');
    if (logoutTimestamp) {
      const timeSinceLogout = Date.now() - parseInt(logoutTimestamp);
      if (timeSinceLogout < this.LOGOUT_PROTECTION_TIME) {
        console.log('Authentication blocked - recent logout timestamp');
        return true;
      }
      // Remove old logout timestamp
      localStorage.removeItem('lastLogoutTime');
    }

    return false;
  }

  /**
   * Validate authentication status with server
   * Enhanced to prevent automatic re-login loops
   */
  async validateSession() {
    try {
      // First check if authentication is blocked
      if (this.isAuthenticationBlocked()) {
        console.log('Session validation blocked due to recent logout');
        return false;
      }
      
      const user = await this.getCurrentUser();
      return user !== null;
    } catch (error) {
      // Clear invalid data and don't auto-retry
      this.clearAuthData();
      return false;
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser() {
    try {
      // Block if authentication is not allowed
      if (this.isAuthenticationBlocked()) {
        console.log('getCurrentUser blocked due to recent logout');
        return null;
      }
      
      const response = await this.makeRequest('/api/auth/me');
      
      if (response.id) {
        // Update stored user data
        localStorage.setItem('currentUser', JSON.stringify(response));
        return response;
      }
      
      return null;
    } catch (error) {
      // Clear invalid stored data
      localStorage.removeItem('currentUser');
      return null;
    }
  }

  /**
   * Change current user's password
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
   * Check if user is authenticated (client-side check)
   */
  isAuthenticated() {
    // Return false if authentication is blocked due to logout
    if (this.isAuthenticationBlocked()) {
      console.log('isAuthenticated returning false - authentication blocked');
      return false;
    }
    
    const userData = localStorage.getItem('currentUser');
    return userData !== null;
  }

  /**
   * Get stored user data (for quick access without API call)
   */
  getStoredUser() {
    try {
      // Return null if authentication is blocked due to logout
      if (this.isAuthenticationBlocked()) {
        console.log('getStoredUser returning null - authentication blocked');
        return null;
      }
      
      const userData = localStorage.getItem('currentUser');
      return userData ? JSON.parse(userData) : null;
    } catch {
      // Clear corrupted data
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

  /**
   * Get all users (admin only)
   */
  async getUsers() {
    try {
      const response = await this.makeRequest('/api/users');
      return response;
    } catch (error) {
      console.error('Get users error:', error);
      throw error;
    }
  }

  /**
   * Create new user (admin only)
   */
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

  /**
   * Update user (admin only)
   */
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

  /**
   * Delete user (admin only)
   */
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

  /**
   * Reset user password (admin only)
   */
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