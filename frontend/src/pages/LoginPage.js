import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import authService from '../services/authService'; // <-- 1. IMPORT THE AUTH SERVICE
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

  /**
   * Initialize component with session checking and stored preferences
   * Handles existing sessions and restores user preferences
   */
  useEffect(() => {
    // Note: The original 'checkCurrentUser' fetch call is omitted as it's better
    // handled by a parent component (like App.js) that manages routing.
    // This component's job is to handle the login action itself.
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
          localStorage.removeItem('loginLockout');
        }
      }
    } catch (error) {
      console.error('Error loading stored preferences:', error);
    }
  }, []);

  /**
   * Set up additional security features and event listeners
   */
  const setupSecurityFeatures = useCallback(() => {
    const handleKeyPress = (event) => {
      if (typeof event.getModifierState === 'function' && event.getModifierState('CapsLock')) {
        setCapsLockWarning(true);
      } else {
        setCapsLockWarning(false);
      }
    };
    document.addEventListener('keydown', handleKeyPress);
    if (formRef.current) {
      formRef.current.setAttribute('autocomplete', 'off');
    }
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  /**
   * Enhanced input change handler
   */
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormTouched(true);
    if (error) {
      setError('');
      if (onClearError) {
        onClearError();
      }
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  }, [error, onClearError]);

  /**
   * *** 2. REFACTORED HANDLE SUBMIT FUNCTION ***
   * Enhanced form submission using the centralized authService.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isLocked) {
      const timeRemaining = Math.ceil((lockoutTime - Date.now()) / 60000);
      toast.error(`Account is locked. Please wait ${timeRemaining} minutes.`, { position: "bottom-right" });
      return;
    }

    const validationErrors = [];
    if (!formData.username?.trim()) validationErrors.push("Username is required");
    else if (formData.username.length < 2) validationErrors.push("Username must be at least 2 characters");
    else if (!/^[a-zA-Z0-9_.-]+$/.test(formData.username)) validationErrors.push("Username contains invalid characters");
    
    if (!formData.password?.trim()) validationErrors.push("Password is required");
    else if (formData.password.length < 3) validationErrors.push("Password is too short");

    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.join('. ');
      setError(errorMessage);
      toast.error(errorMessage, { position: "bottom-right" });
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Use the authService to perform the login
      const response = await authService.login(formData.username.trim(), formData.password);

      // --- Success Handling ---
      setLoginAttempts(0);
      setIsLocked(false);
      setLockoutTime(null);
      localStorage.removeItem('loginLockout');
      
      if (remember) {
        localStorage.setItem('rememberLogin', 'true');
        localStorage.setItem('lastUsername', formData.username.trim());
      } else {
        localStorage.removeItem('rememberLogin');
        localStorage.removeItem('lastUsername');
      }
      
      toast.success(`Welcome ${response.user?.first_name || formData.username}!`, {
        position: "bottom-right",
        autoClose: 3000,
      });
      
      onLoginSuccess(response.user);
      
    } catch (error) {
      // --- Error Handling ---
      // authService standardizes errors, so we just need to catch them here.
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      
      let errorMessage = error.message || 'Login failed. Please check your credentials.';
      
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockTime = Date.now() + LOCKOUT_DURATION;
        setIsLocked(true);
        setLockoutTime(lockTime);
        localStorage.setItem('loginLockout', JSON.stringify({ attempts: newAttempts, lockTime }));
        errorMessage = `Too many failed attempts. Account locked for ${LOCKOUT_DURATION / 60000} minutes.`;
        toast.error(errorMessage, { position: "top-center", autoClose: 8000, closeOnClick: false, draggable: false });
      } else {
        const attemptsRemaining = MAX_LOGIN_ATTEMPTS - newAttempts;
        if (attemptsRemaining <= 2) {
          errorMessage += ` ${attemptsRemaining} attempts remaining.`;
          toast.warning(errorMessage, { position: "bottom-right", autoClose: 6000 });
        } else {
          toast.error(errorMessage, { position: "bottom-right", autoClose: 5000 });
        }
      }
      
      setError(errorMessage);
      setFormData(prev => ({ ...prev, password: '' }));
      if (passwordRef.current) {
        passwordRef.current.focus();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ... (The rest of your component's helper functions and JSX are perfect and do not need changes) ...

  const togglePasswordVisibility = useCallback(() => { /* ... no changes needed ... */ });
  const toggleCredentialsVisibility = useCallback(() => { /* ... no changes needed ... */ });
  const handleKeyDown = useCallback((e) => { /* ... no changes needed ... */ });
  const getLockoutTimeRemaining = useCallback(() => { /* ... no changes needed ... */ });
  const getFieldValidationClass = useCallback((fieldName, value) => { /* ... no changes needed ... */ });

  return (
    <div className="login-container">
      {/* --- ALL JSX REMAINS THE SAME --- */}
      <div className="login-wrapper">
        <div className="login-header">
          <div className="login-logo">
            <div className="logo-icon"><i className="fas fa-door-open"></i></div>
          </div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to Scott Overhead Doors</p>
        </div>
        <div className="login-card">
          <form ref={formRef} className="login-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
            {/* Username Field */}
            <div className="form-group">
              <label htmlFor="username" className="form-label"><i className="fas fa-user me-2"></i>Username</label>
              <div className="input-group">
                <div className="input-icon"><i className="fas fa-user"></i></div>
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
                <small id="username-help" className="form-text text-danger"><i className="fas fa-exclamation-triangle me-1"></i>Please enter a valid username (2+ characters, letters, numbers, _, -, . only)</small>
              )}
            </div>
            {/* Password Field */}
            <div className="form-group">
              <label htmlFor="password" className="form-label"><i className="fas fa-lock me-2"></i>Password</label>
              <div className="input-group">
                <div className="input-icon"><i className="fas fa-lock"></i></div>
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
                <button type="button" className="password-toggle" onClick={togglePasswordVisibility} disabled={isLoading || isLocked} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              {capsLockWarning && (<small className="form-text text-warning"><i className="fas fa-exclamation-triangle me-1"></i>Caps Lock is on</small>)}
              {formTouched && getFieldValidationClass('password', formData.password) === 'is-invalid' && (
                <small id="password-help" className="form-text text-danger"><i className="fas fa-exclamation-triangle me-1"></i>Password must be at least 3 characters long</small>
              )}
            </div>
            {/* Form Options */}
            <div className="form-options">
              <div className="checkbox-group">
                <input id="remember-me" name="remember-me" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="form-checkbox" disabled={isLoading || isLocked} />
                <label htmlFor="remember-me" className="checkbox-label"><i className="fas fa-save me-1"></i>Remember me for 30 days</label>
              </div>
            </div>
            {/* Error Display */}
            {error && (
              <div className={`error-message ${isLocked ? 'error-locked' : ''}`}>
                <i className={`fas ${isLocked ? 'fa-lock' : 'fa-exclamation-triangle'}`}></i>
                <div className="error-content">
                  <span className="error-text">{error}</span>
                  {isLocked && (<small className="error-countdown">Time remaining: {getLockoutTimeRemaining()}</small>)}
                </div>
              </div>
            )}
            {/* Login Attempts Warning */}
            {loginAttempts > 0 && loginAttempts < MAX_LOGIN_ATTEMPTS && !isLocked && (
              <div className="warning-message">
                <i className="fas fa-shield-alt"></i>
                <span>{loginAttempts} failed attempt{loginAttempts > 1 ? 's' : ''}. {MAX_LOGIN_ATTEMPTS - loginAttempts} remaining before lockout.</span>
              </div>
            )}
            {/* Submit Button */}
            <button type="submit" disabled={isLoading || isLocked || !formData.username || !formData.password} className={`login-button ${isLoading ? 'loading' : ''} ${isLocked ? 'locked' : ''}`}>
              {isLoading ? (<><div className="spinner"></div><span>Signing in...</span></>) : isLocked ? (<><i className="fas fa-lock"></i><span>Account Locked</span></>) : (<><i className="fas fa-sign-in-alt"></i><span>Sign in</span></>)}
            </button>
          </form>
        </div>
        {/* Footer */}
        <div className="login-footer">
          <p><i className="fas fa-copyright me-2"></i>© 2025 Scott Overhead Doors. All rights reserved.</p>
          <div className="footer-links">
            <small className="text-muted">Secure login system with advanced protection</small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;