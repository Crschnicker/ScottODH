import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { createCustomer, updateCustomer } from '../../services/customerService';
import './CustomerForm.css';

/**
 * CustomerForm Component
 * 
 * Form for creating or editing customer information with validation
 * and error handling. It is self-contained and manages its own state.
 * 
 * @param {Object} customer - Optional: Existing customer data (for edit mode)
 * @param {Function} onSave - Callback function called with the saved customer object after a successful save.
 * @param {Function} onCancel - Callback function for the cancel button.
 */
const CustomerForm = ({ customer, onSave, onCancel }) => {
  const isEditMode = !!customer;
  
  // Form data state
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
  const [success, setSuccess] = useState(false);
  const [validated, setValidated] = useState(false);
  
  // Load customer data if in edit mode
  useEffect(() => {
    if (isEditMode) {
      setFormData({
        name: customer.name || '',
        contact_name: customer.contact_name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || ''
      });
    }
  }, [customer, isEditMode]);
  
  /**
   * Handle form field changes
   * @param {Event} e - Change event
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
    if (success) setSuccess(false);
  };
  
  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} - True if valid or empty, false if invalid
   */
  const isValidEmail = (email) => {
    if (!email.trim()) return true; // Empty email is considered valid (optional field)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };
  
  /**
   * Handle form submission
   * @param {Event} e - Submit event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setError(null);
    setSuccess(false);
    
    const form = e.currentTarget;
    if (form.checkValidity() === false || !isValidEmail(formData.email)) {
      setValidated(true);
      return;
    }
    
    // Prepare data for submission (trim all string fields)
    const submitData = Object.keys(formData).reduce((acc, key) => {
        acc[key] = typeof formData[key] === 'string' ? formData[key].trim() : formData[key];
        return acc;
    }, {});
    
    setLoading(true);
    
    try {
      let result;
      
      if (isEditMode) {
        result = await updateCustomer(customer.id, submitData);
      } else {
        result = await createCustomer(submitData);
      }
      
      setSuccess(true);
      
      // Call the onSave callback with the saved customer object
      if (onSave) {
        // Use a short timeout to allow the success message to be visible before the modal closes
        setTimeout(() => {
          onSave(result);
        }, 800);
      }
      
    } catch (err) {
      console.error('Failed to save customer:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'An unexpected error occurred. Please try again.';
      setError(errorMessage);
    } finally {
      // Don't set loading to false immediately if successful, to show the success state on the button
      if (!success) {
        setLoading(false);
      }
    }
  };
  
  return (
    <Card className="shadow-sm customer-form-card border-0">
      {/* The header is now in the parent modal, so we remove it from here */}
      <Card.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            <strong>Error:</strong> {error}
          </Alert>
        )}
        
        {success && (
          <Alert variant="success">
            <strong>Success!</strong> Customer has been {isEditMode ? 'updated' : 'saved'}.
          </Alert>
        )}
        
        <Form noValidate validated={validated} onSubmit={handleSubmit}>
          <Row>
            <Col md={12}>
              <Form.Group className="mb-3" controlId="customerName">
                <Form.Label>Customer Name*</Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter customer's business or full name"
                  required
                  autoFocus
                  disabled={loading || success}
                  isInvalid={validated && !formData.name.trim()}
                />
                <Form.Control.Feedback type="invalid">
                  Customer name is required.
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3" controlId="contactName">
                <Form.Label>Contact Name</Form.Label>
                <Form.Control
                  type="text"
                  name="contact_name"
                  value={formData.contact_name}
                  onChange={handleChange}
                  placeholder="Primary contact person"
                  disabled={loading || success}
                />
              </Form.Group>
              
              <Form.Group className="mb-3" controlId="phone">
                <Form.Label>Phone</Form.Label>
                <Form.Control
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Contact phone number"
                  disabled={loading || success}
                />
              </Form.Group>
            </Col>
            
            <Col md={6}>
              <Form.Group className="mb-3" controlId="email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Contact email address"
                  disabled={loading || success}
                  isInvalid={validated && formData.email.trim() && !isValidEmail(formData.email)}
                />
                <Form.Control.Feedback type="invalid">
                  Please enter a valid email address.
                </Form.Control.Feedback>
              </Form.Group>
              
              <Form.Group className="mb-3" controlId="address">
                <Form.Label>Billing Address</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Full billing address"
                  disabled={loading || success}
                />
              </Form.Group>
            </Col>
          </Row>
          
          <div className="d-flex justify-content-end mt-3">
            <Button 
              variant="outline-secondary" 
              className="me-2" 
              onClick={onCancel}
              disabled={loading || success}
              type="button"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              disabled={loading || success}
            >
              {loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-2" />
                  Saving...
                </>
              ) : success ? (
                isEditMode ? 'Updated!' : 'Saved!'
              ) : (
                isEditMode ? 'Update Customer' : 'Save Customer'
              )}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default CustomerForm;