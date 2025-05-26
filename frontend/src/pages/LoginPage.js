import React, { useState, useEffect } from 'react';
import './LoginPage.css'; // We'll create this CSS file

const LoginPage = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(false);

  // Check if user is already logged in on component mount
  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        onLoginSuccess(userData);
      }
    } catch (error) {
      // User not logged in, which is fine
      console.log('No current user session');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        // Store user preference for remember me
        if (remember) {
          localStorage.setItem('rememberLogin', 'true');
        }
        
        // Call the success callback with user data
        onLoginSuccess(data.user);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        {/* Header */}
        <div className="login-header">
          <div className="login-logo">
            <div className="logo-icon">
              <i className="icon-login"></i>
            </div>
          </div>
          <h2 className="login-title">Welcome Back</h2>
          <p className="login-subtitle">Sign in to Scott Overhead Doors</p>
        </div>

        {/* Login Form */}
        <div className="login-card">
          <form className="login-form" onSubmit={handleSubmit}>
            {/* Username Field */}
            <div className="form-group">
              <label htmlFor="username" className="form-label">Username</label>
              <div className="input-group">
                <div className="input-icon">
                  <i className="icon-user"></i>
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Enter your username"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <div className="input-group">
                <div className="input-icon">
                  <i className="icon-lock"></i>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={togglePasswordVisibility}
                  disabled={isLoading}
                >
                  <i className={showPassword ? 'icon-eye-off' : 'icon-eye'}></i>
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="form-options">
              <div className="checkbox-group">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="form-checkbox"
                  disabled={isLoading}
                />
                <label htmlFor="remember-me" className="checkbox-label">
                  Remember me
                </label>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="error-message">
                <i className="icon-alert"></i>
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !formData.username || !formData.password}
              className={`login-button ${isLoading ? 'loading' : ''}`}
            >
              {isLoading ? (
                <>
                  <div className="spinner"></div>
                  Signing in...
                </>
              ) : (
                <>
                  <i className="icon-login-arrow"></i>
                  Sign in
                </>
              )}
            </button>
          </form>

          {/* Default Credentials Info */}
          <div className="credentials-info">
            <h4 className="credentials-title">Default Login Credentials:</h4>
            <div className="credentials-content">
              <div className="credentials-section">
                <div className="credentials-type">Office Admin Accounts:</div>
                <div className="credentials-list">taylor / taylor • kelly / kelly • scott / scott • brett / brett</div>
              </div>
              <div className="credentials-section">
                <div className="credentials-type">Field Accounts:</div>
                <div className="credentials-list">tech1 / tech1 • tech2 / tech2 • tech3 / tech3</div>
              </div>
              <div className="credentials-note">
                Please change your password after first login
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>© 2025 Scott Overhead Doors. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;