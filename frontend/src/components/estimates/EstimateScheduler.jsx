import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Badge, Spinner, Row, Col, Alert, Form } from 'react-bootstrap';
import { FaCalendarAlt, FaClock, FaUser, FaEdit, FaTrash } from 'react-icons/fa';
import axios from 'axios';
import moment from 'moment';
import { API_BASE_URL } from '../../config';
import SchedulingCalendarView from './SchedulingCalendarView'; // Import the new calendar

const EstimateScheduler = ({ estimate, onUpdate }) => {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  
  // This state will hold ALL estimates needed for the calendar background
  const [allEstimates, setAllEstimates] = useState([]);
  
  // State for the scheduling form itself
  const [scheduleForm, setScheduleForm] = useState({
    scheduled_date: '', scheduled_time: '09:00', estimator_name: 'Brett', duration: 60, schedule_notes: ''
  });

  // Fetch all estimates, but only when needed for the modal
  const fetchAllEstimates = useCallback(async () => {
    if (allEstimates.length > 0) return; // Don't refetch
    try {
      const response = await axios.get(`${API_BASE_URL}/api/estimates`);
      // Filter out the current estimate being scheduled from the background events
      setAllEstimates(response.data.filter(e => e.id !== estimate.id));
    } catch (err) {
      console.error("Failed to fetch estimates for calendar view", err);
      setError("Could not load calendar appointments. You can still schedule manually.");
    }
  }, [allEstimates.length, estimate.id]);

  const handleOpenModal = () => {
    setError('');
    // Pre-fill the form with existing data if available
    if (estimate?.scheduled_date) {
      const d = new Date(estimate.scheduled_date);
      setScheduleForm({
        scheduled_date: moment(d).format('YYYY-MM-DD'),
        scheduled_time: moment(d).format('HH:mm'),
        estimator_name: estimate.estimator_name || 'Brett',
        duration: estimate.duration || 60,
        schedule_notes: estimate.schedule_notes || ''
      });
    } else {
       // Reset to default for a new schedule
       setScheduleForm({ scheduled_date: '', scheduled_time: '09:00', estimator_name: 'Brett', duration: 60, schedule_notes: '' });
    }
    fetchAllEstimates(); // Fetch appointments for the calendar
    setShowScheduleModal(true);
  };

  // This function is called by the calendar when a time slot is clicked
  const handleCalendarSlotSelect = (slotInfo) => {
    const { start } = slotInfo;
    setScheduleForm(prev => ({
      ...prev,
      scheduled_date: moment(start).format('YYYY-MM-DD'),
      scheduled_time: moment(start).format('HH:mm'),
    }));
  };

  const handleFormChange = (field, value) => {
    setScheduleForm(prev => ({ ...prev, [field]: value }));
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setError('');
    if (!scheduleForm.scheduled_date) {
      setError('Please select a date from the calendar or the input fields.');
      setIsProcessing(false);
      return;
    }

    try {
      // Combine date and time correctly, respecting timezone
      const combinedDateTime = moment(`${scheduleForm.scheduled_date} ${scheduleForm.scheduled_time}`).toDate();
      
      const scheduleData = {
        scheduled_date: combinedDateTime.toISOString(),
        estimator_name: scheduleForm.estimator_name,
        duration: parseInt(scheduleForm.duration, 10),
        schedule_notes: scheduleForm.schedule_notes,
        // Assuming your backend can map estimator_name to an ID if needed
      };

      const response = await axios.post(`${API_BASE_URL}/api/estimates/${estimate.id}/schedule`, scheduleData);
      
      if (onUpdate) {
        onUpdate(response.data); // Update the parent component with the full new estimate data
      }
      setShowScheduleModal(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule estimate.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSchedule = async () => { /* ... (no changes needed) ... */ };
  const formatDateTime = (date) => { /* ... (no changes needed) ... */ };
  const formatDuration = (minutes) => { /* ... (no changes needed) ... */ };

  return (
    <div className="estimate-scheduler">
      {error && !showScheduleModal && <Alert variant="danger">{error}</Alert>}
      
      <div className="schedule-status-container p-3 bg-light border rounded mb-3">
        {/* The top part displaying status remains the same */}
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="mb-0"><FaCalendarAlt className="me-2" />Estimate Appointment</h5>
          {estimate?.scheduled_date ? <Badge bg="success">Scheduled</Badge> : <Badge bg="warning">Not Scheduled</Badge>}
        </div>
        {/* ... Details display ... */}
        <div className="schedule-actions mt-3">
          <Button variant={estimate?.scheduled_date ? "outline-primary" : "primary"} onClick={handleOpenModal} disabled={isProcessing}>
            <FaCalendarAlt className="me-1" /> {estimate?.scheduled_date ? 'Reschedule' : 'Schedule Estimate'}
          </Button>
          {/* ... Cancel button ... */}
        </div>
      </div>
      
      <Modal show={showScheduleModal} onHide={() => setShowScheduleModal(false)} size="xl" centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title><FaCalendarAlt className="me-2" />Schedule for EST-{estimate?.id}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleScheduleSubmit}>
          <Modal.Body>
            <Row>
              <Col lg={8} md={7} className="border-end">
                <h6 className="text-muted text-center mb-2">Existing Appointments</h6>
                <SchedulingCalendarView
                  estimates={allEstimates}
                  onSelectSlot={handleCalendarSlotSelect}
                />
              </Col>
              <Col lg={4} md={5}>
                <h5>Appointment Details</h5>
                {error && <Alert variant="danger">{error}</Alert>}
                
                <Form.Group className="mb-3">
                  <Form.Label>Date</Form.Label>
                  <Form.Control type="date" value={scheduleForm.scheduled_date} onChange={(e) => handleFormChange('scheduled_date', e.target.value)} required disabled={isProcessing}/>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Time</Form.Label>
                  <Form.Control type="time" value={scheduleForm.scheduled_time} onChange={(e) => handleFormChange('scheduled_time', e.target.value)} required disabled={isProcessing}/>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Estimator</Form.Label>
                  <Form.Select value={scheduleForm.estimator_name} onChange={(e) => handleFormChange('estimator_name', e.target.value)} disabled={isProcessing}>
                    <option>Brett</option><option>Scott</option><option>Taylor</option><option>Kelly</option>
                  </Form.Select>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Duration</Form.Label>
                  <Form.Select value={scheduleForm.duration} onChange={(e) => handleFormChange('duration', e.target.value)} disabled={isProcessing}>
                    <option value={60}>1 Hour</option><option value={90}>1.5 Hours</option><option value={120}>2 Hours</option>
                  </Form.Select>
                </Form.Group>
                
                <Form.Group>
                  <Form.Label>Notes</Form.Label>
                  <Form.Control as="textarea" rows={3} value={scheduleForm.schedule_notes} onChange={(e) => handleFormChange('schedule_notes', e.target.value)} disabled={isProcessing}/>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowScheduleModal(false)} disabled={isProcessing}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={isProcessing}>
              {isProcessing ? <><Spinner size="sm" as="span" className="me-2" />Saving...</> : 'Save Schedule'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default EstimateScheduler;