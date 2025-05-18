import React from 'react';
import { Container } from 'react-bootstrap';
import './Footer.css';

/**
 * Modern footer component with improved styling and responsive behavior
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <Container>
        <div className="footer-content">
          <p className="copyright">
            &copy; {currentYear} Scott Overhead Doors. All rights reserved.
          </p>
          <div className="footer-links">
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
            <a href="#contact">Contact Us</a>
          </div>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;