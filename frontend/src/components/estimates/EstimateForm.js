import React, { useState } from 'react';
import { Card, Form, Button, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { FaArrowLeft, FaSave, FaCalendarAlt, FaClock, FaUser } from 'react-icons/fa';
import CustomerList from '../customers/CustomerList';
import { createEstimate } from '../../services/estimateService';
import { formatDateForInput } from '../../utils/DateHelpers';

/**
 * EstimateForm Component
 * 
 * A multi-step form for creating new estimates. First allows the user to select
 * a customer and site, then allows them to enter estimate details including scheduling.
 * 
 * @param {Function} onEstimateCreated - Callback for when an estimate is successfully created
 * @param {Function} onCancel - Callback for when the form is cancelled
 */
const EstimateForm = ({ onEstimateCreated, onCancel }) => {
  // Form state
  const [step, setStep] = useState(1); // 1: Select customer/site, 2: Estimate details
  const [formData, setFormData] = useState({
    customer_id: null,
    site_id: null,
    title: '',
    description: '',
    estimated_hours: '',
    estimated_cost: '',
    notes: '',
    // Scheduling fields
    schedule_date: formatDateForInput(getTomorrow()),
    schedule_time: '10:00 AM', // UPDATED: Default time in AM/PM format
    estimator_id: 1, // Default to Brett
    estimator_name: 'Brett', // Default to Brett
    duration: 60, // Default to 1 hour
    schedule_notes: ''
  });
  
  // List of available estimators
  const estimators = [
    { id: 1, name: 'Brett' }, // Brett is the default
  ];
  
  // Create time slot options (8:00 AM to 5:00 PM in 30-minute increments)
  const timeOptions = [];
  for (let h = 6; h <= 17; h++) { // Iterate through hours in 24-hour format (8 AM to 5 PM)
    for (let m = 0; m < 60; m += 30) { // Iterate 00 and 30 minutes
      if (h === 17 && m > 0) { // Stop at 5:00 PM, don't include 5:30 PM
        continue;
      }

      let displayHour = h % 12;
      if (displayHour === 0) { // For 12 AM (midnight) or 12 PM (noon)
        displayHour = 12;
      }
      const ampm = h < 12 ? 'AM' : 'PM'; // AM for hours 0-11, PM for 12-23

      const minuteFormatted = m.toString().padStart(2, '0');
      timeOptions.push(`${displayHour}:${minuteFormatted} ${ampm}`);
    }
  }
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [includeScheduling, setIncludeScheduling] = useState(true); // Default to include scheduling
  
  /**
   * Get tomorrow's date for default scheduling
   */
  function getTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0); // Default to 10:00 AM internally for the date object
    return tomorrow;
  }
  
  /**
   * Handle site selection from CustomerList component
   * @param {Object} customer - Selected customer object
   * @param {Object} site - Selected site object
   */
  const handleSiteSelected = (customer, site) => {
    setSelectedCustomer(customer);
    setSelectedSite(site);
    setFormData(prev => ({
      ...prev,
      customer_id: customer.id,
      site_id: site.id
    }));
    // Advance to next step after selection
    setStep(2);
  };
  
  /**
   * Handle form field changes
   * @param {Event} e - Change event
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for estimator selection
    if (name === 'estimator_id') {
      const selectedEstimator = estimators.find(est => est.id === parseInt(value, 10));
      setFormData(prev => ({
        ...prev,
        estimator_id: parseInt(value, 10),
        estimator_name: selectedEstimator ? selectedEstimator.name : 'Brett'
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  /**
   * Handle toggle for scheduling inclusion
   */
  const handleToggleScheduling = () => {
    setIncludeScheduling(!includeScheduling);
  };
  
