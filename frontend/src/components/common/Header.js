import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar, Nav, Container, Button, Dropdown } from 'react-bootstrap';
import { 
  FaHome, 
  FaUsers, 
  FaClipboardList, 
  FaFileInvoiceDollar, 
  FaTools, 
  FaCalendar,
  FaUserCircle,
  FaBell,
  FaPlus,
  FaCog,
  FaSignOutAlt,
  FaFileAlt,
  FaClipboardCheck,
  FaChartLine
} from 'react-icons/fa';
import './Header.css';

/**
 * Enhanced Header component that replaces both the original Header and Sidebar
 * Provides comprehensive navigation in a user-friendly layout
 */
const Header = () => {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  
  // Helper function to determine if a nav item is active
  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };
  
  // Notification count - would be populated from a real notification system
  const notificationCount = 3;
  
  return (
    <header className="app-header">
      {/* Main navigation bar */}
      <Navbar 
        bg="dark" 
        variant="dark" 
        expand="lg" 
        className="main-navbar" 
        expanded={expanded}
        onToggle={setExpanded}
      >
        <Container fluid>
          {/* Company logo/brand */}
          <Navbar.Brand as={Link} to="/" className="brand">
            <span className="brand-icon">
              <FaHome />
            </span>
            <span className="brand-text">Scott Overhead Doors</span>
          </Navbar.Brand>
          
          {/* Navbar toggle button for mobile */}
          <Navbar.Toggle aria-controls="main-navbar-nav" />
          
          {/* Main navigation links */}
          <Navbar.Collapse id="main-navbar-nav">
            <Nav className="me-auto main-nav">
              <Nav.Link 
                as={Link} 
                to="/" 
                className={`nav-item ${isActive('/') ? 'active' : ''}`}
                onClick={() => setExpanded(false)}
              >
                <FaHome className="nav-icon" />
                <span>Dashboard</span>
              </Nav.Link>
              
              <Nav.Link 
                as={Link} 
                to="/customers" 
                className={`nav-item ${isActive('/customers') ? 'active' : ''}`}
                onClick={() => setExpanded(false)}
              >
                <FaUsers className="nav-icon" />
                <span>Customers</span>
              </Nav.Link>
              
              <Nav.Link 
                as={Link} 
                to="/estimates" 
                className={`nav-item ${isActive('/estimates') ? 'active' : ''}`}
                onClick={() => setExpanded(false)}
              >
                <FaClipboardList className="nav-icon" />
                <span>Estimates</span>
              </Nav.Link>
              
              <Nav.Link 
                as={Link} 
                to="/bids" 
                className={`nav-item ${isActive('/bids') ? 'active' : ''}`}
                onClick={() => setExpanded(false)}
              >
                <FaFileInvoiceDollar className="nav-icon" />
                <span>Bids</span>
              </Nav.Link>
              
              <Nav.Link 
                as={Link} 
                to="/jobs" 
                className={`nav-item ${isActive('/jobs') ? 'active' : ''}`}
                onClick={() => setExpanded(false)}
              >
                <FaTools className="nav-icon" />
                <span>Jobs</span>
              </Nav.Link>
              
              <Nav.Link 
                as={Link} 
                to="/schedule" 
                className={`nav-item ${isActive('/schedule') ? 'active' : ''}`}
                onClick={() => setExpanded(false)}
              >
                <FaCalendar className="nav-icon" />
                <span>Schedule</span>
              </Nav.Link>
            </Nav>
            
            {/* Right side of navbar - user controls */}
            <Nav className="user-controls">
              {/* Notifications */}
              <Dropdown className="notification-dropdown">
                <Dropdown.Toggle variant="link" id="dropdown-notifications">
                  <div className="icon-with-badge">
                    <FaBell className="nav-icon" />
                    {notificationCount > 0 && (
                      <span className="badge">{notificationCount}</span>
                    )}
                  </div>
                </Dropdown.Toggle>
                
                <Dropdown.Menu align="end" className="notification-menu">
                  <Dropdown.Header>Notifications</Dropdown.Header>
                  <Dropdown.Item className="notification-item unread">
                    <div className="notification-content">
                      <div className="notification-title">New estimate request</div>
                      <div className="notification-text">John Smith requested an estimate</div>
                      <div className="notification-time">10 minutes ago</div>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Item className="notification-item unread">
                    <div className="notification-content">
                      <div className="notification-title">Job completed</div>
                      <div className="notification-text">Job #125 was marked as completed</div>
                      <div className="notification-time">1 hour ago</div>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Item className="notification-item">
                    <div className="notification-content">
                      <div className="notification-title">Bid approved</div>
                      <div className="notification-text">Bid #87 was approved by supervisor</div>
                      <div className="notification-time">Yesterday</div>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item className="text-center">
                    <small>View All Notifications</small>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              
              {/* User profile dropdown */}
              <Dropdown className="user-dropdown">
                <Dropdown.Toggle variant="link" id="dropdown-user">
                  <FaUserCircle className="nav-icon" />
                  <span className="d-none d-md-inline">Admin</span>
                </Dropdown.Toggle>
                
                <Dropdown.Menu align="end">
                  <Dropdown.Item>
                    <FaUserCircle className="me-2" /> Profile
                  </Dropdown.Item>
                  <Dropdown.Item>
                    <FaCog className="me-2" /> Settings
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item>
                    <FaSignOutAlt className="me-2" /> Logout
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </header>
  );
};

export default Header;