import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { createCustomer, updateCustomer } from '../../services/customerService';
import './CustomerForm.css';

/**
 * CustomerForm Component
 * 
 * Form for creating or editing customer information with validation
 * and error handling.
 * 
 * @param {Object} customer - Existing customer data (for edit mode)
 * @param {Function} onSave - Callback function called after successful save
 * @param {Function} onCancel - Callback function for cancel button
 */
const CustomerForm = ({ customer, onSave, onCancel }) => {
  const isEditMode = !!customer;
  
  // Initialize form state
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: ''
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validated, setValidated] = useState(false);
  
  // Load customer data if in edit mode
  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        contact_name: customer.contact_name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || ''
      });
    }
  }, [customer]);
  
  /**
   * Handle form field changes
   * @param {Event} e - Change event
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Reset validation state when user types
    if (validated) setValidated(false);
  };
  
  /**
   * Handle form submission
   * @param {Event} e - Submit event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Form validation
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      e.stopPropagation();
      setValidated(true);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      let result;
      
      if (isEditMode) {
        // Update existing customer
        result = await updateCustomer(customer.id, formData);
      } else {
        // Create new customer
        result = await createCustomer(formData);
      }
      
      // Call the onSave callback with the saved customer
      if (onSave) {
        onSave(result);
      }
    } catch (err) {
      console.error('Failed to save customer:', err);
      setError(
        err.response?.data?.error || 
        err.message || 
        'An error occurred while saving customer data. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="shadow-sm customer-form-card">
      <Card.Header>
        <h5 className="mb-0">{isEditMode ? 'Edit Customer' : 'Add New Customer'}</h5>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        <Form noValidate validated={validated} onSubmit={handleSubmit}>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Customer Name*</Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter customer name"
                  required
                  autoFocus
                />
                <Form.Control.Feedback type="invalid">
                  Customer name is required.
                </Form.Control.Feedback>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Contact Name</Form.Label>
                <Form.Control
                  type="text"
                  name="contact_name"
                  value={formData.contact_name}
                  onChange={handleChange}
                  placeholder="Primary contact person"
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Phone</Form.Label>
                <Form.Control
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Contact phone number"
                />
              </Form.Group>
            </Col>
            
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Contact email address"
                />
                <Form.Control.Feedback type="invalid">
                  Please enter a valid email address.
                </Form.Control.Feedback>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Billing Address</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Full billing address"
                />
              </Form.Group>
            </Col>
          </Row>
          
          <div className="d-flex justify-content-end mt-4">
            <Button 
              variant="outline-secondary" 
              className="me-2" 
              onClick={onCancel}
              disabled={loading}
              type="button"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-2" />
                  {isEditMode ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>{isEditMode ? 'Update Customer' : 'Save Customer'}</>
              )}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default CustomerForm;