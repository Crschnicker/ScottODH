import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import './LoginPage.css';

/**
 * Enhanced LoginPage component with comprehensive security features
 * Includes rate limiting, session validation, and improved user experience
 * Maintains existing design while adding production-ready authentication
 */
const LoginPage = ({ onLoginSuccess, initialError, onClearError }) => {
  // Form state management with comprehensive tracking
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [remember, setRemember] = useState(false);
  
  // Enhanced security and UX features
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(null);
  const [capsLockWarning, setCapsLockWarning] = useState(false);
  const [formTouched, setFormTouched] = useState(false);
  const [credentialsVisible, setCredentialsVisible] = useState(false);
  
  // Refs for form management
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const formRef = useRef(null);

  // Constants for security features
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  const CAPS_LOCK_CHECK_DELAY = 500;

  /**
   * Initialize component with session checking and stored preferences
   * Handles existing sessions and restores user preferences
   */
  useEffect(() => {
    checkCurrentUser();
    loadStoredPreferences();
    setupSecurityFeatures();
    
    // Focus username field on mount for better UX
    if (usernameRef.current) {
      usernameRef.current.focus();
    }
  }, []);

  /**
   * Handle initial error display and cleanup
   */
  useEffect(() => {
    if (initialError) {
      setError(initialError);
      toast.error(initialError, {
        position: "bottom-right",
        autoClose: 6000,
      });
    }
  }, [initialError]);

  /**
   * Monitor lockout status and provide countdown feedback
   */
  useEffect(() => {
    if (isLocked && lockoutTime) {
      const interval = setInterval(() => {
        const timeRemaining = lockoutTime - Date.now();
        
        if (timeRemaining <= 0) {
          setIsLocked(false);
          setLockoutTime(null);
          setLoginAttempts(0);
          setError('');
          toast.info("Account unlocked. You may now try logging in again.", {
            position: "bottom-right",
            autoClose: 4000,
          });
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isLocked, lockoutTime]);

  /**
   * Load stored user preferences and remember me settings
   * Maintains user preferences across sessions
   */
  const loadStoredPreferences = useCallback(() => {
    try {
      const rememberPreference = localStorage.getItem('rememberLogin');
      const storedUsername = localStorage.getItem('lastUsername');
      
      if (rememberPreference === 'true') {
        setRemember(true);
        if (storedUsername) {
          setFormData(prev => ({ ...prev, username: storedUsername }));
        }
      }
      
      // Check for stored lockout state
      const lockoutData = localStorage.getItem('loginLockout');
      if (lockoutData) {
        const { attempts, lockTime } = JSON.parse(lockoutData);
        const timeRemaining = lockTime - Date.now();
        
        if (timeRemaining > 0) {
          setLoginAttempts(attempts);
          setIsLocked(true);
          setLockoutTime(lockTime);
          setError(`Account temporarily locked. Please wait ${Math.ceil(timeRemaining / 60000)} minutes.`);
        } else {
          // Clear expired lockout
          localStorage.removeItem('loginLockout');
        }
      }
    } catch (error) {
      console.error('Error loading stored preferences:', error);
    }
  }, []);

  /**
   * Set up additional security features and event listeners
   * Includes caps lock detection and form security enhancements
   */
  const setupSecurityFeatures = useCallback(() => {
    // Caps lock detection for password field
    const handleKeyPress = (event) => {
      if (event.getModifierState && event.getModifierState('CapsLock')) {
        setCapsLockWarning(true);
      } else {
        setCapsLockWarning(false);
      }
    };

    // Add event listeners for security features
    document.addEventListener('keydown', handleKeyPress);
    
    // Prevent form auto-completion in some browsers for security
    if (formRef.current) {
      formRef.current.setAttribute('autocomplete', 'off');
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  /**
   * Check for existing user session on component mount
   * Validates existing authentication and handles automatic login
   */
  const checkCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        // If user is already authenticated, trigger success callback
        onLoginSuccess(userData);
        return;
      }
    } catch (error) {
      // User not logged in, which is expected for login page
      console.log('No current user session found');
    }
  };

  /**
   * Enhanced input change handler with validation and security features
   * Provides real-time feedback and security monitoring
   */
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    
    // Mark form as touched for validation feedback
    setFormTouched(true);
    
    // Clear errors when user starts typing
    if (error) {
      setError('');
      if (onClearError) {
        onClearError();
      }
    }
    
    // Update form data with input sanitization
    setFormData(prev => ({
      ...prev,
      [name]: value.trim()
    }));
    
    // Store username for remember me functionality
    if (name === 'username' && value.trim()) {
      localStorage.setItem('lastUsername', value.trim());
    }
  }, [error, onClearError]);

  /**
   * Enhanced form submission with comprehensive security and error handling
   * Includes rate limiting, input validation, and user feedback
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent submission if locked
    if (isLocked) {
      const timeRemaining = Math.ceil((lockoutTime - Date.now()) / 60000);
      toast.error(`Account is locked. Please wait ${timeRemaining} minutes.`, {
        position: "bottom-right",
        autoClose: 6000,
      });
      return;
    }

    // Enhanced client-side validation
    const validationErrors = [];
    
    if (!formData.username?.trim()) {
      validationErrors.push("Username is required");
    } else if (formData.username.length < 2) {
      validationErrors.push("Username must be at least 2 characters");
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(formData.username)) {
      validationErrors.push("Username contains invalid characters");
    }
    
    if (!formData.password?.trim()) {
      validationErrors.push("Password is required");
    } else if (formData.password.length < 3) {
      validationErrors.push("Password is too short");
    }

    // Display validation errors
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.join('. ');
      setError(errorMessage);
      toast.error(errorMessage, {
        position: "bottom-right",
        autoClose: 5000,
      });
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Prepare login request with enhanced security headers
      const loginRequest = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password,
          remember: remember,
          timestamp: Date.now(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      };

      const response = await fetch('/api/auth/login', loginRequest);
      const data = await response.json();

      if (response.ok) {
        // Successful login - clear security restrictions
        setLoginAttempts(0);
        setIsLocked(false);
        setLockoutTime(null);
        localStorage.removeItem('loginLockout');
        
        // Store user preferences
        if (remember) {
          localStorage.setItem('rememberLogin', 'true');
          localStorage.setItem('lastUsername', formData.username.trim());
        } else {
          localStorage.removeItem('rememberLogin');
          localStorage.removeItem('lastUsername');
        }
        
        // Success notification
        toast.success(`Welcome ${data.user?.first_name || formData.username}!`, {
          position: "bottom-right",
          autoClose: 3000,
        });
        
        // Call success callback with user data
        onLoginSuccess(data.user);
        
      } else {
        // Handle login failure with enhanced security
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);
        
        let errorMessage = data.error || 'Login failed. Please check your credentials.';
        
        // Implement progressive security measures
        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          const lockTime = Date.now() + LOCKOUT_DURATION;
          setIsLocked(true);
          setLockoutTime(lockTime);
          
          // Store lockout state
          localStorage.setItem('loginLockout', JSON.stringify({
            attempts: newAttempts,
            lockTime: lockTime
          }));
          
          errorMessage = `Too many failed attempts. Account locked for ${LOCKOUT_DURATION / 60000} minutes.`;
          
          toast.error(errorMessage, {
            position: "top-center",
            autoClose: 8000,
            closeOnClick: false,
            draggable: false,
          });
        } else {
          const attemptsRemaining = MAX_LOGIN_ATTEMPTS - newAttempts;
          
          if (attemptsRemaining <= 2) {
            errorMessage += ` ${attemptsRemaining} attempts remaining.`;
            toast.warning(errorMessage, {
              position: "bottom-right",
              autoClose: 6000,
            });
          } else {
            toast.error(errorMessage, {
              position: "bottom-right",
              autoClose: 5000,
            });
          }
        }
        
        setError(errorMessage);
        
        // Clear password field on failed attempt for security
        setFormData(prev => ({ ...prev, password: '' }));
        
        // Focus password field for retry
        if (passwordRef.current) {
          passwordRef.current.focus();
        }
      }
    } catch (error) {
      console.error('Login network error:', error);
      
      let networkError = 'Network error. Please check your connection and try again.';
      
      // Enhanced network error handling
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        networkError = 'Cannot connect to server. Please check your internet connection.';
      } else if (error.message.includes('timeout')) {
        networkError = 'Login request timed out. Please try again.';
      }
      
      setError(networkError);
      toast.error(networkError, {
        position: "bottom-right",
        autoClose: 7000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Enhanced password visibility toggle with security considerations
   */
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
    
    // Refocus password field after toggle
    setTimeout(() => {
      if (passwordRef.current) {
        passwordRef.current.focus();
        // Move cursor to end of input
        const length = passwordRef.current.value.length;
        passwordRef.current.setSelectionRange(length, length);
      }
    }, 100);
  }, []);

  /**
   * Toggle credentials visibility for demo purposes
   */
  const toggleCredentialsVisibility = useCallback(() => {
    setCredentialsVisible(prev => !prev);
  }, []);

  /**
   * Handle keyboard navigation and accessibility features
   */
  const handleKeyDown = useCallback((e) => {
    // Handle Enter key submission from any field
    if (e.key === 'Enter' && !isLoading && !isLocked) {
      e.preventDefault();
      handleSubmit(e);
    }
    
    // Handle Escape key to clear form
    if (e.key === 'Escape') {
      setFormData({ username: '', password: '' });
      setError('');
      if (usernameRef.current) {
        usernameRef.current.focus();
      }
    }
  }, [isLoading, isLocked, handleSubmit]);

  /**
   * Calculate lockout time remaining for display
   */
  const getLockoutTimeRemaining = useCallback(() => {
    if (!isLocked || !lockoutTime) return '';
    
    const timeRemaining = lockoutTime - Date.now();
    if (timeRemaining <= 0) return '';
    
    const minutes = Math.ceil(timeRemaining / 60000);
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }, [isLocked, lockoutTime]);

  /**
   * Get form validation status for styling
   */
  const getFieldValidationClass = useCallback((fieldName, value) => {
    if (!formTouched) return '';
    
    if (fieldName === 'username') {
      if (!value?.trim()) return 'is-invalid';
      if (value.length < 2) return 'is-invalid';
      if (!/^[a-zA-Z0-9_.-]+$/.test(value)) return 'is-invalid';
      return 'is-valid';
    }
    
    if (fieldName === 'password') {
      if (!value?.trim()) return 'is-invalid';
      if (value.length < 3) return 'is-invalid';
      return 'is-valid';
    }
    
    return '';
  }, [formTouched]);

  return (
    <div className="login-container">
      <div className="login-wrapper">
        {/* Enhanced Header with branding */}
        <div className="login-header">
          <div className="login-logo">
            <div className="logo-icon">
              <i className="fas fa-door-open"></i>
            </div>
          </div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to Scott Overhead Doors</p>
        </div>

        {/* Enhanced Login Card */}
        <div className="login-card">
          <form 
            ref={formRef}
            className="login-form" 
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            noValidate
          >
            {/* Username Field with Enhanced Validation */}
            <div className="form-group">
              <label htmlFor="username" className="form-label">
                <i className="fas fa-user me-2"></i>
                Username
              </label>
              <div className="input-group">
                <div className="input-icon">
                  <i className="fas fa-user"></i>
                </div>
                <input
                  ref={usernameRef}
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  className={`form-input ${getFieldValidationClass('username', formData.username)}`}
                  placeholder="Enter your username"
                  disabled={isLoading || isLocked}
                  maxLength="50"
                  aria-describedby="username-help"
                />
              </div>
              {formTouched && getFieldValidationClass('username', formData.username) === 'is-invalid' && (
                <small id="username-help" className="form-text text-danger">
                  <i className="fas fa-exclamation-triangle me-1"></i>
                  Please enter a valid username (2+ characters, letters, numbers, _, -, . only)
                </small>
              )}
            </div>

            {/* Password Field with Enhanced Security Features */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                <i className="fas fa-lock me-2"></i>
                Password
              </label>
              <div className="input-group">
                <div className="input-icon">
                  <i className="fas fa-lock"></i>
                </div>
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`form-input ${getFieldValidationClass('password', formData.password)}`}
                  placeholder="Enter your password"
                  disabled={isLoading || isLocked}
                  maxLength="100"
                  aria-describedby="password-help"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={togglePasswordVisibility}
                  disabled={isLoading || isLocked}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              
              {/* Caps Lock Warning */}
              {capsLockWarning && (
                <small className="form-text text-warning">
                  <i className="fas fa-exclamation-triangle me-1"></i>
                  Caps Lock is on
                </small>
              )}
              
              {formTouched && getFieldValidationClass('password', formData.password) === 'is-invalid' && (
                <small id="password-help" className="form-text text-danger">
                  <i className="fas fa-exclamation-triangle me-1"></i>
                  Password must be at least 3 characters long
                </small>
              )}
            </div>

            {/* Enhanced Form Options */}
            <div className="form-options">
              <div className="checkbox-group">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="form-checkbox"
                  disabled={isLoading || isLocked}
                />
                <label htmlFor="remember-me" className="checkbox-label">
                  <i className="fas fa-save me-1"></i>
                  Remember me for 30 days
                </label>
              </div>
            </div>

            {/* Enhanced Error Display */}
            {error && (
              <div className={`error-message ${isLocked ? 'error-locked' : ''}`}>
                <i className={`fas ${isLocked ? 'fa-lock' : 'fa-exclamation-triangle'}`}></i>
                <div className="error-content">
                  <span className="error-text">{error}</span>
                  {isLocked && (
                    <small className="error-countdown">
                      Time remaining: {getLockoutTimeRemaining()}
                    </small>
                  )}
                </div>
              </div>
            )}

            {/* Login Attempts Warning */}
            {loginAttempts > 0 && loginAttempts < MAX_LOGIN_ATTEMPTS && !isLocked && (
              <div className="warning-message">
                <i className="fas fa-shield-alt"></i>
                <span>
                  {loginAttempts} failed attempt{loginAttempts > 1 ? 's' : ''}. 
                  {MAX_LOGIN_ATTEMPTS - loginAttempts} remaining before lockout.
                </span>
              </div>
            )}

            {/* Enhanced Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isLocked || !formData.username || !formData.password}
              className={`login-button ${isLoading ? 'loading' : ''} ${isLocked ? 'locked' : ''}`}
            >
              {isLoading ? (
                <>
                  <div className="spinner"></div>
                  <span>Signing in...</span>
                </>
              ) : isLocked ? (
                <>
                  <i className="fas fa-lock"></i>
                  <span>Account Locked</span>
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt"></i>
                  <span>Sign in</span>
                </>
              )}
            </button>
          </form>

        </div>

        {/* Enhanced Footer */}
        <div className="login-footer">
          <p>
            <i className="fas fa-copyright me-2"></i>
            © 2025 Scott Overhead Doors. All rights reserved.
          </p>
          <div className="footer-links">
            <small className="text-muted">
              Secure login system with advanced protection
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;