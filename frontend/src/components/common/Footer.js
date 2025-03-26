import React from 'react';
import { Container } from 'react-bootstrap';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <Container>
        <p className="text-center mb-0">
          &copy; {currentYear} Scott Overhead Doors. All rights reserved.
        </p>
      </Container>
    </footer>
  );
};

export default Footer;
