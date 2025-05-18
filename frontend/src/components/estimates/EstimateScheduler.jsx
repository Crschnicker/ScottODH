import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Badge, Spinner } from 'react-bootstrap';
import { FaCalendarAlt, FaClock, FaUser, FaEdit, FaSave, FaTrash } from 'react-icons/fa';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import EstimateScheduleForm from './EstimateScheduleForm';

/**
 * EstimateScheduler Component
 * 
 * Provides UI for scheduling an estimate, viewing scheduled estimates,
 * and managing estimate appointments.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.estimate - The current estimate object
 * @param {Function} props.onUpdate - Callback when estimate is updated
 */
const EstimateScheduler = ({ estimate, onUpdate }) => {
  // State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(null);
  const [estimatorName, setEstimatorName] = useState('Brett'); // Default estimator
  const [duration, setDuration] = useState(60); // Default duration in minutes
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Check if estimate has scheduling information
  useEffect(() => {
    if (estimate) {
      setIsScheduled(Boolean(estimate.scheduled_date));
      if (estimate.scheduled_date) {
        setScheduledDate(new Date(estimate.scheduled_date));
        setEstimatorName(estimate.estimator_name || 'Brett');
        setDuration(estimate.duration || 60); // Set duration from estimate if available
      }
    }
  }, [estimate]);
  
  /**
   * Format the scheduled date and time for display using 12-hour format
   * @param {Date} date - The date to format
   * @returns {string} Formatted date string
   */
  const formatDateTime = (date) => {
    if (!date) return 'Not scheduled';
    
    // Format date and time with explicit 12-hour format for US locale
    const options = { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true // Explicitly set to 12-hour format
    };
    
    return date.toLocaleString('en-US', options);
  };
  
  /**
   * Format duration in a human-readable format
   * @param {number} minutes - Duration in minutes
   * @returns {string} Formatted duration
   */
  const formatDuration = (minutes) => {
    if (!minutes) return '';
    
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else if (minutes === 60) {
      return '1 hour';
    } else if (minutes % 60 === 0) {
      return `${minutes / 60} hours`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
    }
  };
  
  /**
   * Handle estimate scheduling
   * @param {Object} scheduleData - The schedule data from the form
   */
  const handleScheduleEstimate = async (scheduleData) => {
    setLoading(true);
    setError('');
    
    try {
      // Make API call to update estimate with schedule information
      const response = await axios.post(
        `${API_BASE_URL}/api/estimates/${estimate.id}/schedule`,
        scheduleData
      );
      
      // Update local state with the new schedule information
      setIsScheduled(true);
      setScheduledDate(new Date(scheduleData.scheduled_date));
      setEstimatorName(scheduleData.estimator_name);
      setDuration(scheduleData.duration || 60);
      
      // Close the modal
      setShowScheduleModal(false);
      
      // Call the onUpdate callback with updated estimate
      if (onUpdate && typeof onUpdate === 'function') {
        onUpdate({
          ...estimate,
          ...response.data
        });
      }
    } catch (err) {
      console.error('Error scheduling estimate:', err);
      setError('Failed to schedule estimate. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Cancel a scheduled estimate
   */
  const handleCancelSchedule = async () => {
    if (!window.confirm('Are you sure you want to cancel this scheduled estimate?')) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Make API call to remove schedule information
      const response = await axios.post(
        `${API_BASE_URL}/api/estimates/${estimate.id}/unschedule`
      );
      
      // Update local state
      setIsScheduled(false);
      setScheduledDate(null);
      
      // Call the onUpdate callback with updated estimate
      if (onUpdate && typeof onUpdate === 'function') {
        onUpdate({
          ...estimate,
          ...response.data
        });
      }
    } catch (err) {
      console.error('Error canceling estimate schedule:', err);
      setError('Failed to cancel schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Render scheduling badge and actions
  return (
    <div className="estimate-scheduler">
      {error && <div className="alert alert-danger">{error}</div>}
      
      <div className="schedule-status-container p-3 bg-light border rounded mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="mb-0">
            <FaCalendarAlt className="me-2" />
            Estimate Appointment
          </h5>
          
          {isScheduled ? (
            <Badge bg="success">Scheduled</Badge>
          ) : (
            <Badge bg="warning">Not Scheduled</Badge>
          )}
        </div>
        
        {isScheduled && scheduledDate ? (
          <div className="schedule-details">
            <div className="mb-2">
              <FaCalendarAlt className="me-2 text-primary" />
              <strong>Date/Time:</strong> {formatDateTime(scheduledDate)}
            </div>
            <div className="mb-2">
              <FaUser className="me-2 text-primary" />
              <strong>Estimator:</strong> {estimatorName}
            </div>
            <div className="mb-2">
              <FaClock className="me-2 text-primary" />
              <strong>Duration:</strong> {formatDuration(duration)}
            </div>
            {estimate.schedule_notes && (
              <div className="mb-2">
                <strong>Notes:</strong> {estimate.schedule_notes}
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted mb-3">
            This estimate has not been scheduled yet. Click the button below to schedule an appointment.
          </p>
        )}
        
        <div className="schedule-actions">
          {loading ? (
            <Button variant="primary" disabled>
              <Spinner 
                as="span" 
                animation="border" 
                size="sm" 
                role="status" 
                aria-hidden="true" 
              />
              <span className="ms-2">Processing...</span>
            </Button>
          ) : isScheduled ? (
            <>
              <Button 
                variant="outline-primary" 
                className="me-2"
                onClick={() => setShowScheduleModal(true)}
              >
                <FaEdit className="me-1" /> Reschedule
              </Button>
              <Button 
                variant="outline-danger"
                onClick={handleCancelSchedule}
              >
                <FaTrash className="me-1" /> Cancel Appointment
              </Button>
            </>
          ) : (
            <Button 
              variant="primary"
              onClick={() => setShowScheduleModal(true)}
            >
              <FaCalendarAlt className="me-1" /> Schedule Estimate
            </Button>
          )}
        </div>
      </div>
      
      {/* Schedule Modal */}
      <EstimateScheduleForm
        show={showScheduleModal}
        onHide={() => setShowScheduleModal(false)}
        estimate={estimate}
        onSchedule={handleScheduleEstimate}
      />
    </div>
  );
};

export default EstimateScheduler;