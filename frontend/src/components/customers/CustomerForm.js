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
  const [success, setSuccess] = useState(false);
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
   * Reset form to initial state
   */
  const resetForm = () => {
    if (!isEditMode) {
      setFormData({
        name: '',
        contact_name: '',
        phone: '',
        email: '',
        address: ''
      });
    }
    setValidated(false);
    setError(null);
    setSuccess(false);
  };
  
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
    
    // Reset validation and error states when user types
    if (validated) setValidated(false);
    if (error) setError(null);
    if (success) setSuccess(false);
  };
  
  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} - True if valid or empty, false if invalid
   */
  const isValidEmail = (email) => {
    if (!email.trim()) return true; // Empty email is valid (optional field)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };
  
  /**
   * Validate form data
   * @returns {Object} - Validation result with isValid boolean and errors object
   */
  const validateForm = () => {
    const errors = {};
    const trimmedData = {
      name: formData.name.trim(),
      email: formData.email.trim()
    };
    
    // Required field validation
    if (!trimmedData.name) {
      errors.name = 'Customer name is required.';
    }
    
    // Email format validation (only if email is provided)
    if (trimmedData.email && !isValidEmail(trimmedData.email)) {
      errors.email = 'Please enter a valid email address.';
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };
  
  /**
   * Handle form submission
   * @param {Event} e - Submit event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear previous states
    setError(null);
    setSuccess(false);
    
    // Custom validation
    const validation = validateForm();
    
    if (!validation.isValid) {
      setValidated(true);
      
      // Set specific error if needed
      const errorMessages = Object.values(validation.errors);
      if (errorMessages.length > 0) {
        setError(errorMessages.join(' '));
      }
      return;
    }
    
    // Prepare data for submission (trim all string fields)
    const submitData = {
      name: formData.name.trim(),
      contact_name: formData.contact_name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: formData.address.trim()
    };
    
    setLoading(true);
    
    try {
      let result;
      
      if (isEditMode) {
        // Update existing customer
        result = await updateCustomer(customer.id, submitData);
      } else {
        // Create new customer
        result = await createCustomer(submitData);
      }
      
      // Show success state
      setSuccess(true);
      setValidated(false); // Reset validation state
      
      // Reset form if creating new customer
      if (!isEditMode) {
        setTimeout(() => {
          resetForm();
        }, 1500);
      }
      
      // Call the onSave callback with the saved customer
      if (onSave) {
        setTimeout(() => {
          onSave(result);
        }, 500);
      }
      
    } catch (err) {
      console.error('Failed to save customer:', err);
      
      // Handle different types of errors
      let errorMessage;
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.status === 400) {
        errorMessage = 'Please check your input and try again.';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      } else {
        errorMessage = 'An unexpected error occurred. Please try again.';
      }
      
      setError(errorMessage);
      setValidated(true);
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
            <strong>Error:</strong> {error}
          </Alert>
        )}
        
        {success && (
          <Alert variant="success" dismissible onClose={() => setSuccess(false)}>
            <strong>Success!</strong> Customer {isEditMode ? 'updated' : 'created'} successfully.
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
                  isInvalid={validated && !formData.name.trim()}
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
                  isInvalid={validated && formData.email.trim() && !isValidEmail(formData.email)}
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
              onClick={() => {
                resetForm();
                if (onCancel) onCancel();
              }}
              disabled={loading}
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
                  {isEditMode ? 'Updating...' : 'Creating...'}
                </>
              ) : success ? (
                <>{isEditMode ? 'Updated!' : 'Created!'}</>
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