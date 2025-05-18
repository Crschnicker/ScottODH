import React, { useState } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { FaPlus } from 'react-icons/fa';
import EstimateList from '../components/estimates/EstimateList';
import EstimateForm from '../components/estimates/EstimateForm';

/**
 * Estimates Page Component
 * 
 * Main page for managing estimates. Displays a list of existing estimates and
 * provides an interface to create new ones.
 */
const Estimates = () => {
  // State for UI control
  const [showForm, setShowForm] = useState(false);
  const [refreshListTrigger, setRefreshListTrigger] = useState(0);
  
  /**
   * Handle estimate creation completion
   * Called when a new estimate has been created or the form is cancelled
   */
  const handleEstimateCreated = () => {
    setShowForm(false); // Hide the form after estimate is created
    setRefreshListTrigger(prev => prev + 1); // Trigger a refresh of the EstimateList
  };
  
  return (
    <Container fluid>
      <Row className="mb-4 align-items-center">
        <Col>
          <h2>Estimates</h2>
          <p className="mb-0">Create and manage estimates for Scott Overhead Doors.</p>
        </Col>
        <Col xs="auto">
          <Button 
            variant="primary" 
            onClick={() => setShowForm(prev => !prev)}
          >
            {showForm ? 'Cancel' : <><FaPlus className="me-2" /> New Estimate</>}
          </Button>
        </Col>
      </Row>
      
      {showForm ? (
        <Row className="mb-4">
          <Col>
            <EstimateForm 
              onEstimateCreated={handleEstimateCreated} 
              onCancel={() => setShowForm(false)}
            />
          </Col>
        </Row>
      ) : (
        <Row>
          <Col>
            <Card>
              <Card.Header>
                <div className="d-flex justify-content-between align-items-center">
                  <span>Estimate List</span>
                  <Button 
                    variant="outline-primary" 
                    size="sm"
                    onClick={() => setShowForm(true)}
                  >
                    <FaPlus className="me-1" /> Create New
                  </Button>
                </div>
              </Card.Header>
              <Card.Body>
                <EstimateList 
                  refreshTrigger={refreshListTrigger} 
                  onCreateClick={() => setShowForm(true)}
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default Estimates;