import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, Alert, Spinner } from 'react-bootstrap';
import './SiteForm.css';

/**
 * SiteForm Component
 * 
 * Form for creating or editing site information with validation
 * and error handling.
 * 
 * @param {Object} customer - Customer object this site belongs to
 * @param {Object} site - Existing site data (for edit mode)
 * @param {string} mode - 'add' or 'edit' mode
 * @param {Function} onSave - Callback function called after successful save
 * @param {Function} onCancel - Callback function for cancel button
 * @param {boolean} isSaving - Loading state from parent
 * @param {string} error - Error message from parent
 */
const SiteForm = ({ customer, site, mode, onSave, onCancel, isSaving = false, error = null }) => {
  const isEditMode = mode === 'edit' && !!site;
  
  // Initialize form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lockbox_location: '',
    contact_name: '',
    phone: '',
    email: ''
  });
  
  // UI state
  const [localError, setLocalError] = useState(null);
  const [validated, setValidated] = useState(false);
  
  // Load site data if in edit mode
  useEffect(() => {
    if (isEditMode && site) {
      setFormData({
        name: site.name || '',
        address: site.address || '',
        lockbox_location: site.lockbox_location || '',
        contact_name: site.contact_name || '',
        phone: site.phone || '',
        email: site.email || ''
      });
    } else {
      // Reset form for add mode
      setFormData({
        name: '',
        address: '',
        lockbox_location: '',
        contact_name: '',
        phone: '',
        email: ''
      });
    }
  }, [isEditMode, site, mode]);
  
  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    if (!isEditMode) {
      setFormData({
        name: '',
        address: '',
        lockbox_location: '',
        contact_name: '',
        phone: '',
        email: ''
      });
    }
    setValidated(false);
    setLocalError(null);
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
    if (localError) setLocalError(null);
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
      errors.name = 'Site name is required.';
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
    
    // Clear previous local errors
    setLocalError(null);
    
    // Custom validation
    const validation = validateForm();
    
    if (!validation.isValid) {
      setValidated(true);
      
      // Set specific error if needed
      const errorMessages = Object.values(validation.errors);
      if (errorMessages.length > 0) {
        setLocalError(errorMessages.join(' '));
      }
      return;
    }
    
    // Prepare data for submission (trim all string fields)
    const submitData = {
      name: formData.name.trim(),
      address: formData.address.trim(),
      lockbox_location: formData.lockbox_location.trim(),
      contact_name: formData.contact_name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim()
    };
    
    // Ensure required field is not empty after trimming
    if (!submitData.name) {
      setLocalError('Site name cannot be empty.');
      setValidated(true);
      return;
    }
    
    try {
      // Call the parent's save function
      if (onSave) {
        await onSave(submitData);
      }
      
      // Reset form state on successful save (for add mode)
      if (!isEditMode) {
        resetForm();
      }
      
    } catch (err) {
      console.error('Failed to save site:', err);
      
      // Handle different types of errors
      let errorMessage;
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.status === 409) {
        errorMessage = 'A site with this name already exists for this customer.';
      } else if (err.response?.status === 400) {
        errorMessage = 'Please check your input and try again.';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      } else {
        errorMessage = 'An unexpected error occurred. Please try again.';
      }
      
      setLocalError(errorMessage);
      setValidated(true);
    }
  };
  
  /**
   * Handle cancel button click
   */
  const handleCancel = () => {
    resetForm();
    if (onCancel) {
      onCancel();
    }
  };
  
  // Use error from parent or local error, prioritizing parent error
  const displayError = error || localError;
  
  return (
    <div className="site-form">
      {displayError && (
        <Alert variant="danger" dismissible onClose={() => { setLocalError(null); }}>
          <strong>Error:</strong> {displayError}
        </Alert>
      )}
      
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Site Name*</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter site name (e.g., Main Office, Warehouse A)"
                required
                autoFocus
                disabled={isSaving}
                isInvalid={validated && !formData.name.trim()}
              />
              <Form.Control.Feedback type="invalid">
                Site name is required.
              </Form.Control.Feedback>
              <Form.Text className="text-muted">
                A descriptive name to identify this location
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Contact Name</Form.Label>
              <Form.Control
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleChange}
                placeholder="Site contact person"
                disabled={isSaving}
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Phone</Form.Label>
              <Form.Control
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Site phone number"
                disabled={isSaving}
              />
            </Form.Group>
          </Col>
          
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Address</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Full site address"
                disabled={isSaving}
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Site contact email"
                disabled={isSaving}
                isInvalid={validated && formData.email.trim() && !isValidEmail(formData.email)}
              />
              <Form.Control.Feedback type="invalid">
                Please enter a valid email address.
              </Form.Control.Feedback>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Lockbox Location</Form.Label>
              <Form.Control
                type="text"
                name="lockbox_location"
                value={formData.lockbox_location}
                onChange={handleChange}
                placeholder="Where to find keys/access (e.g., front door, gate)"
                disabled={isSaving}
              />
              <Form.Text className="text-muted">
                Instructions for accessing the site
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>
        
        {customer && (
          <div className="mb-3 p-2 bg-light rounded">
            <small className="text-muted">
              <strong>Customer:</strong> {customer.name}
            </small>
          </div>
        )}
        
        <div className="d-flex justify-content-end mt-4">
          <Button 
            variant="outline-secondary" 
            className="me-2" 
            onClick={handleCancel}
            disabled={isSaving}
            type="button"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="primary" 
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                {isEditMode ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>{isEditMode ? 'Update Site' : 'Save Site'}</>
            )}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default SiteForm;