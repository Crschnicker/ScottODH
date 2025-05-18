import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { createSite, updateSite } from '../../services/customerService';

/**
 * SiteForm Component
 * 
 * Form for creating or editing customer sites
 * 
 * @param {Object} customer - The customer this site belongs to
 * @param {Object} site - Existing site data (for edit mode)
 * @param {string} mode - 'add' or 'edit'
 * @param {Function} onSave - Callback when site is saved
 * @param {Function} onCancel - Callback when form is cancelled
 * @param {boolean} isSaving - Optional flag to indicate save in progress
 * @param {string} error - Optional error message to display
 */
const SiteForm = ({ 
  customer, 
  site = null, 
  mode = 'add', 
  onSave, 
  onCancel,
  isSaving = false,
  error = null
}) => {
  // Site form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lockbox_location: '',
    contact_name: '',
    phone: '',
    email: ''
  });
  
  // UI state
  const [formError, setFormError] = useState(error);
  const [saving, setSaving] = useState(isSaving);
  const [validated, setValidated] = useState(false);
  
  // Load site data if in edit mode
  useEffect(() => {
    if (site && mode === 'edit') {
      setFormData({
        name: site.name || '',
        address: site.address || '',
        lockbox_location: site.lockbox_location || '',
        contact_name: site.contact_name || '',
        phone: site.phone || '',
        email: site.email || ''
      });
    }
  }, [site, mode]);
  
  // Update error from props
  useEffect(() => {
    setFormError(error);
  }, [error]);
  
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
    
    // Clear validation state on change
    if (validated) {
      setValidated(false);
    }
    
    // Clear error on change
    if (formError) {
      setFormError(null);
    }
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
    
    // Handle saving locally if not using external state
    if (!isSaving) {
      setSaving(true);
    }
    
    setFormError(null);
    
    try {
      let savedSite;
      
      if (mode === 'edit' && site) {
        // Update existing site
        savedSite = await updateSite(site.id, formData);
      } else {
        // Create new site
        if (!customer || !customer.id) {
          throw new Error('Customer information is missing.');
        }
        
        savedSite = await createSite(customer.id, formData);
      }
      
      // Call the onSave callback with the result
      if (onSave) {
        onSave(savedSite);
      }
    } catch (err) {
      console.error('Failed to save site:', err);
      setFormError(
        err.response?.data?.error || 
        err.message || 
        'Failed to save site. Please check your inputs and try again.'
      );
    } finally {
      // Only update local saving state if not using external state
      if (!isSaving) {
        setSaving(false);
      }
    }
  };
  
  return (
    <Form noValidate validated={validated} onSubmit={handleSubmit}>
      {formError && (
        <Alert variant="danger" dismissible onClose={() => setFormError(null)}>
          {formError}
        </Alert>
      )}
      
      <Form.Group className="mb-3">
        <Form.Label>Site Name*</Form.Label>
        <Form.Control
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter site name"
          required
          autoFocus
        />
        <Form.Control.Feedback type="invalid">
          Site name is required.
        </Form.Control.Feedback>
      </Form.Group>
      
      <Form.Group className="mb-3">
        <Form.Label>Site Address</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="Physical address of the site"
        />
      </Form.Group>
      
      <Form.Group className="mb-3">
        <Form.Label>Lockbox Location</Form.Label>
        <Form.Control
          type="text"
          name="lockbox_location"
          value={formData.lockbox_location}
          onChange={handleChange}
          placeholder="Where to find the lockbox (if applicable)"
        />
      </Form.Group>
      
      <Row>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Contact Name</Form.Label>
            <Form.Control
              type="text"
              name="contact_name"
              value={formData.contact_name}
              onChange={handleChange}
              placeholder="Primary site contact"
            />
          </Form.Group>
        </Col>
        <Col md={6}>
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
      </Row>
      
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
      
      <div className="d-flex justify-content-end mt-3">
        <Button
          variant="outline-secondary"
          className="me-2"
          onClick={onCancel}
          disabled={saving || isSaving}
          type="button"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={saving || isSaving}
        >
          {(saving || isSaving) ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-2" />
              {mode === 'edit' ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>{mode === 'edit' ? 'Update Site' : 'Create Site'}</>
          )}
        </Button>
      </div>
    </Form>
  );
};

export default SiteForm;