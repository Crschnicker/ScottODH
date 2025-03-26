import React, { useState } from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { FaUserPlus } from 'react-icons/fa';
import CustomerList from '../components/customers/CustomerList';
import CustomerForm from '../components/customers/CustomerForm';

const Customers = () => {
  const [showForm, setShowForm] = useState(false);
  
  const toggleForm = () => {
    setShowForm(!showForm);
  };
  
  const handleCustomerCreated = () => {
    // Automatically hide the form after customer is created
    setShowForm(false);
  };
  
  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h2>Customers</h2>
          <p>Manage customer information for Scott Overhead Doors.</p>
        </Col>
        <Col xs="auto">
          <Button 
            variant="primary" 
            onClick={toggleForm}
          >
            <FaUserPlus className="me-2" />
            {showForm ? 'Hide Form' : 'Add New Customer'}
          </Button>
        </Col>
      </Row>
      
      {showForm && (
        <Row className="mb-4">
          <Col>
            <CustomerForm onCustomerCreated={handleCustomerCreated} />
          </Col>
        </Row>
      )}
      
      <Row>
        <Col>
          <Card>
            <Card.Header>Customer List</Card.Header>
            <Card.Body>
              <CustomerList onAddNewClick={() => setShowForm(true)} />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Customers;