/**
 * Handle form submission with improved error handling and validation
 * @param {Event} e - Submit event
 */
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError(null);
  
  try {
    // Validate form data
    if (!formData.customer_id || !formData.site_id) {
      throw new Error('Please select a customer and site.');
    }
    
    if (!formData.title || formData.title.trim().length === 0) {
      throw new Error('Estimate title is required.');
    }
    
    // Validate scheduling data if scheduling is included
    if (includeScheduling) {
      if (!formData.schedule_date || !formData.schedule_time) {
        throw new Error('Please select both date and time for scheduling.');
      }
      
      // Construct scheduled date
      const [year, month, day] = formData.schedule_date.split('-').map(num => parseInt(num, 10));
      
      // Parse AM/PM time string
      const timeString = formData.schedule_time; // e.g., "10:00 AM" or "2:30 PM"
      const timeParts = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i);

      if (!timeParts) {
        throw new Error('Invalid time format selected. Please re-select a valid time.');
      }

      let hours = parseInt(timeParts[1], 10);
      const minutes = parseInt(timeParts[2], 10);
      const ampm = timeParts[3].toUpperCase();

      if (ampm === 'PM' && hours < 12) {
        hours += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      }

      const scheduledDateTime = new Date(year, month - 1, day, hours, minutes);
      
      // Don't allow scheduling in the past
      const now = new Date();
      if (scheduledDateTime < now) {
        throw new Error('Cannot schedule an estimate in the past.');
      }
      
      // Prepare submission data with scheduling
      const submissionData = {
        ...formData,
        scheduled_date: scheduledDateTime.toISOString(),
        // Clean up any undefined fields
        estimated_hours: formData.estimated_hours || null,
        estimated_cost: formData.estimated_cost || null,
        description: formData.description || null,
        notes: formData.notes || null
      };
      
      console.log('[ESTIMATE FORM] Submitting with scheduling:', submissionData);
      
      // Send data to API with retry logic
      const result = await createEstimate(submissionData);
      
      console.log('[ESTIMATE FORM] Successfully created estimate:', result);
      
      // Notify parent component of success
      if (onEstimateCreated) {
        onEstimateCreated(result);
      }
    } else {
      // Prepare submission data without scheduling information
      const { 
        schedule_date, schedule_time, estimator_id, estimator_name, 
        duration, schedule_notes, ...submissionData 
      } = formData;
      
      // Clean up any undefined fields
      submissionData.estimated_hours = submissionData.estimated_hours || null;
      submissionData.estimated_cost = submissionData.estimated_cost || null;
      submissionData.description = submissionData.description || null;
      submissionData.notes = submissionData.notes || null;
      
      console.log('[ESTIMATE FORM] Submitting without scheduling:', submissionData);
      
      // Send data to API with retry logic
      const result = await createEstimate(submissionData);
      
      console.log('[ESTIMATE FORM] Successfully created estimate:', result);
      
      // Notify parent component of success
      if (onEstimateCreated) {
        onEstimateCreated(result);
      }
    }
  } catch (err) {
    console.error('[ESTIMATE FORM] Failed to create estimate:', err);
    
    // Extract the most relevant error message
    let errorMessage = 'Failed to create estimate. Please try again.';
    
    if (err.message) {
      errorMessage = err.message;
    } else if (err.originalError && err.originalError.message) {
      errorMessage = err.originalError.message;
    }
    
    // Add retry information if available
    if (err.retryCount !== undefined && err.retryCount > 0) {
      errorMessage += ` (Attempted ${err.retryCount + 1} times)`;
    }
    
    setError(errorMessage);
    
    // Scroll to top to show error message
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } finally {
    setLoading(false);
  }
};
  
  /**
   * Go back to customer selection step
   */
  const handleBackToSelection = () => {
    setStep(1);
  };
  
  /**
   * Cancel form
   */
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else if (onEstimateCreated) {
      // If no explicit cancel handler, use the creation handler
      onEstimateCreated(null);
    }
  };
  
  // Add some inline styles for elements that would have been styled by the CSS file
  const selectedInfoStyle = {
    backgroundColor: '#f8f9fa',
    borderRadius: '0.25rem',
    padding: '1rem',
    marginBottom: '1.5rem'
  };
  
  const schedulingSectionStyle = {
    backgroundColor: '#f0f7ff',
    borderRadius: '0.25rem',
    padding: '1rem',
    marginBottom: '1.5rem',
    borderLeft: '3px solid #0d6efd'
  };
  
  const labelStyle = {
    fontWeight: '600',
    color: '#6c757d',
    fontSize: '0.875rem'
  };
  
  const valueStyle = {
    fontSize: '1rem',
    fontWeight: '500'
  };
  
  // The rest of the component (JSX) remains the same as it correctly uses timeOptions.
  // No changes needed in the JSX part for this request.
  return (
    <Card className="shadow-sm">
      <Card.Header>
        <h5 className="mb-0">
          {step === 1 ? 'Select Customer & Site' : 'Create New Estimate'}
        </h5>
      </Card.Header>
      <Card.Body>
        {/* Step 1: Customer & Site Selection */}
        {step === 1 && (
          <>
            <p className="mb-3">Select a customer and site for this estimate:</p>
            <CustomerList 
              selectionMode={true} 
              onSelectSite={handleSiteSelected}
            />
          </>
        )}
        
        {/* Step 2: Estimate Details Form */}
        {step === 2 && (
          <>
            {/* Selected Customer & Site Display */}
            <div style={selectedInfoStyle}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">Selected Customer & Site</h6>
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={handleBackToSelection}
                >
                  <FaArrowLeft className="me-1" /> Change Selection
                </Button>
              </div>
              
              <Row className="mb-2">
                <Col md={6}>
                  <div style={labelStyle}>Customer:</div>
                  <div style={valueStyle}>{selectedCustomer?.name || 'N/A'}</div>
                </Col>
                <Col md={6}>
                  <div style={labelStyle}>Site:</div>
                  <div style={valueStyle}>{selectedSite?.name || 'N/A'}</div>
                  <div className="small text-muted">{selectedSite?.address || ''}</div>
                </Col>
              </Row>
            </div>
            
            {/* Estimate Form */}
            {error && (
              <Alert variant="danger" dismissible onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            
            <Form onSubmit={handleSubmit}>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label style={{fontWeight: '500'}}>Estimate Title *</Form.Label>
                    <Form.Control
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="e.g., Garage Door Replacement"
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label style={{fontWeight: '500'}}>Reference/Job Number</Form.Label>
                    <Form.Control
                      type="text"
                      name="reference_number"
                      value={formData.reference_number || ''}
                      onChange={handleChange}
                      placeholder="Optional reference number"
                    />
                  </Form.Group>
                </Col>
              </Row>
              
              <Form.Group className="mb-3">
                <Form.Label style={{fontWeight: '500'}}>Additional Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  placeholder="Detailed description of the work to be performed"
                />
              </Form.Group>

              
              {/* Scheduling Toggle */}
              <Form.Group className="mb-3">
                <Form.Check 
                  type="checkbox"
                  id="include-scheduling"
                  label="Schedule this estimate now"
                  checked={includeScheduling}
                  onChange={handleToggleScheduling}
                  className="user-select-none"
                />
              </Form.Group>
              
              {/* Scheduling Section */}
              {includeScheduling && (
                <div style={schedulingSectionStyle}>
                  <div className="d-flex align-items-center mb-3">
                    <FaCalendarAlt className="text-primary me-2" />
                    <h6 className="mb-0">Schedule Estimate Appointment</h6>
                  </div>
                  
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group controlId="scheduleDate">
                        <Form.Label className="d-flex align-items-center">
                          <FaCalendarAlt className="text-secondary me-1" size={14} /> 
                          Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          name="schedule_date"
                          value={formData.schedule_date}
                          onChange={handleChange}
                          required={includeScheduling}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group controlId="scheduleTime">
                        <Form.Label className="d-flex align-items-center">
                          <FaClock className="text-secondary me-1" size={14} /> 
                          Time
                        </Form.Label>
                        <Form.Select
                          name="schedule_time"
                          value={formData.schedule_time}
                          onChange={handleChange}
                          required={includeScheduling}
                        >
                          <option value="">Select time</option>
                          {timeOptions.map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group controlId="estimator">
                        <Form.Label className="d-flex align-items-center">
                          <FaUser className="text-secondary me-1" size={14} /> 
                          Estimator
                        </Form.Label>
                        <Form.Select
                          name="estimator_id"
                          value={formData.estimator_id}
                          onChange={handleChange}
                          required={includeScheduling}
                        >
                          {estimators.map(est => (
                            <option key={est.id} value={est.id}>{est.name}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group controlId="duration">
                        <Form.Label className="d-flex align-items-center">
                          <FaClock className="text-secondary me-1" size={14} /> 
                          Duration
                        </Form.Label>
                        <Form.Select
                          name="duration"
                          value={formData.duration}
                          onChange={handleChange}
                        >
                          <option value="30">30 minutes</option>
                          <option value="60">1 hour</option>
                          <option value="90">1.5 hours</option>
                          <option value="120">2 hours</option>
                          <option value="150">2.5 hours</option>
                          <option value="180">3 hours</option>
                          <option value="210">3.5 hours</option>
                          <option value="240">4 hours</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <Form.Group className="mb-0" controlId="scheduleNotes">
                    <Form.Label className="d-flex align-items-center">
                      Appointment Notes
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      name="schedule_notes"
                      value={formData.schedule_notes}
                      onChange={handleChange}
                      placeholder="Enter any special instructions for this appointment"
                    />
                  </Form.Group>
                </div>
              )}
            
              
              <div className="d-flex justify-content-end mt-4">
                <Button 
                  variant="outline-secondary" 
                  className="me-2" 
                  onClick={handleCancel}
                  disabled={loading}
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
                      Creating...
                    </>
                  ) : (
                    <>
                      <FaSave className="me-2" /> Create Estimate
                    </>
                  )}
                </Button>
              </div>
            </Form>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default EstimateForm;