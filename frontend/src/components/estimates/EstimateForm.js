import React, { useState } from 'react';
import { Form, Button, Row, Col, Card } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { createEstimate } from '../../services/estimateService';
import CustomerList from '../customers/CustomerList';
import CustomerForm from '../customers/CustomerForm';

const EstimateForm = ({ onEstimateCreated }) => {
  const [formData, setFormData] = useState({
    customer_id: null,
    customer_name: '',
    address: '',
    lockbox_location: '',
    contact_name: '',
    phone: ''
  });
  
  const [showExistingCustomers, setShowExistingCustomers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const toggleCustomerSource = () => {
    setShowExistingCustomers(!showExistingCustomers);
  };
  
  const handleSelectCustomer = (customer) => {
    setFormData({
      ...formData,
      customer_id: customer.id,
      customer_name: customer.name,
      address: customer.address || '',
      lockbox_location: customer.lockbox_location || '',
      contact_name: customer.contact_name || '',
      phone: customer.phone || ''
    });
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleCustomerCreated = (customer) => {
    handleSelectCustomer(customer);
    setShowExistingCustomers(true);
    toast.success('Customer created and selected');
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.customer_id && !formData.customer_name) {
      toast.error('Please select or create a customer');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const newEstimate = await createEstimate(formData);
      toast.success('Estimate created successfully');
      
      // Reset form
      setFormData({
        customer_id: null,
        customer_name: '',
        address: '',
        lockbox_location: '',
        contact_name: '',
        phone: ''
      });
      
      if (onEstimateCreated) {
        onEstimateCreated(newEstimate);
      }
    } catch (error) {
      toast.error('Error creating estimate');
      console.error('Error creating estimate:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card>
      <Card.Header>
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">New Estimate</h4>
          <Button 
            variant="outline-primary"
            onClick={toggleCustomerSource}
          >
            {showExistingCustomers ? 'Create New Customer' : 'Select Existing Customer'}
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        {showExistingCustomers ? (
          <>
            <h5>Select a Customer</h5>
            <CustomerList 
              onSelectCustomer={handleSelectCustomer} 
              onAddNewClick={toggleCustomerSource}
            />
          </>
        ) : (
          <CustomerForm onCustomerCreated={handleCustomerCreated} />
        )}
        
        {formData.customer_id || formData.customer_name ? (
          <Form onSubmit={handleSubmit} className="mt-4">
            <Card>
              <Card.Header>Selected Customer</Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <p><strong>Name:</strong> {formData.customer_name}</p>
                    <p><strong>Address:</strong> {formData.address || 'N/A'}</p>
                    <p><strong>Lockbox Location:</strong> {formData.lockbox_location || 'N/A'}</p>
                  </Col>
                  <Col md={6}>
                    <p><strong>Contact:</strong> {formData.contact_name || 'N/A'}</p>
                    <p><strong>Phone:</strong> {formData.phone || 'N/A'}</p>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
            
            <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-3">
              <Button 
                variant="secondary" 
                onClick={() => setFormData({
                  customer_id: null,
                  customer_name: '',
                  address: '',
                  lockbox_location: '',
                  contact_name: '',
                  phone: ''
                })}
                className="me-md-2"
              >
                Clear Selection
              </Button>
              <Button 
                variant="primary" 
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Estimate'}
              </Button>
            </div>
          </Form>
        ) : null}
      </Card.Body>
    </Card>
  );
};

export default EstimateForm;
