import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
  // Authentication state management
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
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

  /**
   * Initialize authentication check on app startup
   * Validates existing sessions and manages loading states
   */
  useEffect(() => {
    initializeAuthentication();
  }, []);

  /**
   * Initialize authentication system with comprehensive error handling
   * Checks for existing valid sessions and manages app startup flow
   */
  const initializeAuthentication = async () => {
    try {
      setIsAuthLoading(true);
      
      // Check for stored user data first for faster UI response
      const storedUser = authService.getStoredUser();
      if (!storedUser) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        return;
      }
      
      // Validate session with server to ensure security
      const isValidSession = await authService.validateSession();
      if (isValidSession) {
        const userData = await authService.getCurrentUser();
        if (userData) {
          setCurrentUser(userData);
          setIsAuthenticated(true);
          
          // Welcome back message for returning users
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
        // Session expired - clear data and require re-login
        authService.clearAuthData();
        setIsAuthenticated(false);
        setCurrentUser(null);
        toast.info("Session expired. Please sign in again.", {
          position: "bottom-right",
          autoClose: 5000,
        });
      }
    } catch (error) {
      console.error('Authentication initialization failed:', error);
      // On any error, clear auth data for security
      authService.clearAuthData();
      setIsAuthenticated(false);
      setCurrentUser(null);
      
      toast.error("Authentication error. Please sign in.", {
        position: "bottom-right",
        autoClose: 4000,
      });
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
      setCurrentUser(userData);
      setIsAuthenticated(true);
      
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
      console.log(`User ${userData.username} authenticated successfully`);
    } catch (error) {
      console.error('Login success handler error:', error);
      toast.error("Login successful but there was an issue. Please refresh the page.", {
        position: "bottom-right",
        autoClose: 5000,
      });
    }
  };

  /**
   * Handle user logout with comprehensive cleanup and user feedback
   * Ensures all user data is properly cleared from application state
   */
  const handleLogout = async () => {
    try {
      // Show loading state during logout process
      toast.info("Signing out...", {
        position: "bottom-right",
        autoClose: 2000,
      });

      await authService.logout();
      
      // Clear all authentication state
      setCurrentUser(null);
      setIsAuthenticated(false);
      
      // Clear any open modals
      setShowPasswordModal(false);
      resetPasswordForm();
      
      // Success message
      toast.success("Successfully signed out. Have a great day!", {
        position: "bottom-right",
        autoClose: 3000,
      });
      
    } catch (error) {
      console.error('Logout failed:', error);
      
      // Force logout even if server request fails for security
      authService.clearAuthData();
      setCurrentUser(null);
      setIsAuthenticated(false);
      setShowPasswordModal(false);
      resetPasswordForm();
      
      toast.warn("Signed out locally. You may need to sign in again.", {
        position: "bottom-right",
        autoClose: 4000,
      });
    }
  };

  /**
   * Handle password change with comprehensive validation and user feedback
   * Includes client-side validation and secure server communication
   */
  const handlePasswordChange = async () => {
    // Comprehensive client-side validation
    if (!passwordData.current_password?.trim()) {
      toast.error("Please enter your current password", { position: "bottom-right" });
      return;
    }

    if (!passwordData.new_password?.trim()) {
      toast.error("Please enter a new password", { position: "bottom-right" });
      return;
    }

    if (!passwordData.confirm_password?.trim()) {
      toast.error("Please confirm your new password", { position: "bottom-right" });
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("New passwords do not match", { position: "bottom-right" });
      return;
    }

    if (passwordData.new_password.length < 6) {
      toast.error("New password must be at least 6 characters long", { position: "bottom-right" });
      return;
    }

    if (passwordData.new_password === passwordData.current_password) {
      toast.error("New password must be different from your current password", { position: "bottom-right" });
      return;
    }

    // Advanced password strength validation
    const hasLetter = /[a-zA-Z]/.test(passwordData.new_password);
    const hasNumber = /\d/.test(passwordData.new_password);
    
    if (!hasLetter || !hasNumber) {
      toast.error("Password must contain at least one letter and one number", { position: "bottom-right" });
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
        toast.error("Current password is incorrect. Please try again.", { position: "bottom-right" });
      } else if (error.message.includes('Network error')) {
        toast.error("Network error. Please check your connection and try again.", { position: "bottom-right" });
      } else {
        toast.error(error.message || "Failed to change password. Please try again.", { position: "bottom-right" });
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

  // Show loading screen during authentication initialization
  if (isAuthLoading) {
    return (
      <div className="app-container">
        <div className="main-content">
          <div className="content-loader">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading Scott Overhead Doors...</span>
            </div>
            <div className="ms-3">
              <h5 className="mb-0">Loading Application...</h5>
              <small className="text-muted">Checking authentication status</small>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show login page if user is not authenticated
  if (!isAuthenticated || !currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Enhanced Header props with authentication data
  const headerProps = {
    currentUser,
    onLogout: handleLogout,
    onShowPasswordModal: () => setShowPasswordModal(true),
    isAuthenticated: true
  };

  return (
    <div className="app-container">
      {/* Enhanced Header with authentication support */}
      <Header {...headerProps} />
      
      {/* Main content area with improved spacing and padding */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard currentUser={currentUser} />} />
          <Route path="/customers" element={<Customers currentUser={currentUser} />} />
          <Route path="/estimates" element={<Estimates currentUser={currentUser} />} />
          <Route path="/estimates/:estimateId/progress" element={<EstimateInProgress currentUser={currentUser} />} />
          <Route path="/bids" element={<Bids currentUser={currentUser} />} />
          <Route path="/bids/:bidId" element={<Bids currentUser={currentUser} />} />
          <Route path="/jobs" element={<Jobs currentUser={currentUser} />} />
          <Route path="/jobs/:jobId" element={<Jobs currentUser={currentUser} />} />
          <Route path="/schedule" element={<Schedule currentUser={currentUser} />} />
          <Route path="/schedule/job/:jobId" element={<ScheduleJob currentUser={currentUser} />} />
          
          {/* Admin-only routes with proper access control */}
          {currentUser?.role === 'admin' && (
            <Route path="/users" element={<UserManagementPage currentUser={currentUser} />} />
          )}
          
          {/* Fallback route for unauthorized access */}
          <Route path="/users" element={
            <div className="main-content">
              <div className="card">
                <div className="card-body text-center">
                  <div className="empty-state">
                    <div className="empty-state-icon">🔒</div>
                    <h3 className="empty-state-text">Access Denied</h3>
                    <p className="text-muted">Admin privileges required to access user management.</p>
                    <button 
                      className="btn btn-primary"
                      onClick={() => window.history.back()}
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              </div>
            </div>
          } />
        </Routes>
      </main>
      
      {/* Enhanced footer with user context */}
      <Footer currentUser={currentUser} />
      
      {/* Password Change Modal with your existing styling */}
      {showPasswordModal && (
        <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
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
                          onChange={(e) => setPasswordData({
                            ...passwordData,
                            current_password: e.target.value
                          })}
                          placeholder="Enter your current password"
                          disabled={passwordChangeLoading}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => togglePasswordVisibility('current')}
                          disabled={passwordChangeLoading}
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
                          onChange={(e) => setPasswordData({
                            ...passwordData,
                            new_password: e.target.value
                          })}
                          placeholder="Enter your new password"
                          disabled={passwordChangeLoading}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => togglePasswordVisibility('new')}
                          disabled={passwordChangeLoading}
                        >
                          <i className={`fas ${showPasswords.new ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
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
                          onChange={(e) => setPasswordData({
                            ...passwordData,
                            confirm_password: e.target.value
                          })}
                          placeholder="Confirm your new password"
                          disabled={passwordChangeLoading}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => togglePasswordVisibility('confirm')}
                          disabled={passwordChangeLoading}
                        >
                          <i className={`fas ${showPasswords.confirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                    </div>

                    {/* Password Requirements */}
                    <div className="alert alert-info">
                      <h6 className="alert-heading">
                        <i className="fas fa-info-circle me-1"></i>
                        Password Requirements:
                      </h6>
                      <ul className="mb-0 small">
                        <li>At least 6 characters long</li>
                        <li>Must contain letters and numbers</li>
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
                             !passwordData.confirm_password}
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
      />
    </div>
  );
}

export default App;