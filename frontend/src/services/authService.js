/**
 * Authentication Service
 * Handles all authentication-related API calls for Scott Overhead Doors
 */

import { API_BASE_URL } from '../config/apiConfig';

class AuthService {
  constructor() {
    this.baseURL = API_BASE_URL || 'http://localhost:5000';
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
   * Logout current user
   */
  async logout() {
    try {
      await this.makeRequest('/api/auth/logout', {
        method: 'POST',
      });
      
      // Clear stored user data
      localStorage.removeItem('currentUser');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails on server, clear local data
      localStorage.removeItem('currentUser');
      throw error;
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser() {
    try {
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
    const userData = localStorage.getItem('currentUser');
    return userData !== null;
  }

  /**
   * Get stored user data (for quick access without API call)
   */
  getStoredUser() {
    try {
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

  /**
   * Validate authentication status with server
   * Use this on app startup or after periods of inactivity
   */
  async validateSession() {
    try {
      const user = await this.getCurrentUser();
      return user !== null;
    } catch {
      return false;
    }
  }

  /**
   * Clear all authentication data (use for logout or on error)
   */
  clearAuthData() {
    localStorage.removeItem('currentUser');
  }
}

// Create and export a singleton instance
const authService = new AuthService();
export default authService;