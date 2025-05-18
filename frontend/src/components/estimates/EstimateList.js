import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Badge, Form, InputGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaSearch, FaPlus, FaEye, FaCalendarAlt, FaUserClock } from 'react-icons/fa';
import { getEstimates } from '../../services/estimateService';

/**
 * EstimateList Component
 * 
 * Displays a list of estimates with filtering capabilities and actions
 * Shows scheduled dates for estimates
 * 
 * @param {Function} onCreateClick - Callback for when "Create New" button is clicked
 * @param {Function} onSelectEstimate - Optional callback for when an estimate is selected (for selection mode)
 * @param {number} refreshTrigger - Value that changes to trigger a refresh of the list
 */
const EstimateList = ({ onCreateClick, onSelectEstimate, refreshTrigger }) => {
  const [estimates, setEstimates] = useState([]);
  const [filteredEstimates, setFilteredEstimates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  /**
   * Load estimates from the API
   */
  const loadEstimates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEstimates();
      setEstimates(data);
      // Default filter is applied in the useEffect below
    } catch (error) {
      console.error('Error loading estimates:', error);
      // Potentially set an error state here to display to user
    } finally {
      setLoading(false);
    }
  }, []);

  // Load estimates when component mounts or refreshTrigger changes
  useEffect(() => {
    loadEstimates();
  }, [loadEstimates, refreshTrigger]);
  
  // Filter estimates based on search term
  useEffect(() => {
    let currentEstimates = estimates;
    if (searchTerm) {
      currentEstimates = estimates.filter(estimate => 
        (estimate.customer_name && estimate.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (estimate.site_address && estimate.site_address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (estimate.site_name && estimate.site_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (`EST-${estimate.id}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
        // Also search by estimator name if scheduled
        (estimate.estimator_name && estimate.estimator_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } else {
      // Only show estimates with 'pending' or 'converted' status if no search term
      currentEstimates = estimates.filter(estimate => estimate.status === 'pending' || estimate.status === 'converted');
    }
    setFilteredEstimates(currentEstimates);
  }, [searchTerm, estimates]);

  /**
   * Handle search input changes
   */
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  /**
   * Get the appropriate badge for an estimate status
   */
  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return <Badge bg="warning">Pending</Badge>;
      case 'approved':
        return <Badge bg="success">Approved</Badge>;
      case 'rejected':
        return <Badge bg="danger">Rejected</Badge>;
      case 'converted':
        return <Badge bg="info">Converted to Bid</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };
  
  /**
   * Format a date string for display (date only)
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  /**
   * Format a date string for display with time
   */
  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not scheduled';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    
    const formattedDate = date.toLocaleDateString(undefined, dateOptions);
    const formattedTime = date.toLocaleTimeString(undefined, timeOptions);
    
    return `${formattedDate}, ${formattedTime}`;
  };
  
  /**
   * Render scheduled date information with estimator
   */
  const renderScheduledInfo = (estimate) => {
    if (!estimate.scheduled_date) {
      return <span className="text-muted">Not scheduled</span>;
    }
    
    return (
      <div>
        <div className="d-flex align-items-center">
          <FaCalendarAlt className="text-primary me-1" />
          <span>{formatDateTime(estimate.scheduled_date)}</span>
        </div>
        <div className="d-flex align-items-center mt-1 text-muted small">
          <FaUserClock className="me-1" />
          <span>Estimator: {estimate.estimator_name || 'Brett'}</span>
        </div>
      </div>
    );
  };
  
  if (loading) {
    return <div>Loading estimates...</div>;
  }
  
  return (
    <div className="estimate-list-container">
      <div className="estimate-list-header">
        <div className="estimate-list-actions w-100">
          <InputGroup className="search-input me-2">
            <InputGroup.Text>
              <FaSearch />
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search by ID, Customer, Site, Estimator..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </InputGroup>
          {onCreateClick && (
            <Button 
              variant="primary" 
              className="add-estimate-btn"
              onClick={onCreateClick}
            >
              <FaPlus /> New Estimate
            </Button>
          )}
        </div>
      </div>
      
      {filteredEstimates.length === 0 ? (
        <p>No estimates found. {searchTerm && 'Try a different search term or '} 
          {onCreateClick ? (
            <Button 
              variant="link" 
              className="p-0" 
              onClick={onCreateClick}
            >
              create a new estimate
            </Button>
          ) : 'create a new estimate.'}
        </p>
      ) : (
        <Table striped hover responsive className="estimate-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Site Address / Name</th>
              <th>Date Created</th>
              <th>Scheduled Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEstimates.map(estimate => (
              <tr key={estimate.id}>
                <td>EST-{estimate.id}</td>
                <td>{estimate.customer_name}</td>
                <td>{estimate.site_name ? `${estimate.site_name} (${estimate.site_address || 'N/A'})` : (estimate.site_address || 'N/A')}</td>
                <td>{formatDate(estimate.created_at)}</td>
                <td>{renderScheduledInfo(estimate)}</td>
                <td>{getStatusBadge(estimate.status)}</td>
                <td>
                  {onSelectEstimate ? (
                    // Selection mode - used when selecting an estimate from another page
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={() => onSelectEstimate(estimate)}
                      className="me-2"
                    >
                      Select
                    </Button>
                  ) : (
                    // Regular view - link to view the estimate details
                    <Link to={`/estimates/${estimate.id}/progress`}>
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        className="me-2"
                      >
                        <FaEye className="me-1" /> View
                      </Button>
                    </Link>
                  )}
                  
                  {/* Only show "View Bid" for converted estimates */}
                  {estimate.status === 'converted' && (
                    <Link to={`/bids?estimateId=${estimate.id}`}>
                      <Button 
                        variant="outline-info" 
                        size="sm"
                      >
                        View Bid
                      </Button>
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default EstimateList;