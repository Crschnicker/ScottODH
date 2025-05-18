import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Alert } from 'react-bootstrap';
import { formatDateForInput } from '../../utils/dateHelpers';

/**
 * EstimateScheduleForm Component
 * 
 * Modal form for scheduling an estimate with a date, time, estimator, and notes
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.show - Controls visibility of the modal
 * @param {Function} props.onHide - Function called when the modal is closed
 * @param {Object} props.estimate - The estimate object being scheduled
 * @param {Function} props.onSchedule - Function called with form data when scheduling is confirmed
 * @param {Array} props.estimators - List of available estimators
 */
const EstimateScheduleForm = ({ 
  show, 
  onHide, 
  estimate, 
  onSchedule, 
  estimators = [
    { id: 1, name: 'Brett' }, 
    { id: 2, name: 'John' }, 
    { id: 3, name: 'Sarah' }
  ] 
}) => {
  // Form state
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [estimator, setEstimator] = useState(1); // Default to Brett (id: 1)
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState(60); // Duration in minutes
  const [error, setError] = useState('');
  
  // Initialize form with data if estimate already has scheduled info
  useEffect(() => {
    if (estimate && show) {
      // Check if estimate has scheduled_date property
      if (estimate.scheduled_date) {
        const scheduledDateTime = new Date(estimate.scheduled_date);
        setScheduleDate(formatDateForInput(scheduledDateTime));
        
        // Format time for input (12-hour format with AM/PM)
        const hours24 = scheduledDateTime.getHours();
        const isPM = hours24 >= 12;
        const hours12 = hours24 % 12 || 12; // Convert 0 to 12
        const minutes = scheduledDateTime.getMinutes().toString().padStart(2, '0');
        setScheduleTime(`${hours12}:${minutes} ${isPM ? 'PM' : 'AM'}`);
      } else {
        // Default to tomorrow at 10:00 AM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        
        setScheduleDate(formatDateForInput(tomorrow));
        setScheduleTime('10:00 AM');
      }
      
      // Set estimator if provided, otherwise default to Brett
      setEstimator(estimate.estimator_id || 1);
      
      // Set notes if provided
      setNotes(estimate.schedule_notes || '');
      
      // Set duration if provided
      setDuration(estimate.duration || 60);
    }
  }, [estimate, show]);
  
  /**
   * Handle form submission
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    // Validate form fields
    if (!scheduleDate || !scheduleTime) {
      setError('Please select both date and time for the estimate');
      return;
    }
    
    // Parse the date
    const [year, month, day] = scheduleDate.split('-').map(num => parseInt(num, 10));
    
    // Parse the time from 12-hour format to 24-hour
    const [timeOnly, period] = scheduleTime.split(' ');
    const [hours12, minutes] = timeOnly.split(':').map(num => parseInt(num, 10));
    
    // Convert to 24-hour format
    let hours24 = hours12;
    if (period === 'PM' && hours12 < 12) {
      hours24 += 12;
    } else if (period === 'AM' && hours12 === 12) {
      hours24 = 0;
    }
    
    const scheduledDateTime = new Date(year, month - 1, day, hours24, minutes);
    
    // Don't allow scheduling in the past
    if (scheduledDateTime < new Date()) {
      setError('Cannot schedule an estimate in the past');
      return;
    }
    
    // Prepare the schedule data
    const scheduleData = {
      estimate_id: estimate.id,
      scheduled_date: scheduledDateTime.toISOString(),
      estimator_id: parseInt(estimator, 10),
      estimator_name: estimators.find(e => e.id === parseInt(estimator, 10))?.name || 'Brett',
      schedule_notes: notes,
      duration: parseInt(duration, 10)
    };
    
    // Call the onSchedule callback with the schedule data
    onSchedule(scheduleData);
  };
  
  // Create time slot options (8:00 AM to 5:00 PM in 30-minute increments)
  const timeOptions = [];
  for (let hour = 8; hour <= 17; hour++) {
    const isPM = hour >= 12;
    const hour12 = hour % 12 || 12; // Convert 0 to 12 for display
    
    // Format for the hour (1, 2, ... 12)
    timeOptions.push(`${hour12}:00 ${isPM ? 'PM' : 'AM'}`);
    
    if (hour < 17) {
      timeOptions.push(`${hour12}:30 ${isPM ? 'PM' : 'AM'}`);
    }
  }
  
  return (
    <Modal show={show} onHide={onHide} backdrop="static" keyboard={false} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Schedule Estimate</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <p className="mb-3">
            <strong>Customer:</strong> {estimate?.customer_name || ''} <br />
            <strong>Address:</strong> {estimate?.site_address || ''}
            {estimate?.site_name && ` (${estimate.site_name})`}
          </p>
          
          <Row className="mb-3">
            <Col>
              <Form.Group controlId="scheduleDate">
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  required
                />
              </Form.Group>
            </Col>
            <Col>
              <Form.Group controlId="scheduleTime">
                <Form.Label>Time</Form.Label>
                <Form.Select
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  required
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
            <Col>
              <Form.Group controlId="estimator">
                <Form.Label>Estimator</Form.Label>
                <Form.Select
                  value={estimator}
                  onChange={(e) => setEstimator(e.target.value)}
                  required
                >
                  {estimators.map(est => (
                    <option key={est.id} value={est.id}>{est.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col>
              <Form.Group controlId="duration">
                <Form.Label>Duration</Form.Label>
                <Form.Select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
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
          
          <Form.Group controlId="notes">
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any special instructions or notes for this appointment"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Schedule Estimate
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default EstimateScheduleForm;