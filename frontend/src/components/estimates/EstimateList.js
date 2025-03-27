import React, { useState, useEffect } from 'react';
import { Table, Button, Badge, Form, InputGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaSearch, FaPlus, FaMicrophone } from 'react-icons/fa';
import { getEstimates } from '../../services/estimateService';
import './EstimateList.css';

const EstimateList = ({ onCreateClick, onSelectEstimate }) => {
  const [estimates, setEstimates] = useState([]);
  const [filteredEstimates, setFilteredEstimates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadEstimates();
  }, []);
  
  
  useEffect(() => {
    if (searchTerm) {
      const filtered = estimates.filter(estimate => 
        estimate.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEstimates(filtered);
    } else {
      // Only show estimates with 'pending' status
      const pendingEstimates = estimates.filter(estimate => estimate.status === 'pending');
      setFilteredEstimates(pendingEstimates);
    }
  }, [searchTerm, estimates]);

  const loadEstimates = async () => {
    try {
      const data = await getEstimates();
      setEstimates(data);
    
      // Only show pending estimates by default
      const pendingEstimates = data.filter(estimate => estimate.status === 'pending');
      setFilteredEstimates(pendingEstimates);
    } catch (error) {
      console.error('Error loading estimates:', error);
    } finally {
      setLoading(false);
    }
  }
  
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return <Badge bg="warning">Pending</Badge>;
      case 'approved':
        return <Badge bg="success">Approved</Badge>;
      case 'rejected':
        return <Badge bg="danger">Rejected</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };
  
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  if (loading) {
    return <div>Loading estimates...</div>;
  }
  
  return (
    <div className="estimate-list-container">
      <div className="estimate-list-header">
        <h2>Estimates</h2>
        <div className="estimate-list-actions">
          <InputGroup className="search-input">
            <InputGroup.Text>
              <FaSearch />
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search by customer name..."
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
          ) : 'create a new estimate'}
        </p>
      ) : (
        <Table striped hover responsive className="estimate-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Date Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEstimates.map(estimate => (
              <tr key={estimate.id}>
                <td>EST-{estimate.id}</td>
                <td>{estimate.customer_name}</td>
                <td>{formatDate(estimate.created_at)}</td>
                <td>{getStatusBadge(estimate.status)}</td>
                <td>
                  {onSelectEstimate ? (
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={() => onSelectEstimate(estimate)}
                      className="me-2"
                    >
                      Select
                    </Button>
                  ) : null}
                  
                  <Link to={`/estimates/${estimate.id}/progress`} className="me-2">
                    <Button 
                      variant="outline-info" 
                      size="sm"
                    >
                      <FaMicrophone /> Record
                    </Button>
                  </Link>
                  
                  <Link to={`/bids?estimateId=${estimate.id}`}>
                    <Button 
                      variant="outline-success" 
                      size="sm"
                    >
                      Create Bid
                    </Button>
                  </Link>
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