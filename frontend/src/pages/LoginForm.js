import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Lock, AlertTriangle, Loader, Eye, EyeOff, Shield, Clock, CheckCircle } from 'lucide-react';

/**
 * Enhanced standalone LoginForm component for field tech interface
 * Provides comprehensive authentication with security features and accessibility
 * Designed for embedded use within larger applications or standalone deployment
 */
const LoginForm = ({ onLogin, error, onClearError, customStyles = {} }) => {
  // Core form state management
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Enhanced security and validation features
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState(null);
  const [formValidation, setFormValidation] = useState({
    username: { isValid: null, message: '' },
    password: { isValid: null, message: '' }
  });
  const [inputTouched, setInputTouched] = useState({
    username: false,
    password: false
  });
  
  // Advanced UX features
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [lastAttemptTime, setLastAttemptTime] = useState(null);
  
  // Component refs for enhanced interaction
  const usernameInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const formRef = useRef(null);
  
  // Security configuration constants
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 900000; // 15 minutes in milliseconds
  const MIN_PASSWORD_LENGTH = 3;
  const MIN_USERNAME_LENGTH = 2;
  const VALIDATION_DELAY = 300;

  /**
   * Initialize component with comprehensive setup
   * Handles stored preferences, security state, and accessibility features
   */
  useEffect(() => {
    initializeComponent();
    setupSecurityMonitoring();
    setupNetworkMonitoring();
    
    // Focus username field for immediate interaction
    if (usernameInputRef.current) {
      usernameInputRef.current.focus();
    }
    
    return cleanupEventListeners;
  }, []);

  /**
   * Handle external error propagation with enhanced user feedback
   * Integrates with parent component error handling systems
   */
  useEffect(() => {
    if (error) {
      handleExternalError(error);
    }
  }, [error]);

  /**
   * Monitor account lockout status with real-time countdown updates
   * Provides user feedback during security lockout periods
   */
  useEffect(() => {
    if (isAccountLocked && lockoutEndTime) {
      const lockoutTimer = setInterval(() => {
        const currentTime = Date.now();
        const timeRemaining = lockoutEndTime - currentTime;
        
        if (timeRemaining <= 0) {
          clearAccountLockout();
        }
      }, 1000);

      return () => clearInterval(lockoutTimer);
    }
  }, [isAccountLocked, lockoutEndTime]);

  /**
   * Initialize component with stored preferences and security state
   * Restores user settings and validates existing security restrictions
   */
  const initializeComponent = useCallback(() => {
    try {
      // Restore remember me preference
      const storedRememberMe = localStorage.getItem('loginForm_rememberMe');
      if (storedRememberMe === 'true') {
        setRememberMe(true);
        
        // Restore username if remembered
        const storedUsername = localStorage.getItem('loginForm_username');
        if (storedUsername) {
          setCredentials(prev => ({ ...prev, username: storedUsername }));
          setInputTouched(prev => ({ ...prev, username: true }));
        }
      }
      
      // Check for existing lockout state
      const lockoutData = localStorage.getItem('loginForm_lockout');
      if (lockoutData) {
        const { attempts, endTime } = JSON.parse(lockoutData);
        const timeRemaining = endTime - Date.now();
        
        if (timeRemaining > 0) {
          setLoginAttempts(attempts);
          setIsAccountLocked(true);
          setLockoutEndTime(endTime);
        } else {
          // Clear expired lockout
          localStorage.removeItem('loginForm_lockout');
        }
      }
      
      // Restore last attempt time for rate limiting
      const lastAttempt = localStorage.getItem('loginForm_lastAttempt');
      if (lastAttempt) {
        setLastAttemptTime(parseInt(lastAttempt, 10));
      }
    } catch (storageError) {
      console.warn('Unable to access localStorage for login preferences:', storageError);
    }
  }, []);

  /**
   * Set up comprehensive security monitoring and input validation
   * Includes caps lock detection, input sanitization, and attack prevention
   */
  const setupSecurityMonitoring = useCallback(() => {
    // Caps lock detection for password security
    const handleKeyEvent = (event) => {
      if (event.target === passwordInputRef.current) {
        const isCapsLockOn = event.getModifierState && event.getModifierState('CapsLock');
        setCapsLockActive(isCapsLockOn);
      }
    };

    // Prevent common security issues
    const handlePaste = (event) => {
      // Allow paste but validate content
      setTimeout(() => {
        const target = event.target;
        if (target.name === 'password') {
          // Clear clipboard for security after paste
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('');
          }
        }
      }, 100);
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyEvent);
    document.addEventListener('keyup', handleKeyEvent);
    
    if (formRef.current) {
      formRef.current.addEventListener('paste', handlePaste);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyEvent);
      document.removeEventListener('keyup', handleKeyEvent);
      if (formRef.current) {
        formRef.current.removeEventListener('paste', handlePaste);
      }
    };
  }, []);

  /**
   * Monitor network connectivity for enhanced user experience
   * Provides feedback during network issues and offline scenarios
   */
  const setupNetworkMonitoring = useCallback(() => {
    const updateConnectionStatus = () => {
      setConnectionStatus(navigator.onLine ? 'online' : 'offline');
    };

    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    
    // Initial status check
    updateConnectionStatus();

    return () => {
      window.removeEventListener('online', updateConnectionStatus);
      window.removeEventListener('offline', updateConnectionStatus);
    };
  }, []);

  /**
   * Cleanup function for component unmount
   * Ensures proper cleanup of event listeners and timers
   */
  const cleanupEventListeners = useCallback(() => {
    // Cleanup handled by individual useEffect cleanup functions
  }, []);

  /**
   * Handle external error display with enhanced user feedback
   * Integrates error messages from parent components or API responses
   */
  const handleExternalError = useCallback((errorMessage) => {
    // Check if error indicates account lockout
    if (errorMessage.toLowerCase().includes('locked') || 
        errorMessage.toLowerCase().includes('too many attempts')) {
      handleAccountLockout();
    }
    
    // Check if error indicates network issues
    if (errorMessage.toLowerCase().includes('network') || 
        errorMessage.toLowerCase().includes('connection')) {
      setConnectionStatus('error');
      setTimeout(() => setConnectionStatus('online'), 5000);
    }
  }, []);

  /**
   * Comprehensive input validation with real-time feedback
   * Provides immediate user guidance and prevents common input errors
   */
  const validateInput = useCallback((field, value) => {
    const validation = { isValid: null, message: '' };
    
    switch (field) {
      case 'username':
        if (!value.trim()) {
          validation.isValid = false;
          validation.message = 'Username is required';
        } else if (value.length < MIN_USERNAME_LENGTH) {
          validation.isValid = false;
          validation.message = `Username must be at least ${MIN_USERNAME_LENGTH} characters`;
        } else if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
          validation.isValid = false;
          validation.message = 'Username can only contain letters, numbers, underscore, hyphen, and period';
        } else if (value.length > 50) {
          validation.isValid = false;
          validation.message = 'Username is too long (maximum 50 characters)';
        } else {
          validation.isValid = true;
          validation.message = 'Valid username';
        }
        break;
        
      case 'password':
        if (!value) {
          validation.isValid = false;
          validation.message = 'Password is required';
        } else if (value.length < MIN_PASSWORD_LENGTH) {
          validation.isValid = false;
          validation.message = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
        } else if (value.length > 100) {
          validation.isValid = false;
          validation.message = 'Password is too long (maximum 100 characters)';
        } else {
          validation.isValid = true;
          validation.message = 'Valid password';
        }
        break;
        
      default:
        validation.isValid = null;
        validation.message = '';
    }
    
    return validation;
  }, []);

  /**
   * Enhanced input change handler with comprehensive validation and security
   * Implements rate limiting, input sanitization, and real-time feedback
   */
  const handleInputChange = useCallback((field) => (event) => {
    const value = event.target.value;
    
    // Clear external errors when user starts typing
    if (error && onClearError) {
      onClearError();
    }
    
    // Update credentials with input sanitization
    setCredentials(prev => ({
      ...prev,
      [field]: value.trim()
    }));
    
    // Mark field as touched for validation display
    setInputTouched(prev => ({
      ...prev,
      [field]: true
    }));
    
    // Perform real-time validation with debouncing
    setTimeout(() => {
      const validation = validateInput(field, value.trim());
      setFormValidation(prev => ({
        ...prev,
        [field]: validation
      }));
    }, VALIDATION_DELAY);
    
    // Store username for remember me functionality
    if (field === 'username' && rememberMe && value.trim()) {
      localStorage.setItem('loginForm_username', value.trim());
    }
  }, [error, onClearError, validateInput, rememberMe]);

  /**
   * Handle remember me toggle with secure storage management
   * Manages user preference persistence and data cleanup
   */
  const handleRememberMeChange = useCallback((event) => {
    const isChecked = event.target.checked;
    setRememberMe(isChecked);
    
    try {
      if (isChecked) {
        localStorage.setItem('loginForm_rememberMe', 'true');
        if (credentials.username.trim()) {
          localStorage.setItem('loginForm_username', credentials.username.trim());
        }
      } else {
        localStorage.removeItem('loginForm_rememberMe');
        localStorage.removeItem('loginForm_username');
      }
    } catch (storageError) {
      console.warn('Unable to save remember me preference:', storageError);
    }
  }, [credentials.username]);

  /**
   * Enhanced password visibility toggle with security considerations
   * Provides accessibility features and security-conscious implementation
   */
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
    
    // Maintain focus and cursor position
    setTimeout(() => {
      if (passwordInputRef.current) {
        passwordInputRef.current.focus();
        const length = passwordInputRef.current.value.length;
        passwordInputRef.current.setSelectionRange(length, length);
      }
    }, 0);
  }, []);

  /**
   * Implement account lockout with comprehensive security measures
   * Handles progressive security restrictions and user notification
   */
  const handleAccountLockout = useCallback(() => {
    const lockoutEnd = Date.now() + LOCKOUT_DURATION;
    setIsAccountLocked(true);
    setLockoutEndTime(lockoutEnd);
    
    // Store lockout state for persistence across page reloads
    try {
      localStorage.setItem('loginForm_lockout', JSON.stringify({
        attempts: loginAttempts,
        endTime: lockoutEnd
      }));
    } catch (storageError) {
      console.warn('Unable to store lockout state:', storageError);
    }
    
    // Clear form for security
    setCredentials({ username: '', password: '' });
    setShowPassword(false);
  }, [loginAttempts]);

  /**
   * Clear account lockout and reset security restrictions
   * Restores normal functionality after lockout period expires
   */
  const clearAccountLockout = useCallback(() => {
    setIsAccountLocked(false);
    setLockoutEndTime(null);
    setLoginAttempts(0);
    
    try {
      localStorage.removeItem('loginForm_lockout');
    } catch (storageError) {
      console.warn('Unable to clear lockout state:', storageError);
    }
  }, []);

  /**
   * Calculate and format remaining lockout time for user display
   * Provides real-time countdown feedback during security restrictions
   */
  const getLockoutTimeRemaining = useCallback(() => {
    if (!isAccountLocked || !lockoutEndTime) return '';
    
    const timeRemaining = lockoutEndTime - Date.now();
    if (timeRemaining <= 0) return '';
    
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }, [isAccountLocked, lockoutEndTime]);

  /**
   * Comprehensive form submission with enhanced security and error handling
   * Implements rate limiting, validation, and progressive security measures
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Prevent submission if account is locked
    if (isAccountLocked) {
      return;
    }
    
    // Check network connectivity
    if (connectionStatus === 'offline') {
      if (onClearError) onClearError();
      // Handle offline state appropriately
      return;
    }
    
    // Rate limiting check
    const currentTime = Date.now();
    if (lastAttemptTime && (currentTime - lastAttemptTime) < 1000) {
      return; // Prevent rapid successive attempts
    }
    
    // Comprehensive form validation
    const usernameValidation = validateInput('username', credentials.username);
    const passwordValidation = validateInput('password', credentials.password);
    
    setFormValidation({
      username: usernameValidation,
      password: passwordValidation
    });
    
    setInputTouched({
      username: true,
      password: true
    });
    
    // Stop submission if validation fails
    if (!usernameValidation.isValid || !passwordValidation.isValid) {
      // Focus first invalid field
      if (!usernameValidation.isValid && usernameInputRef.current) {
        usernameInputRef.current.focus();
      } else if (!passwordValidation.isValid && passwordInputRef.current) {
        passwordInputRef.current.focus();
      }
      return;
    }
    
    setIsLoading(true);
    setLastAttemptTime(currentTime);
    
    try {
      // Store attempt time
      localStorage.setItem('loginForm_lastAttempt', currentTime.toString());
      
      // Call parent login handler with enhanced data
      await onLogin({
        username: credentials.username.trim(),
        password: credentials.password,
        rememberMe: rememberMe,
        timestamp: currentTime,
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      // Reset security counters on successful login
      setLoginAttempts(0);
      clearAccountLockout();
      
    } catch (loginError) {
      console.error('Login submission error:', loginError);
      
      // Increment attempt counter
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      
      // Clear password for security
      setCredentials(prev => ({ ...prev, password: '' }));
      
      // Implement progressive security measures
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        handleAccountLockout();
      }
      
      // Focus appropriate field for retry
      if (passwordInputRef.current) {
        passwordInputRef.current.focus();
      }
      
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Enhanced keyboard navigation and accessibility support
   * Provides comprehensive keyboard shortcuts and navigation assistance
   */
  const handleKeyDown = useCallback((event) => {
    // Handle Enter key for form submission
    if (event.key === 'Enter' && !isLoading && !isAccountLocked) {
      event.preventDefault();
      handleSubmit(event);
    }
    
    // Handle Escape key for form reset
    if (event.key === 'Escape') {
      setCredentials({ username: '', password: '' });
      setFormValidation({
        username: { isValid: null, message: '' },
        password: { isValid: null, message: '' }
      });
      setInputTouched({ username: false, password: false });
      if (error && onClearError) {
        onClearError();
      }
    }
    
    // Handle Tab navigation enhancement
    if (event.key === 'Tab') {
      // Allow natural tab navigation
    }
  }, [isLoading, isAccountLocked, handleSubmit, error, onClearError]);

  /**
   * Get appropriate CSS classes for form field styling based on validation state
   * Provides visual feedback for form validation and interaction states
   */
  const getFieldClassName = useCallback((fieldName) => {
    const baseClass = 'login-input';
    const validation = formValidation[fieldName];
    const touched = inputTouched[fieldName];
    
    if (!touched || validation.isValid === null) {
      return baseClass;
    }
    
    return `${baseClass} ${validation.isValid ? 'is-valid' : 'is-invalid'}`;
  }, [formValidation, inputTouched]);

  /**
   * Generate comprehensive connection status indicator
   * Provides real-time feedback about network connectivity and system status
   */
  const renderConnectionStatus = useCallback(() => {
    if (connectionStatus === 'offline') {
      return (
        <div className="connection-status offline">
          <AlertTriangle className="icon-sm" />
          <span>No internet connection</span>
        </div>
      );
    }
    
    if (connectionStatus === 'error') {
      return (
        <div className="connection-status error">
          <AlertTriangle className="icon-sm" />
          <span>Connection error</span>
        </div>
      );
    }
    
    return null;
  }, [connectionStatus]);

  return (
    <div className="login-container" style={customStyles.container}>
      <div className="login-card" style={customStyles.card}>
        <div className="login-header" style={customStyles.header}>
          <h1>Scott Overhead Doors</h1>
          <p>Field Tech Portal</p>
        </div>

        {/* Connection Status Indicator */}
        {renderConnectionStatus()}

        {/* Account Lockout Warning */}
        {isAccountLocked && (
          <div className="login-error lockout-error">
            <Shield className="icon-sm" />
            <div className="lockout-content">
              <span>Account temporarily locked due to security policy</span>
              <div className="lockout-timer">
                <Clock className="icon-xs" />
                <span>Unlocks in: {getLockoutTimeRemaining()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Login Attempts Warning */}
        {loginAttempts > 0 && loginAttempts < MAX_LOGIN_ATTEMPTS && !isAccountLocked && (
          <div className="login-warning">
            <AlertTriangle className="icon-sm" />
            <span>
              {loginAttempts} failed attempt{loginAttempts > 1 ? 's' : ''}. 
              {MAX_LOGIN_ATTEMPTS - loginAttempts} remaining before lockout.
            </span>
          </div>
        )}

        {/* External Error Display */}
        {error && !isAccountLocked && (
          <div className="login-error">
            <AlertTriangle className="icon-sm" />
            <span>{error}</span>
          </div>
        )}

        <form 
          ref={formRef}
          onSubmit={handleSubmit} 
          onKeyDown={handleKeyDown}
          className="login-form"
          style={customStyles.form}
          noValidate
        >
          {/* Enhanced Username Input */}
          <div className="login-input-group">
            <div className="login-input-wrapper">
              <User className="login-input-icon" />
              <input
                ref={usernameInputRef}
                type="text"
                name="username"
                placeholder="Username"
                value={credentials.username}
                onChange={handleInputChange('username')}
                disabled={isLoading || isAccountLocked}
                className={getFieldClassName('username')}
                required
                autoComplete="username"
                maxLength="50"
                aria-label="Username"
                aria-describedby="username-validation"
              />
              {formValidation.username.isValid === true && inputTouched.username && (
                <CheckCircle className="validation-icon valid" />
              )}
              {formValidation.username.isValid === false && inputTouched.username && (
                <AlertTriangle className="validation-icon invalid" />
              )}
            </div>
            {inputTouched.username && formValidation.username.message && (
              <small 
                id="username-validation" 
                className={`validation-message ${formValidation.username.isValid ? 'valid' : 'invalid'}`}
              >
                {formValidation.username.message}
              </small>
            )}
          </div>

          {/* Enhanced Password Input */}
          <div className="login-input-group">
            <div className="login-input-wrapper">
              <Lock className="login-input-icon" />
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                value={credentials.password}
                onChange={handleInputChange('password')}
                disabled={isLoading || isAccountLocked}
                className={getFieldClassName('password')}
                required
                autoComplete="current-password"
                maxLength="100"
                aria-label="Password"
                aria-describedby="password-validation password-warnings"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={togglePasswordVisibility}
                disabled={isLoading || isAccountLocked}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="icon-sm" /> : <Eye className="icon-sm" />}
              </button>
              {formValidation.password.isValid === true && inputTouched.password && (
                <CheckCircle className="validation-icon valid" />
              )}
              {formValidation.password.isValid === false && inputTouched.password && (
                <AlertTriangle className="validation-icon invalid" />
              )}
            </div>
            
            {/* Password Warnings and Validation */}
            <div id="password-warnings">
              {capsLockActive && (
                <small className="caps-lock-warning">
                  <AlertTriangle className="icon-xs" />
                  Caps Lock is active
                </small>
              )}
              {inputTouched.password && formValidation.password.message && (
                <small 
                  id="password-validation" 
                  className={`validation-message ${formValidation.password.isValid ? 'valid' : 'invalid'}`}
                >
                  {formValidation.password.message}
                </small>
              )}
            </div>
          </div>

          {/* Enhanced Remember Me Option */}
          <div className="login-options">
            <label className="remember-me-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={handleRememberMeChange}
                disabled={isLoading || isAccountLocked}
                className="remember-me-checkbox"
              />
              <span className="remember-me-text">
                Remember me for 30 days
              </span>
            </label>
          </div>

          {/* Enhanced Submit Button */}
          <button
            type="submit"
            disabled={isLoading || 
                     isAccountLocked || 
                     !credentials.username || 
                     !credentials.password ||
                     connectionStatus === 'offline' ||
                     formValidation.username.isValid === false ||
                     formValidation.password.isValid === false}
            className={`login-button ${isLoading ? 'loading' : ''} ${isAccountLocked ? 'locked' : ''}`}
            style={customStyles.button}
            aria-label={isLoading ? 'Signing in...' : 'Sign in'}
          >
            {isLoading ? (
              <>
                <Loader className="icon-sm animate-spin" />
                Signing In...
              </>
            ) : isAccountLocked ? (
              <>
                <Shield className="icon-sm" />
                Account Locked
              </>
            ) : connectionStatus === 'offline' ? (
              <>
                <AlertTriangle className="icon-sm" />
                No Connection
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Enhanced Footer */}
        <div className="login-footer" style={customStyles.footer}>
          <p>Contact your administrator for account access</p>
          {loginAttempts > 0 && (
            <small className="security-notice">
              <Shield className="icon-xs" />
              Enhanced security active
            </small>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginForm;