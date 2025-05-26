import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Header.css';

/**
 * Enhanced Header component with integrated authentication support
 * Maintains existing design while adding secure user management features
 * Responsive design with mobile-first approach
 */
const Header = ({ 
  currentUser, 
  onLogout, 
  onShowPasswordModal, 
  isAuthenticated = false 
}) => {
  const location = useLocation();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  /**
   * Navigation items configuration with role-based access control
   * Dynamically shows/hides items based on user permissions
   */
  const getNavigationItems = () => {
    const baseNavItems = [
      { path: '/', label: 'Dashboard', icon: 'fas fa-tachometer-alt' },
      { path: '/customers', label: 'Customers', icon: 'fas fa-users' },
      { path: '/estimates', label: 'Estimates', icon: 'fas fa-file-alt' },
      { path: '/bids', label: 'Bids', icon: 'fas fa-dollar-sign' },
      { path: '/jobs', label: 'Jobs', icon: 'fas fa-wrench' },
      { path: '/schedule', label: 'Schedule', icon: 'fas fa-calendar-alt' }
    ];

    // Add admin-only navigation items
    if (currentUser?.role === 'admin') {
      baseNavItems.push({
        path: '/users',
        label: 'User Management',
        icon: 'fas fa-user-cog',
        adminOnly: true
      });
    }

    return baseNavItems;
  };

  /**
   * Check if current route matches navigation item
   * Supports exact matching and nested route detection
   */
  const isActiveRoute = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  /**
   * Handle user dropdown toggle with click outside handling
   */
  const toggleUserDropdown = () => {
    setShowUserDropdown(!showUserDropdown);
  };

  /**
   * Handle mobile menu toggle
   */
  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  /**
   * Handle user logout with confirmation and cleanup
   */
  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      setShowUserDropdown(false);
      setShowMobileMenu(false);
      await onLogout();
    }
  };

  /**
   * Handle password change modal opening
   */
  const handlePasswordChange = () => {
    setShowUserDropdown(false);
    onShowPasswordModal();
  };

  /**
   * Handle click outside dropdown to close it
   */
  const handleClickOutside = (event) => {
    if (!event.target.closest('.user-dropdown-container')) {
      setShowUserDropdown(false);
    }
  };

  // Add click outside listener
  React.useEffect(() => {
    if (showUserDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showUserDropdown]);

  const navigationItems = getNavigationItems();

  return (
    <header className="header-container">
      <div className="header-content">
        {/* Logo and Company Name - MODIFIED: Logo div removed */}
        <div className="header-brand">
          <Link to="/" className="brand-link">
            {/* The brand-logo div was here and has been removed */}
            <div className="brand-text">
              <h1 className="brand-title">Scott Overhead Doors</h1>
              <span className="brand-subtitle">Professional Door Solutions</span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="desktop-navigation">
          <ul className="nav-list">
            {navigationItems.map((item) => (
              <li key={item.path} className="nav-item">
                <Link
                  to={item.path}
                  className={`nav-link ${isActiveRoute(item.path) ? 'active' : ''} ${
                    item.adminOnly ? 'admin-only' : ''
                  }`}
                  title={item.adminOnly ? 'Admin Only' : item.label}
                >
                  <i className={`${item.icon} nav-icon`}></i>
                  <span className="nav-text">{item.label}</span>
                  {item.adminOnly && (
                    <span className="admin-badge">
                      <i className="fas fa-crown"></i>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Profile Section */}
        {isAuthenticated && currentUser && (
          <div className="user-section">
            {/* User Info Display */}
            <div className="user-info-display">
              <span className="user-welcome">Welcome back,</span>
              <span className="user-name">{currentUser.first_name}</span>
              <span className="user-role-badge">
                {currentUser.role === 'admin' ? (
                  <>
                    <i className="fas fa-user-shield"></i>
                    Admin
                  </>
                ) : (
                  <>
                    <i className="fas fa-hard-hat"></i>
                    Field Tech
                  </>
                )}
              </span>
            </div>

            {/* User Dropdown */}
            <div className="user-dropdown-container">
              <button
                className="user-dropdown-trigger"
                onClick={toggleUserDropdown}
                aria-expanded={showUserDropdown}
                aria-haspopup="true"
              >
                <div className="user-avatar">
                  <span className="user-initials">
                    {currentUser.first_name?.[0]}{currentUser.last_name?.[0]}
                  </span>
                  <div className="user-status-indicator"></div>
                </div>
                <div className="user-details">
                  <span className="user-display-name">{currentUser.full_name}</span>
                  <span className="user-email">{currentUser.email}</span>
                </div>
                <i className={`fas fa-chevron-down dropdown-arrow ${showUserDropdown ? 'rotated' : ''}`}></i>
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && (
                <div className="user-dropdown-menu">
                  <div className="dropdown-header">
                    <div className="dropdown-user-info">
                      <div className="dropdown-avatar">
                        <span className="user-initials">
                          {currentUser.first_name?.[0]}{currentUser.last_name?.[0]}
                        </span>
                      </div>
                      <div className="dropdown-user-details">
                        <div className="dropdown-user-name">{currentUser.full_name}</div>
                        <div className="dropdown-user-email">{currentUser.email}</div>
                        <div className="dropdown-user-role">
                          {currentUser.role === 'admin' ? 'Office Administrator' : 'Field Technician'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="dropdown-divider"></div>

                  <div className="dropdown-section">
                    <button
                      className="dropdown-item"
                      onClick={handlePasswordChange}
                    >
                      <i className="fas fa-key item-icon"></i>
                      <span className="item-text">Change Password</span>
                      <span className="item-description">Update your account security</span>
                    </button>

                    <Link
                      to="/"
                      className="dropdown-item"
                      onClick={() => setShowUserDropdown(false)}
                    >
                      <i className="fas fa-tachometer-alt item-icon"></i>
                      <span className="item-text">Dashboard</span>
                      <span className="item-description">Go to main dashboard</span>
                    </Link>

                    {currentUser.role === 'admin' && (
                      <Link
                        to="/users"
                        className="dropdown-item admin-item"
                        onClick={() => setShowUserDropdown(false)}
                      >
                        <i className="fas fa-users-cog item-icon"></i>
                        <span className="item-text">Manage Users</span>
                        <span className="item-description">User administration</span>
                        <i className="fas fa-crown admin-indicator"></i>
                      </Link>
                    )}
                  </div>

                  <div className="dropdown-divider"></div>

                  <div className="dropdown-section">
                    <button
                      className="dropdown-item logout-item"
                      onClick={handleLogout}
                    >
                      <i className="fas fa-sign-out-alt item-icon"></i>
                      <span className="item-text">Sign Out</span>
                      <span className="item-description">Secure logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile Menu Toggle */}
        <button
          className="mobile-menu-toggle"
          onClick={toggleMobileMenu}
          aria-expanded={showMobileMenu}
          aria-label="Toggle mobile menu"
        >
          <div className={`hamburger ${showMobileMenu ? 'active' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
      </div>

      {/* Mobile Navigation Menu */}
      {showMobileMenu && (
        <div className="mobile-navigation">
          <div className="mobile-nav-content">
            {/* Mobile User Info */}
            {isAuthenticated && currentUser && (
              <div className="mobile-user-section">
                <div className="mobile-user-info">
                  <div className="mobile-user-avatar">
                    <span className="user-initials">
                      {currentUser.first_name?.[0]}{currentUser.last_name?.[0]}
                    </span>
                  </div>
                  <div className="mobile-user-details">
                    <div className="mobile-user-name">{currentUser.full_name}</div>
                    <div className="mobile-user-role">
                      {currentUser.role === 'admin' ? 'Administrator' : 'Field Technician'}
                    </div>
                  </div>
                </div>
                <div className="mobile-user-actions">
                  <button
                    className="mobile-action-button"
                    onClick={handlePasswordChange}
                    title="Change Password"
                  >
                    <i className="fas fa-key"></i>
                  </button>
                  <button
                    className="mobile-action-button logout"
                    onClick={handleLogout}
                    title="Sign Out"
                  >
                    <i className="fas fa-sign-out-alt"></i>
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Navigation Items */}
            <nav className="mobile-nav-list">
              {navigationItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`mobile-nav-item ${isActiveRoute(item.path) ? 'active' : ''} ${
                    item.adminOnly ? 'admin-only' : ''
                  }`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  <div className="mobile-nav-icon">
                    <i className={item.icon}></i>
                    {item.adminOnly && (
                      <span className="mobile-admin-indicator">
                        <i className="fas fa-crown"></i>
                      </span>
                    )}
                  </div>
                  <div className="mobile-nav-content"> {/* This was named .mobile-nav-content, ensuring correct nesting from original CSS */}
                    <span className="mobile-nav-label">{item.label}</span>
                    {item.adminOnly && (
                      <span className="mobile-nav-description">Admin Only</span>
                    )}
                  </div>
                  <div className="mobile-nav-arrow">
                    <i className="fas fa-chevron-right"></i>
                  </div>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div 
          className="mobile-menu-overlay"
          onClick={() => setShowMobileMenu(false)}
        ></div>
      )}
    </header>
  );
};

export default Header;