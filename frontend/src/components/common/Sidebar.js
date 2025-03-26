import React from 'react';
import { Link } from 'react-router-dom';
import { Nav } from 'react-bootstrap';
import { FaHome, FaUsers, FaClipboardList, FaFileInvoiceDollar, FaTools, FaCalendar } from 'react-icons/fa';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <Nav className="flex-column">
        <Nav.Link as={Link} to="/" className="sidebar-link">
          <FaHome className="sidebar-icon" /> Dashboard
        </Nav.Link>
        <Nav.Link as={Link} to="/customers" className="sidebar-link">
          <FaUsers className="sidebar-icon" /> Customers
        </Nav.Link>
        <Nav.Link as={Link} to="/estimates" className="sidebar-link">
          <FaClipboardList className="sidebar-icon" /> Estimates
        </Nav.Link>
        <Nav.Link as={Link} to="/bids" className="sidebar-link">
          <FaFileInvoiceDollar className="sidebar-icon" /> Bids
        </Nav.Link>
        <Nav.Link as={Link} to="/jobs" className="sidebar-link">
          <FaTools className="sidebar-icon" /> Jobs
        </Nav.Link>
        <Nav.Link as={Link} to="/schedule" className="sidebar-link">
          <FaCalendar className="sidebar-icon" /> Schedule
        </Nav.Link>
      </Nav>
    </div>
  );
};

export default Sidebar;
