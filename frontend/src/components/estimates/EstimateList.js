import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Badge, Form, InputGroup, Modal, Row, Col, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaSearch, FaPlus, FaEye, FaCalendarAlt, FaUserClock, FaClock } from 'react-icons/fa';
import { getEstimates } from '../../services/estimateService';

/**
 * EstimateList Component
 * 
 * Displays a list of pending estimates (not converted to bids) with filtering capabilities
 * Shows scheduled dates for estimates and provides scheduling functionality
 * 
 * @param {Function} onSelectEstimate - Optional callback for when an estimate is selected (for selection mode)
 * @param {number} refreshTrigger - Value that changes to trigger a refresh of the list
 */
const EstimateList = ({ onCreateClick, onSelectEstimate, refreshTrigger }) => {
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

  /**
   * Load estimates from the API
   */
  const loadEstimates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEstimates();
      setEstimates(data);
      // Default filter is applied in the useEffect below
    } catch (error) {
      console.error('Error loading estimates:', error);
      // Potentially set an error state here to display to user
    } finally {
      setLoading(false);
    }
  }, []);

  // Load estimates when component mounts or refreshTrigger changes
  useEffect(() => {
    loadEstimates();
  }, [loadEstimates, refreshTrigger]);
  
  // Filter estimates based on search term - only show pending estimates that haven't been converted
  useEffect(() => {
    let currentEstimates = estimates;
    
    if (searchTerm) {
      // When searching, filter by search term but still only show pending estimates
      currentEstimates = estimates.filter(estimate => 
        estimate.status === 'pending' && (
          (estimate.customer_name && estimate.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (estimate.site_address && estimate.site_address.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (estimate.site_name && estimate.site_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (`EST-${estimate.id}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
          // Also search by estimator name if scheduled
          (estimate.estimator_name && estimate.estimator_name.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      );
    } else {
      // Only show estimates with 'pending' status (not converted to bids)
      currentEstimates = estimates.filter(estimate => estimate.status === 'pending');
    }
    
    setFilteredEstimates(currentEstimates);
  }, [searchTerm, estimates]);

  /**
   * Handle search input changes
   */
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  /**
   * Open the scheduling modal for a specific estimate
   */
  const handleScheduleClick = (estimate) => {
    setSelectedEstimate(estimate);
    
    // Pre-fill form with existing data if estimate is already scheduled
    if (estimate.scheduled_date) {
      const scheduledDate = new Date(estimate.scheduled_date);
      const dateStr = scheduledDate.toISOString().split('T')[0];
      const timeStr = scheduledDate.toTimeString().slice(0, 5);
      
      setScheduleForm({
        scheduled_date: dateStr,
        scheduled_time: timeStr,
        estimator_name: estimate.estimator_name || 'Brett',
        estimator_id: estimate.estimator_id || 1,
        duration: estimate.duration || 60,
        schedule_notes: estimate.schedule_notes || ''
      });
    } else {
      // Reset form for new scheduling
      setScheduleForm({
        scheduled_date: '',
        scheduled_time: '09:00',
        estimator_name: 'Brett',
        estimator_id: 1,
        duration: 60,
        schedule_notes: ''
      });
    }
    
    setSchedulingError('');
    setSchedulingSuccess('');
    setShowScheduleModal(true);
  };

  /**
   * Handle form input changes for scheduling
   */
  const handleScheduleFormChange = (field, value) => {
    setScheduleForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  /**
   * Submit the scheduling form
   */
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setIsScheduling(true);
    setSchedulingError('');
    setSchedulingSuccess('');

    if (!scheduleForm.scheduled_date) {
      setSchedulingError('Please select a date');
      setIsScheduling(false);
      return;
    }

    try {
      // Combine date and time into ISO format
      const [hours, minutes] = scheduleForm.scheduled_time.split(':');
      const scheduledDateTime = new Date(scheduleForm.scheduled_date);
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const requestData = {
        scheduled_date: scheduledDateTime.toISOString(),
        hour: parseInt(hours),
        minute: parseInt(minutes),
        estimator_name: scheduleForm.estimator_name,
        estimator_id: scheduleForm.estimator_id,
        duration: parseInt(scheduleForm.duration),
        schedule_notes: scheduleForm.schedule_notes
      };

      const response = await fetch(`/api/estimates/${selectedEstimate.id}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to schedule estimate');
      }

      const updatedEstimate = await response.json();
      
      // Update the estimates list with the new data
      setEstimates(prev => 
        prev.map(est => 
          est.id === selectedEstimate.id ? updatedEstimate : est
        )
      );

      setSchedulingSuccess('Estimate scheduled successfully!');
      
      // Close modal after a short delay
      setTimeout(() => {
        setShowScheduleModal(false);
        setSelectedEstimate(null);
      }, 1500);

    } catch (error) {
      console.error('Error scheduling estimate:', error);
      setSchedulingError(error.message || 'Failed to schedule estimate');
    } finally {
      setIsScheduling(false);
    }
  };

  /**
   * Unschedule an estimate
   */
  const handleUnschedule = async () => {
    setIsScheduling(true);
    setSchedulingError('');

    try {
      const response = await fetch(`/api/estimates/${selectedEstimate.id}/unschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unschedule estimate');
      }

      const updatedEstimate = await response.json();
      
      // Update the estimates list
      setEstimates(prev => 
        prev.map(est => 
          est.id === selectedEstimate.id ? updatedEstimate : est
        )
      );

      setSchedulingSuccess('Estimate unscheduled successfully!');
      
      // Close modal after a short delay
      setTimeout(() => {
        setShowScheduleModal(false);
        setSelectedEstimate(null);
      }, 1500);

    } catch (error) {
      console.error('Error unscheduling estimate:', error);
      setSchedulingError(error.message || 'Failed to unschedule estimate');
    } finally {
      setIsScheduling(false);
    }
  };

  /**
   * Get the appropriate badge for an estimate status
   */
  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return <Badge bg="warning">Pending</Badge>;
      case 'approved':
        return <Badge bg="success">Approved</Badge>;
      case 'rejected':
        return <Badge bg="danger">Rejected</Badge>;
      case 'converted':
        return <Badge bg="info">Converted to Bid</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };
  
  /**
   * Format a date string for display (date only)
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  /**
   * Format a date string for display with time
   */
  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not scheduled';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    
    const formattedDate = date.toLocaleDateString(undefined, dateOptions);
    const formattedTime = date.toLocaleTimeString(undefined, timeOptions);
    
    return `${formattedDate}, ${formattedTime}`;
  };
  
  /**
   * Render scheduled date information with estimator
   */
  const renderScheduledInfo = (estimate) => {
    if (!estimate.scheduled_date) {
      return <span className="text-muted">Not scheduled</span>;
    }
    
    return (
      <div>
        <div className="d-flex align-items-center">
          <FaCalendarAlt className="text-primary me-1" />
          <span>{formatDateTime(estimate.scheduled_date)}</span>
        </div>
        <div className="d-flex align-items-center mt-1 text-muted small">
          <FaUserClock className="me-1" />
          <span>Estimator: {estimate.estimator_name || 'Brett'}</span>
        </div>
      </div>
    );
  };

  /**
   * Get the minimum date for scheduling (today)
   */
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };
  
  if (loading) {
    return <div>Loading estimates...</div>;
  }
  
  return (
    <div className="estimate-list-container">
      <div className="estimate-list-header">
        <div className="estimate-list-actions w-100">
          <InputGroup className="search-input me-2">
            <Form.Control
              type="text"
              placeholder="Search by ID, Customer, Site, Estimator..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </InputGroup>
        </div>
      </div>
      
      {filteredEstimates.length === 0 ? (
        <p>No pending estimates found. {searchTerm && 'Try a different search term.'}</p>
      ) : (
        <Table striped hover responsive className="estimate-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Site Address / Name</th>
              <th>Date Created</th>
              <th>Scheduled Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEstimates.map(estimate => (
              <tr key={estimate.id}>
                <td>EST-{estimate.id}</td>
                <td>{estimate.customer_name}</td>
                <td>{estimate.site_name ? `${estimate.site_name} (${estimate.site_address || 'N/A'})` : (estimate.site_address || 'N/A')}</td>
                <td>{formatDate(estimate.created_at)}</td>
                <td>{renderScheduledInfo(estimate)}</td>
                <td>{getStatusBadge(estimate.status)}</td>
                <td>
                  <div className="d-flex gap-2">
                    {onSelectEstimate ? (
                      // Selection mode - used when selecting an estimate from another page
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={() => onSelectEstimate(estimate)}
                      >
                        Select
                      </Button>
                    ) : (
                      // Regular view - link to view the estimate details
                      <Link to={`/estimates/${estimate.id}/progress`}>
                        <Button 
                          variant="outline-primary" 
                          size="sm"
                        >
                          <FaEye className="me-1" /> View
                        </Button>
                      </Link>
                    )}
                    
                    {/* Schedule/Reschedule Button */}
                    <Button
                      variant={estimate.scheduled_date ? "outline-secondary" : "outline-success"}
                      size="sm"
                      onClick={() => handleScheduleClick(estimate)}
                      title={estimate.scheduled_date ? "Reschedule" : "Schedule"}
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

      {/* Scheduling Modal */}
      <Modal 
        show={showScheduleModal} 
        onHide={() => setShowScheduleModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaCalendarAlt className="me-2" />
            {selectedEstimate?.scheduled_date ? 'Reschedule' : 'Schedule'} Estimate
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {/* Display estimate information */}
          {selectedEstimate && (
            <div className="mb-4 p-3 bg-light rounded">
              <h6 className="mb-2">Estimate Details</h6>
              <div className="row">
                <div className="col-md-6">
                  <strong>ID:</strong> EST-{selectedEstimate.id}<br />
                  <strong>Customer:</strong> {selectedEstimate.customer_name}<br />
                  <strong>Site:</strong> {selectedEstimate.site_name || 'N/A'}
                </div>
                <div className="col-md-6">
                  <strong>Address:</strong> {selectedEstimate.site_address || 'N/A'}<br />
                  <strong>Created:</strong> {formatDate(selectedEstimate.created_at)}
                </div>
              </div>
            </div>
          )}

          {/* Error and Success Messages */}
          {schedulingError && (
            <Alert variant="danger" className="mb-3">
              {schedulingError}
            </Alert>
          )}

          {schedulingSuccess && (
            <Alert variant="success" className="mb-3">
              {schedulingSuccess}
            </Alert>
          )}

          {/* Scheduling Form */}
          <Form onSubmit={handleScheduleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaCalendarAlt className="me-1" />
                    Schedule Date *
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={scheduleForm.scheduled_date}
                    onChange={(e) => handleScheduleFormChange('scheduled_date', e.target.value)}
                    min={getMinDate()}
                    required
                    disabled={isScheduling}
                  />
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaClock className="me-1" />
                    Schedule Time
                  </Form.Label>
                  <Form.Control
                    type="time"
                    value={scheduleForm.scheduled_time}
                    onChange={(e) => handleScheduleFormChange('scheduled_time', e.target.value)}
                    disabled={isScheduling}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaUserClock className="me-1" />
                    Estimator
                  </Form.Label>
                  <Form.Select
                    value={scheduleForm.estimator_name}
                    onChange={(e) => {
                      const estimatorName = e.target.value;
                      const estimatorId = estimatorName === 'Brett' ? 1 : 2;
                      handleScheduleFormChange('estimator_name', estimatorName);
                      handleScheduleFormChange('estimator_id', estimatorId);
                    }}
                    disabled={isScheduling}
                  >
                    <option value="Brett">Brett</option>
                    <option value="Scott">Scott</option>
                    <option value="Taylor">Taylor</option>
                    <option value="Kelly">Kelly</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Duration (minutes)</Form.Label>
                  <Form.Select
                    value={scheduleForm.duration}
                    onChange={(e) => handleScheduleFormChange('duration', parseInt(e.target.value))}
                    disabled={isScheduling}
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                    <option value={180}>3 hours</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Schedule Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={scheduleForm.schedule_notes}
                onChange={(e) => handleScheduleFormChange('schedule_notes', e.target.value)}
                placeholder="Add any special instructions or notes for the estimate appointment..."
                disabled={isScheduling}
              />
            </Form.Group>
          </Form>
        </Modal.Body>

        <Modal.Footer className="d-flex justify-content-between">
          <div>
            {selectedEstimate?.scheduled_date && (
              <Button
                variant="outline-danger"
                onClick={handleUnschedule}
                disabled={isScheduling}
              >
                {isScheduling ? 'Processing...' : 'Unschedule'}
              </Button>
            )}
          </div>
          
          <div className="d-flex gap-2">
            <Button 
              variant="secondary" 
              onClick={() => setShowScheduleModal(false)}
              disabled={isScheduling}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              type="submit"
              onClick={handleScheduleSubmit}
              disabled={isScheduling || !scheduleForm.scheduled_date}
            >
              {isScheduling ? 'Scheduling...' : (selectedEstimate?.scheduled_date ? 'Update Schedule' : 'Schedule Estimate')}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EstimateList;