import React, { useState } from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { FaPlus } from 'react-icons/fa';
import EstimateList from '../components/estimates/EstimateList';
import EstimateForm from '../components/estimates/EstimateForm';

const Estimates = () => {
  const [showForm, setShowForm] = useState(false);
  
  const toggleForm = () => {
    setShowForm(!showForm);
  };
  
  const handleEstimateCreated = () => {
    // Automatically hide the form after estimate is created
    setShowForm(false);
  };
  
  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h2>Estimates</h2>
          <p>Create and manage estimates for Scott Overhead Doors.</p>
        </Col>
        <Col xs="auto">
          <Button 
            variant="primary" 
            onClick={toggleForm}
          >
            <FaPlus className="me-2" />
            {showForm ? 'Hide Form' : 'New Estimate'}
          </Button>
        </Col>
      </Row>
      
      {showForm && (
        <Row className="mb-4">
          <Col>
            <EstimateForm onEstimateCreated={handleEstimateCreated} />
          </Col>
        </Row>
      )}
      
      <Row>
        <Col>
          <Card>
            <Card.Header>Estimate List</Card.Header>
            <Card.Body>
              <EstimateList onCreateClick={() => setShowForm(true)} />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Estimates;
