import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Badge, Form, InputGroup, Modal, Row, Col, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {FaEye, FaCalendarAlt } from 'react-icons/fa';
import { getEstimates } from '../../services/estimateService';

/**
 * EstimateList Component
 * 
 * Displays a list of pending estimates with filtering and scheduling capabilities.
 * 
 * @param {Function} onSelectEstimate - Optional callback for when an estimate is selected (for selection mode)
 * @param {number} refreshTrigger - Value that changes to trigger a refresh of the list
 */
const EstimateList = ({ onSelectEstimate, refreshTrigger }) => {
  const [estimates, setEstimates] = useState([]);
  const [filteredEstimates, setFilteredEstimates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Scheduling modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    scheduled_date: '',
    scheduled_time: '09:00',
    estimator_name: 'Brett',
    estimator_id: 1,
    duration: 60,
    schedule_notes: ''
  });
  const [schedulingError, setSchedulingError] = useState('');
  const [schedulingSuccess, setSchedulingSuccess] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  const loadEstimates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEstimates();
      setEstimates(data);
    } catch (error) {
      console.error('Error loading estimates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates, refreshTrigger]);
  
  useEffect(() => {
    let currentEstimates = estimates.filter(estimate => estimate.status === 'pending');
    
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      currentEstimates = currentEstimates.filter(estimate => 
          (estimate.customer_name && estimate.customer_name.toLowerCase().includes(lowercasedTerm)) ||
          (estimate.site_address && estimate.site_address.toLowerCase().includes(lowercasedTerm)) ||
          (estimate.site_name && estimate.site_name.toLowerCase().includes(lowercasedTerm)) ||
          (`EST-${estimate.id}`.toLowerCase().includes(lowercasedTerm)) ||
          (estimate.estimator_name && estimate.estimator_name.toLowerCase().includes(lowercasedTerm))
      );
    }
    
    setFilteredEstimates(currentEstimates);
  }, [searchTerm, estimates]);

  const handleScheduleClick = (estimate) => {
    setSelectedEstimate(estimate);
    if (estimate.scheduled_date) {
      const scheduledDate = new Date(estimate.scheduled_date);
      setScheduleForm({
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        scheduled_time: scheduledDate.toTimeString().slice(0, 5),
        estimator_name: estimate.estimator_name || 'Brett',
        estimator_id: estimate.estimator_id || 1,
        duration: estimate.duration || 60,
        schedule_notes: estimate.schedule_notes || ''
      });
    } else {
      setScheduleForm({
        scheduled_date: '', scheduled_time: '09:00', estimator_name: 'Brett', estimator_id: 1, duration: 60, schedule_notes: ''
      });
    }
    setSchedulingError('');
    setSchedulingSuccess('');
    setShowScheduleModal(true);
  };

  const handleScheduleFormChange = (field, value) => {
    setScheduleForm(prev => ({...prev, [field]: value}));
  };

  // --- THIS IS THE CORRECTED FUNCTION ---
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setIsScheduling(true);
    setSchedulingError('');
    setSchedulingSuccess('');

    if (!scheduleForm.scheduled_date || !scheduleForm.scheduled_time) {
      setSchedulingError('Please select a date and time');
      setIsScheduling(false);
      return;
    }

    try {
      // FIX: Combine date and time strings to create a local time Date object.
      // This correctly interprets "2023-11-20" and "09:00" as 9 AM in the user's browser timezone.
      const localDateTimeString = `${scheduleForm.scheduled_date}T${scheduleForm.scheduled_time}:00`;
      const scheduledDateTime = new Date(localDateTimeString);

      // Check if the created date is valid.
      if (isNaN(scheduledDateTime.getTime())) {
          throw new Error('Invalid date or time selected.');
      }
      
      const requestData = {
        // .toISOString() will now correctly convert the user's local time to a UTC string for the server.
        scheduled_date: scheduledDateTime.toISOString(),
        estimator_name: scheduleForm.estimator_name,
        estimator_id: scheduleForm.estimator_id,
        duration: parseInt(scheduleForm.duration),
        schedule_notes: scheduleForm.schedule_notes
      };

      const response = await fetch(`/api/estimates/${selectedEstimate.id}/schedule`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to schedule the estimate.');
      }
      
      const updatedEstimate = await response.json();
      setEstimates(prev => prev.map(est => est.id === selectedEstimate.id ? updatedEstimate : est));
      setSchedulingSuccess('Estimate scheduled successfully!');
      setTimeout(() => setShowScheduleModal(false), 1500);

    } catch (error) {
      setSchedulingError(error.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleUnschedule = async () => {
    setIsScheduling(true);
    setSchedulingError('');
    setSchedulingSuccess('');
    try {
      const response = await fetch(`/api/estimates/${selectedEstimate.id}/unschedule`, { method: 'POST' });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to unschedule');

      const updatedEstimate = await response.json();
      setEstimates(prev => prev.map(est => est.id === selectedEstimate.id ? { ...updatedEstimate, scheduled_date: null } : est));
      setSchedulingSuccess('Estimate unscheduled successfully!');
      setTimeout(() => setShowScheduleModal(false), 1500);
    } catch (error) {
      setSchedulingError(error.message);
    } finally {
      setIsScheduling(false);
    }
  };
  
  // Helper functions for formatting
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
      if (!dateString) return { date: 'N/A', time: '' };
      const date = new Date(dateString);
      return {
          date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      };
  };

  const renderScheduledInfo = (estimate) => {
    if (estimate.scheduled_date) {
        const { date, time } = formatDateTime(estimate.scheduled_date);
        return (
            <Badge bg="success" className="d-flex align-items-center p-2 text-start">
                <FaCalendarAlt className="me-2 flex-shrink-0" />
                <div style={{ lineHeight: '1.2' }}>
                    <div>{date}</div>
                    <small>{time} ({estimate.estimator_name})</small>
                </div>
            </Badge>
        );
    }
    return <Badge bg="secondary">Not Scheduled</Badge>;
  };

  const getMinDate = () => new Date().toISOString().split('T')[0];
  
  if (loading) return <div>Loading estimates...</div>;
  
  return (
    <div className="estimate-list-container">
      <div className="w-100 mb-3">
        <InputGroup>
          <Form.Control
            type="text"
            placeholder="Search by ID, Customer, Site, Estimator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>
      </div>
      
      {filteredEstimates.length === 0 ? (
        <p>No pending estimates found.</p>
      ) : (
        <Table striped hover responsive>
          <thead>
            <tr>
              <th>ID</th><th>Customer</th><th>Site</th><th>Date Created</th><th>Scheduled Date</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEstimates.map(estimate => (
              <tr key={estimate.id}>
                <td>EST-{estimate.id}</td>
                <td>{estimate.customer_name}</td>
                <td>{estimate.site_name || estimate.site_address}</td>
                <td>{formatDate(estimate.created_at)}</td>
                <td>{renderScheduledInfo(estimate)}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Link to={`/estimates/${estimate.id}/progress`}>
                      <Button variant="outline-primary" size="sm"><FaEye /> View</Button>
                    </Link>
                    <Button
                      variant={estimate.scheduled_date ? "outline-secondary" : "outline-success"}
                      size="sm"
                      onClick={() => handleScheduleClick(estimate)}
                    >
                      <FaCalendarAlt className="me-1" />
                      {estimate.scheduled_date ? "Reschedule" : "Schedule"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={showScheduleModal} onHide={() => setShowScheduleModal(false)} size="lg" centered>
        <Modal.Header closeButton>
            <Modal.Title>
                {selectedEstimate?.scheduled_date ? 'Reschedule' : 'Schedule'} Estimate EST-{selectedEstimate?.id}
            </Modal.Title>
        </Modal.Header>
        <Modal.Body>
            {schedulingError && <Alert variant="danger">{schedulingError}</Alert>}
            {schedulingSuccess && <Alert variant="success">{schedulingSuccess}</Alert>}

            <Form onSubmit={handleScheduleSubmit}>
                <Row>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label>Date</Form.Label>
                            <Form.Control 
                                type="date"
                                value={scheduleForm.scheduled_date}
                                onChange={(e) => handleScheduleFormChange('scheduled_date', e.target.value)}
                                min={getMinDate()}
                                required
                            />
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label>Time</Form.Label>
                            <Form.Control
                                type="time"
                                value={scheduleForm.scheduled_time}
                                onChange={(e) => handleScheduleFormChange('scheduled_time', e.target.value)}
                                required
                            />
                        </Form.Group>
                    </Col>
                </Row>
                <Row>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label>Estimator</Form.Label>
                            <Form.Control
                                type="text"
                                value={scheduleForm.estimator_name}
                                onChange={(e) => handleScheduleFormChange('estimator_name', e.target.value)}
                            />
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label>Duration (minutes)</Form.Label>
                            <Form.Control
                                type="number"
                                value={scheduleForm.duration}
                                onChange={(e) => handleScheduleFormChange('duration', e.target.value)}
                            />
                        </Form.Group>
                    </Col>
                </Row>
                <Form.Group>
                    <Form.Label>Scheduling Notes</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        value={scheduleForm.schedule_notes}
                        onChange={(e) => handleScheduleFormChange('schedule_notes', e.target.value)}
                    />
                </Form.Group>

                <div className="d-flex justify-content-between mt-4">
                    <div>
                        {selectedEstimate?.scheduled_date && (
                            <Button variant="outline-danger" onClick={handleUnschedule} disabled={isScheduling}>
                                Unschedule
                            </Button>
                        )}
                    </div>
                    <div>
                        <Button variant="secondary" onClick={() => setShowScheduleModal(false)} className="me-2" disabled={isScheduling}>
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit" disabled={isScheduling}>
                            {isScheduling ? 'Saving...' : (selectedEstimate?.scheduled_date ? 'Update Schedule' : 'Schedule Estimate')}
                        </Button>
                    </div>
                </div>
            </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default EstimateList;