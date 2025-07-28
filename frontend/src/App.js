import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
//commit
// Common Components
import Header from './components/common/Header';
import Footer from './components/common/Footer';

// Pages
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Estimates from './pages/Estimates';
import Bids from './pages/Bids';
import Jobs from './pages/Jobs';
import Schedule from './pages/Schedule';
import ScheduleJob from './pages/ScheduleJob';
import EstimateInProgress from './pages/EstimateInProgress';

// Authentication Components
import LoginPage from './pages/LoginPage';
import UserManagementPage from './pages/UserManagementPage';

// Field Tech Interface
import FieldTechInterface from '../src/pages/FieldTechInterface';

// Authentication Service
import authService from './services/authService';

// CSS
import './App.css';

/**
 * Main App component with integrated authentication system
 * Preserves existing design while adding secure user management
 * Maintains responsive behavior and modern layout structure
 */
function App() {
  // Authentication state management - simplified and stable
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // Enhanced logout state management
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutComplete, setLogoutComplete] = useState(false);
  const logoutTimeoutRef = useRef(null);
  
  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  /**
   * Initialize authentication check on app startup
   * Only runs once and respects logout state
   */
  useEffect(() => {
    // Only initialize authentication once on mount, not during logout
    if (!isLoggingOut && !logoutComplete) {
      initializeAuthentication();
    }
}, [initializeAuthentication, isLoggingOut, logoutComplete]); // Add missing dependencies

  /**
   * Clear logout state after a delay - but keep it longer to prevent issues
   */
  useEffect(() => {
    if (logoutComplete) {
      // Clear logout complete flag after 20 seconds (longer protection)
      const timeout = setTimeout(() => {
        setLogoutComplete(false);
      }, 20000);
      
      return () => clearTimeout(timeout);
    }
  }, [logoutComplete]);

  /**
   * Initialize authentication system with comprehensive error handling
   * Checks for existing valid sessions and manages app startup flow
   * Enhanced to respect logout state and prevent unwanted re-authentication
   */
  const initializeAuthentication = async () => {
    try {
      setIsAuthLoading(true);
      setAuthError(null);
      
      console.log('Initializing authentication...');
      
      // COMPREHENSIVE LOGOUT STATE CHECKING - Block authentication if any logout condition is true
      const logoutConditions = [
        isLoggingOut,
        logoutComplete,
        authService.isLoggingOut,
        localStorage.getItem('authBlocked') === 'true'
      ];
      
      if (logoutConditions.some(condition => condition)) {
        console.log('Skipping authentication check - logout state detected');
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsAuthLoading(false);
        return;
      }
      
      // Additional time-based logout protection
      const logoutTimestamp = localStorage.getItem('lastLogoutTime');
      if (logoutTimestamp) {
        const timeSinceLogout = Date.now() - parseInt(logoutTimestamp);
        if (timeSinceLogout < 20000) { // Extended to 20 seconds
          console.log('Skipping authentication check - recent logout detected (timestamp)');
          setIsAuthenticated(false);
          setCurrentUser(null);
          setIsAuthLoading(false);
          return;
        }
        // Remove very old timestamp
        localStorage.removeItem('lastLogoutTime');
      }
      
      // Use the enhanced authService methods that include blocking logic
      const storedUser = authService.getStoredUser();
      if (!storedUser) {
        console.log('No stored user data found');
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsAuthLoading(false);
        return;
      }
      
      console.log('Found stored user data, validating session...');
      
      // Double-check that we're not in logout state before server validation
      if (authService.isAuthenticationBlocked()) {
        console.log('Authentication blocked by service - aborting session validation');
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsAuthLoading(false);
        return;
      }
      
      // Validate session with server to ensure security
      const isValidSession = await authService.validateSession();
      if (isValidSession && !authService.isAuthenticationBlocked()) {
        const userData = await authService.getCurrentUser();
        if (userData && !authService.isAuthenticationBlocked()) {
          console.log('Valid session confirmed, user authenticated');
          setCurrentUser(userData);
          setIsAuthenticated(true);
          
          // Welcome back message for returning users (but not after logout)
          if (!logoutComplete && !isLoggingOut) {
            toast.success(`Welcome back, ${userData.first_name}!`, {
              position: "bottom-right",
              autoClose: 3000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            });
          }
        } else {
          console.log('Session validation failed - no user data');
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else {
        console.log('Session validation failed - clearing data');
        // Session expired - clear data and require re-login
        authService.clearAuthData();
        setIsAuthenticated(false);
        setCurrentUser(null);
        
        // Only show session expired message if not recently logged out
        if (!logoutComplete && !isLoggingOut) {
          toast.info("Session expired. Please sign in again.", {
            position: "bottom-right",
            autoClose: 5000,
          });
        }
      }
    } catch (error) {
      console.error('Authentication initialization failed:', error);
      // On any error, clear auth data for security
      authService.clearAuthData();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setAuthError(error.message || "Authentication error occurred");
      
      // Only show error message if not recently logged out
      if (!logoutComplete && !isLoggingOut) {
        toast.error("Authentication error. Please sign in.", {
          position: "bottom-right",
          autoClose: 4000,
        });
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  /**
   * Handle successful login with proper state management and user feedback
   * @param {Object} userData - User data returned from successful authentication
   */
  const handleLoginSuccess = (userData) => {
    try {
      // CRITICAL: Check if login should be blocked due to recent logout
      if (isLoggingOut || logoutComplete || authService.isAuthenticationBlocked()) {
        console.log('Login attempt blocked - logout state detected, ignoring login success');
        return;
      }
      
      console.log('Handling login success for user:', userData.username);
      
      // Clear any logout state flags when legitimately logging in
      setIsLoggingOut(false);
      setLogoutComplete(false);
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
        logoutTimeoutRef.current = null;
      }
      
      // Set authentication state
      setCurrentUser(userData);
      setIsAuthenticated(true);
      setAuthError(null);
      
      // Success notification with user-friendly message
      toast.success(`Welcome ${userData.first_name}! You're now signed in.`, {
        position: "bottom-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      // Log successful login for security monitoring
      console.log(`User ${userData.username} authenticated successfully at ${new Date().toISOString()}`);
      
    } catch (error) {
      console.error('Login success handler error:', error);
      setAuthError("Login successful but there was an issue. Please refresh the page.");
      toast.error("Login successful but there was an issue. Please refresh the page.", {
        position: "bottom-right",
        autoClose: 5000,
      });
    }
  };

  /**
   * Handle user logout with comprehensive cleanup and user feedback
   * Ensures all user data is properly cleared from application state
   * Enhanced to prevent immediate re-authentication after logout
   */
  const handleLogout = async () => {
    try {
      console.log('Starting logout process...');
      
      // Set logout state immediately to prevent any re-authentication
      setIsLoggingOut(true);
      
      // Clear React state immediately to prevent auto-re-login
      setCurrentUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      setShowPasswordModal(false);
      resetPasswordForm();
      
      // Show loading state during logout process
      toast.info("Signing out...", {
        position: "bottom-right",
        autoClose: 2000,
      });

      console.log('Calling authService.logout()...');
      
      // Call service logout which will handle server communication and data clearing
      const logoutResult = await authService.logout();
      
      console.log('Logout result:', logoutResult);
      
      if (logoutResult.success) {
        // Success message
        toast.success("Successfully signed out. Have a great day!", {
          position: "bottom-right",
          autoClose: 3000,
        });
        
        if (logoutResult.serverError) {
          console.warn('Logout completed with server error:', logoutResult.serverError);
        }
      } else {
        toast.warn("Signed out locally. You may need to sign in again.", {
          position: "bottom-right",
          autoClose: 4000,
        });
      }
      
      // Set logout complete flag to prevent welcome messages and re-authentication
      setLogoutComplete(true);
      
    } catch (error) {
      console.error('Logout failed:', error);
      
      // Force logout even if server request fails for security
      authService.clearAuthData();
      setCurrentUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      setShowPasswordModal(false);
      resetPasswordForm();
      
      // Set logout complete flag even on error
      setLogoutComplete(true);
      
      toast.warn("Signed out locally. You may need to sign in again.", {
        position: "bottom-right",
        autoClose: 4000,
      });
      
    } finally {
      // Clear logout in progress flag after a delay
      logoutTimeoutRef.current = setTimeout(() => {
        console.log('Clearing logout in progress flag');
        setIsLoggingOut(false);
      }, 2000);
    }
  };

  /**
   * Calculate password strength for user feedback
   * @param {string} password - Password to evaluate
   * @returns {number} Strength score from 0-100
   */
  const calculatePasswordStrength = (password) => {
    if (!password) return 0;
    
    let strength = 0;
    
    // Length criteria
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10;
    
    // Character variety criteria
    if (/[a-z]/.test(password)) strength += 15;
    if (/[A-Z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    
    return Math.min(strength, 100);
  };

  /**
   * Handle password change with comprehensive validation and user feedback
   * Includes client-side validation and secure server communication
   */
  const handlePasswordChange = async () => {
    // Comprehensive client-side validation
    const validationErrors = [];
    
    if (!passwordData.current_password?.trim()) {
      validationErrors.push("Current password is required");
    }

    if (!passwordData.new_password?.trim()) {
      validationErrors.push("New password is required");
    }

    if (!passwordData.confirm_password?.trim()) {
      validationErrors.push("Password confirmation is required");
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      validationErrors.push("New passwords do not match");
    }

    if (passwordData.new_password && passwordData.new_password.length < 8) {
      validationErrors.push("New password must be at least 8 characters long");
    }

    if (passwordData.new_password === passwordData.current_password) {
      validationErrors.push("New password must be different from your current password");
    }

    // Advanced password strength validation
    if (passwordData.new_password) {
      const hasLower = /[a-z]/.test(passwordData.new_password);
      const hasNumber = /\d/.test(passwordData.new_password);
      
      if (!hasLower || !hasNumber) {
        validationErrors.push("Password must contain at least one lowercase letter and one number");
      }
      
      if (passwordStrength < 60) {
        validationErrors.push("Password strength is too weak. Please use a stronger password.");
      }
    }

    // Display validation errors
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => {
        toast.error(error, { position: "bottom-right", autoClose: 4000 });
      });
      return;
    }

    try {
      setPasswordChangeLoading(true);
      
      await authService.changePassword(
        passwordData.current_password,
        passwordData.new_password
      );

      // Success handling
      toast.success("Password changed successfully! Your account is now more secure.", {
        position: "bottom-right",
        autoClose: 5000,
      });
      
      setShowPasswordModal(false);
      resetPasswordForm();
      
    } catch (error) {
      console.error('Password change failed:', error);
      
      // Specific error handling for different scenarios
      if (error.message.includes('Current password is incorrect')) {
        toast.error("Current password is incorrect. Please try again.", { 
          position: "bottom-right",
          autoClose: 6000 
        });
      } else if (error.message.includes('Network error')) {
        toast.error("Network error. Please check your connection and try again.", { 
          position: "bottom-right",
          autoClose: 6000 
        });
      } else if (error.message.includes('Session expired')) {
        toast.error("Your session has expired. Please sign in again.", {
          position: "bottom-right",
          autoClose: 6000
        });
        handleLogout();
      } else {
        toast.error(error.message || "Failed to change password. Please try again.", { 
          position: "bottom-right",
          autoClose: 6000 
        });
      }
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  /**
   * Reset password form to initial state with security cleanup
   */
  const resetPasswordForm = () => {
    setPasswordData({
      current_password: '',
      new_password: '',
      confirm_password: ''
    });
    setShowPasswords({
      current: false,
      new: false,
      confirm: false
    });
    setPasswordChangeLoading(false);
    setPasswordStrength(0);
  };

  /**
   * Handle password data changes with real-time strength calculation
   * @param {string} field - Field name to update
   * @param {string} value - New value for the field
   */
  const handlePasswordDataChange = (field, value) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Calculate strength for new password
    if (field === 'new_password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  /**
   * Toggle password visibility for specific form fields
   * @param {string} field - The password field to toggle
   */
  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  /**
   * Handle modal close with proper cleanup
   */
  const handlePasswordModalClose = () => {
    if (!passwordChangeLoading) {
      setShowPasswordModal(false);
      resetPasswordForm();
    }
  };

  /**
   * Get password strength indicator information
   * @returns {Object} Class and text for password strength display
   */
  const getPasswordStrengthInfo = () => {
    if (passwordStrength === 0) return { class: '', text: '' };
    if (passwordStrength < 30) return { class: 'weak', text: 'Weak' };
    if (passwordStrength < 60) return { class: 'fair', text: 'Fair' };
    if (passwordStrength < 80) return { class: 'good', text: 'Good' };
    return { class: 'strong', text: 'Strong' };
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
      }
    };
  }, []);

  // Show loading screen during authentication initialization
  if (isAuthLoading) {
    return (
      <div className="app-container">
        <div className="main-content">
          <div className="content-loader">
            <div className="spinner-border text-primary" role="status" aria-label="Loading">
              <span className="visually-hidden">Loading Scott Overhead Doors...</span>
            </div>
            <div className="ms-3">
              <h5 className="mb-0">Loading Application...</h5>
              <small className="text-muted">
                {authError ? 'Resolving authentication issue...' : 'Checking authentication status'}
              </small>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show login page if user is not authenticated
  if (!isAuthenticated || !currentUser) {
    return (
      <LoginPage 
        onLoginSuccess={handleLoginSuccess} 
        initialError={authError}
        onClearError={() => setAuthError(null)}
      />
    );
  }

  // Handle unauthorized roles - only block truly unauthorized roles
  if (currentUser.role && !['admin', 'field'].includes(currentUser.role)) {
    return (
      <div className="app-container">
        <div className="main-content">
          <div className="card">
            <div className="card-body text-center">
              <div className="empty-state">
                <div className="empty-state-icon">🔒</div>
                <h3 className="empty-state-text">Access Denied</h3>
                <p className="text-muted">Your account role ({currentUser.role}) is not authorized to access this application.</p>
                <button 
                  className="btn btn-primary"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced Header props with authentication data
  const headerProps = {
    currentUser,
    onLogout: handleLogout,
    onShowPasswordModal: () => setShowPasswordModal(true),
    isAuthenticated: true
  };

  // Get password strength info for display
  const passwordStrengthInfo = getPasswordStrengthInfo();

  // Check if user is field technician - they get a simplified interface
  if (currentUser.role === 'field') {
    return (
      <div className="app-container">
        {/* Field technicians get direct access to their interface without admin navigation */}
        <main className="main-content" style={{ paddingTop: 0 }}>
          <Routes>
            {/* Field tech home page */}
            <Route 
              path="/" 
              element={
                <FieldTechInterface 
                  user={currentUser} 
                  onLogout={handleLogout}
                  onShowPasswordModal={() => setShowPasswordModal(true)}
                />
              } 
            />
            
            {/* Mobile job worker routes for field technicians */}
            <Route path="/jobs" element={<Jobs currentUser={currentUser} />} />
            <Route path="/jobs/:jobId" element={<Jobs currentUser={currentUser} />} />
            
            {/* Alternative field interface route */}
            <Route 
              path="/field-interface" 
              element={
                <FieldTechInterface 
                  user={currentUser} 
                  onLogout={handleLogout}
                  onShowPasswordModal={() => setShowPasswordModal(true)}
                />
              } 
            />
            
            {/* Redirect any other routes back to field interface */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
        {/* Simplified footer for field users */}
        <Footer currentUser={currentUser} />
        
        {/* Password change modal for field users */}
        {showPasswordModal && (
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}>
            <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-labelledby="passwordModalTitle">
              <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title" id="passwordModalTitle">
                      <i className="fas fa-key me-2"></i>
                      Change Password
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={handlePasswordModalClose}
                      disabled={passwordChangeLoading}
                      aria-label="Close"
                    ></button>
                  </div>
                  
                  <div className="modal-body">
                    <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }}>
                      {/* Current Password Field */}
                      <div className="mb-3">
                        <label className="form-label">
                          <i className="fas fa-lock me-1"></i>
                          Current Password
                        </label>
                        <div className="input-group">
                          <input
                            type={showPasswords.current ? 'text' : 'password'}
                            className="form-control"
                            value={passwordData.current_password}
                            onChange={(e) => handlePasswordDataChange('current_password', e.target.value)}
                            placeholder="Enter your current password"
                            disabled={passwordChangeLoading}
                            required
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => togglePasswordVisibility('current')}
                            disabled={passwordChangeLoading}
                            aria-label={showPasswords.current ? 'Hide password' : 'Show password'}
                          >
                            <i className={`fas ${showPasswords.current ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                          </button>
                        </div>
                      </div>

                      {/* New Password Field */}
                      <div className="mb-3">
                        <label className="form-label">
                          <i className="fas fa-key me-1"></i>
                          New Password
                        </label>
                        <div className="input-group">
                          <input
                            type={showPasswords.new ? 'text' : 'password'}
                            className="form-control"
                            value={passwordData.new_password}
                            onChange={(e) => handlePasswordDataChange('new_password', e.target.value)}
                            placeholder="Enter your new password"
                            disabled={passwordChangeLoading}
                            required
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => togglePasswordVisibility('new')}
                            disabled={passwordChangeLoading}
                            aria-label={showPasswords.new ? 'Hide password' : 'Show password'}
                          >
                            <i className={`fas ${showPasswords.new ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                          </button>
                        </div>
                        
                        {/* Password Strength Indicator */}
                        {passwordData.new_password && (
                          <div className="mt-2">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <small className="text-muted">Password Strength:</small>
                              <small className={`fw-bold text-${passwordStrengthInfo.class}`}>
                                {passwordStrengthInfo.text}
                              </small>
                            </div>
                            <div className="progress" style={{ height: '4px' }}>
                              <div 
                                className={`progress-bar bg-${passwordStrengthInfo.class}`}
                                role="progressbar"
                                style={{ width: `${passwordStrength}%` }}
                                aria-valuenow={passwordStrength}
                                aria-valuemin="0"
                                aria-valuemax="100"
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Confirm Password Field */}
                      <div className="mb-3">
                        <label className="form-label">
                          <i className="fas fa-check-double me-1"></i>
                          Confirm New Password
                        </label>
                        <div className="input-group">
                          <input
                            type={showPasswords.confirm ? 'text' : 'password'}
                            className="form-control"
                            value={passwordData.confirm_password}
                            onChange={(e) => handlePasswordDataChange('confirm_password', e.target.value)}
                            placeholder="Confirm your new password"
                            disabled={passwordChangeLoading}
                            required
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => togglePasswordVisibility('confirm')}
                            disabled={passwordChangeLoading}
                            aria-label={showPasswords.confirm ? 'Hide password' : 'Show password'}
                          >
                            <i className={`fas ${showPasswords.confirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                          </button>
                        </div>
                      </div>

                      {/* Enhanced Password Requirements */}
                      <div className="alert alert-info">
                        <h6 className="alert-heading">
                          <i className="fas fa-info-circle me-1"></i>
                          Password Requirements:
                        </h6>
                        <ul className="mb-0 small">
                          <li>At least 8 characters long</li>
                          <li>Must contain lowercase letters and numbers</li>
                          <li>Uppercase letters and special characters increase strength</li>
                          <li>Must be different from current password</li>
                        </ul>
                      </div>
                    </form>
                  </div>
                  
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handlePasswordModalClose}
                      disabled={passwordChangeLoading}
                    >
                      <i className="fas fa-times me-1"></i>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handlePasswordChange}
                      disabled={passwordChangeLoading || 
                               !passwordData.current_password || 
                               !passwordData.new_password || 
                               !passwordData.confirm_password ||
                               passwordStrength < 60}
                    >
                      {passwordChangeLoading ? (
                        <>
                          <div className="spinner-border spinner-border-sm me-2" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          Changing Password...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save me-1"></i>
                          Change Password
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Toast notifications for field users */}
        <ToastContainer 
          position="bottom-right" 
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
          toastClassName="custom-toast"
          bodyClassName="custom-toast-body"
          limit={5}
        />
      </div>
    );
  }

  // Admin users get the full interface with navigation
  return (
    <div className="app-container">
      {/* Enhanced Header with authentication support for admins only */}
      <Header {...headerProps} />
      
      {/* Main content area with improved spacing and padding */}
      <main className="main-content">
        <Routes>
          {/* Admin home page */}
          <Route path="/" element={<Dashboard currentUser={currentUser} />} />
          
          {/* All admin routes */}
          <Route path="/customers" element={<Customers currentUser={currentUser} />} />
          <Route path="/estimates" element={<Estimates currentUser={currentUser} />} />
          <Route path="/estimates/:estimateId/progress" element={<EstimateInProgress currentUser={currentUser} />} />
          <Route path="/bids" element={<Bids currentUser={currentUser} />} />
          <Route path="/bids/:bidId" element={<Bids currentUser={currentUser} />} />
          <Route path="/jobs" element={<Jobs currentUser={currentUser} />} />
          <Route path="/jobs/:jobId" element={<Jobs currentUser={currentUser} />} />
          <Route path="/schedule" element={<Schedule currentUser={currentUser} />} />
          <Route path="/schedule/job/:jobId" element={<ScheduleJob currentUser={currentUser} />} />
          
          {/* Admin-only routes */}
          <Route path="/users" element={<UserManagementPage currentUser={currentUser} />} />
          
          {/* Admin access to field interface for testing/support */}
          <Route 
            path="/field-interface" 
            element={
              <FieldTechInterface 
                user={currentUser} 
                onLogout={handleLogout}
                onShowPasswordModal={() => setShowPasswordModal(true)}
              />
            } 
          />
          
          {/* Catch-all route for undefined paths */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      {/* Enhanced footer with user context */}
      <Footer currentUser={currentUser} />
      
      {/* Enhanced Password Change Modal */}
      {showPasswordModal && (
        <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-labelledby="passwordModalTitle">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" id="passwordModalTitle">
                    <i className="fas fa-key me-2"></i>
                    Change Password
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={handlePasswordModalClose}
                    disabled={passwordChangeLoading}
                    aria-label="Close"
                  ></button>
                </div>
                
                <div className="modal-body">
                  <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }}>
                    {/* Current Password Field */}
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-lock me-1"></i>
                        Current Password
                      </label>
                      <div className="input-group">
                        <input
                          type={showPasswords.current ? 'text' : 'password'}
                          className="form-control"
                          value={passwordData.current_password}
                          onChange={(e) => handlePasswordDataChange('current_password', e.target.value)}
                          placeholder="Enter your current password"
                          disabled={passwordChangeLoading}
                          required
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => togglePasswordVisibility('current')}
                          disabled={passwordChangeLoading}
                          aria-label={showPasswords.current ? 'Hide password' : 'Show password'}
                        >
                          <i className={`fas ${showPasswords.current ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                    </div>

                    {/* New Password Field */}
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-key me-1"></i>
                        New Password
                      </label>
                      <div className="input-group">
                        <input
                          type={showPasswords.new ? 'text' : 'password'}
                          className="form-control"
                          value={passwordData.new_password}
                          onChange={(e) => handlePasswordDataChange('new_password', e.target.value)}
                          placeholder="Enter your new password"
                          disabled={passwordChangeLoading}
                          required
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => togglePasswordVisibility('new')}
                          disabled={passwordChangeLoading}
                          aria-label={showPasswords.new ? 'Hide password' : 'Show password'}
                        >
                          <i className={`fas ${showPasswords.new ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                      
                      {/* Password Strength Indicator */}
                      {passwordData.new_password && (
                        <div className="mt-2">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <small className="text-muted">Password Strength:</small>
                            <small className={`fw-bold text-${passwordStrengthInfo.class}`}>
                              {passwordStrengthInfo.text}
                            </small>
                          </div>
                          <div className="progress" style={{ height: '4px' }}>
                            <div 
                              className={`progress-bar bg-${passwordStrengthInfo.class}`}
                              role="progressbar"
                              style={{ width: `${passwordStrength}%` }}
                              aria-valuenow={passwordStrength}
                              aria-valuemin="0"
                              aria-valuemax="100"
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password Field */}
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-check-double me-1"></i>
                        Confirm New Password
                      </label>
                      <div className="input-group">
                        <input
                          type={showPasswords.confirm ? 'text' : 'password'}
                          className="form-control"
                          value={passwordData.confirm_password}
                          onChange={(e) => handlePasswordDataChange('confirm_password', e.target.value)}
                          placeholder="Confirm your new password"
                          disabled={passwordChangeLoading}
                          required
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => togglePasswordVisibility('confirm')}
                          disabled={passwordChangeLoading}
                          aria-label={showPasswords.confirm ? 'Hide password' : 'Show password'}
                        >
                          <i className={`fas ${showPasswords.confirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                    </div>

                    {/* Enhanced Password Requirements */}
                    <div className="alert alert-info">
                      <h6 className="alert-heading">
                        <i className="fas fa-info-circle me-1"></i>
                        Password Requirements:
                      </h6>
                      <ul className="mb-0 small">
                        <li>At least 8 characters long</li>
                        <li>Must contain lowercase letters and numbers</li>
                        <li>Uppercase letters and special characters increase strength</li>
                        <li>Must be different from current password</li>
                      </ul>
                    </div>
                  </form>
                </div>
                
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handlePasswordModalClose}
                    disabled={passwordChangeLoading}
                  >
                    <i className="fas fa-times me-1"></i>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handlePasswordChange}
                    disabled={passwordChangeLoading || 
                             !passwordData.current_password || 
                             !passwordData.new_password || 
                             !passwordData.confirm_password ||
                             passwordStrength < 60}
                  >
                    {passwordChangeLoading ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Changing Password...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save me-1"></i>
                        Change Password
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast notifications with improved styling matching your theme */}
      <ToastContainer 
        position="bottom-right" 
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        toastClassName="custom-toast"
        bodyClassName="custom-toast-body"
        limit={5}
      />
    </div>
  );
}

export default App;