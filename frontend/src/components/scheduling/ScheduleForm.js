import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Card, Row, Col, Nav, Alert, Badge } from 'react-bootstrap';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getJob, scheduleJob, getJobs } from '../../services/jobService';
import JobList from '../jobs/JobList';
import JobCalendar from './JobCalendar';
import './ScheduleForm.css';

/**
 * ScheduleForm Component
 * Allows users to schedule jobs by selecting a job, date, and scheduling details
 * Uses a multi-step workflow for better UX with proper date handling
 */
const ScheduleForm = () => {
  // State variables
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [formData, setFormData] = useState({
    scheduled_date: '',
    material_ready: false,
    material_location: 'S',
    region: 'OC',
    job_scope: ''
  });
  const [view, setView] = useState('list'); // 'list', 'calendar', or 'form'
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [error, setError] = useState(null);
  
  // Router hooks
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId: jobIdParam } = useParams();
  const queryParams = new URLSearchParams(location.search);
  const jobId = jobIdParam || queryParams.get('jobId');
  
  /**
   * Format date to YYYY-MM-DD string without timezone issues
   * @param {Date} date - The date object to format
   * @returns {string} Formatted date string
   */
  const formatDateForForm = (date) => {
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  /**
   * Parse ISO date string to Date object with local timezone
   * @param {string} dateString - The ISO date string (YYYY-MM-DD)
   * @returns {Date} Date object with time set to noon
   */
  const parseISODate = (dateString) => {
    if (!dateString) return null;
    
    // Parse the ISO date parts
    const [year, month, day] = dateString.split('-').map(Number);
    
    // Create a new date with time set to noon to avoid timezone issues
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    return date;
  };
  
  /**
   * Load a specific job by ID
   * @param {string|number} id - The job ID to load
   */
  const loadJob = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    
    try {
      const job = await getJob(id);
      setSelectedJob(job);
      
      // Initialize form with job data, handling dates correctly
      const parsedDate = job.scheduled_date ? formatDateForForm(parseISODate(job.scheduled_date)) : '';
      
      setFormData({
        scheduled_date: parsedDate,
        material_ready: job.material_ready || false,
        material_location: job.material_location || 'S',
        region: job.region || 'OC',
        job_scope: job.job_scope || ''
      });
      
      // If the job already has a scheduled date, select it in the calendar
      if (job.scheduled_date) {
        setSelectedDate(parseISODate(job.scheduled_date));
        setView('form'); // Go directly to form for editing existing scheduled job
      } else {
        setView('calendar'); // Go to calendar to select a date
      }
    } catch (error) {
      console.error('Error loading job:', error);
      setError('Failed to load job details. Please try again.');
      toast.error('Error loading job details');
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Load scheduled jobs for the calendar
   */
  const loadScheduledJobs = useCallback(async () => {
    try {
      // Get jobs that have scheduled_date
      const jobs = await getJobs();
      const filtered = jobs.filter(job => job.scheduled_date);
      setScheduledJobs(filtered);
    } catch (error) {
      console.error('Error loading scheduled jobs:', error);
      // Don't show toast as this is a background operation
    }
  }, []);
  
  // Load job data and scheduled jobs on component mount
  useEffect(() => {
    loadScheduledJobs();
    
    if (jobId) {
      loadJob(jobId);
    }
  }, [jobId, loadJob, loadScheduledJobs]);
  
  /**
   * Handle selecting a job from the job list
   * @param {Object} job - The selected job
   */
  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setView('calendar');
    
    // Initialize form with job data, handling dates correctly
    const parsedDate = job.scheduled_date ? formatDateForForm(parseISODate(job.scheduled_date)) : '';
    
    setFormData({
      scheduled_date: parsedDate,
      material_ready: job.material_ready || false,
      material_location: job.material_location || 'S',
      region: job.region || 'OC',
      job_scope: job.job_scope || ''
    });
    
    // If the job already has a scheduled date, select it in the calendar
    if (job.scheduled_date) {
      setSelectedDate(parseISODate(job.scheduled_date));
    }
  };
  
  /**
   * Handle selecting a date from the calendar
   * Modified to stay on calendar view and show scheduled jobs
   * @param {Date} date - The selected date object from the calendar
   */
  const handleSelectDate = (date) => {
    // Ensure we have a date object with time set to noon
    const selectedDate = new Date(date);
    selectedDate.setHours(12, 0, 0, 0); // Standardize the time to avoid timezone issues
    
    setSelectedDate(selectedDate);
    // Don't automatically switch to form view - stay on calendar
    
    // Format date for form using our helper to avoid timezone issues
    const formattedDate = formatDateForForm(selectedDate);
    
    setFormData({
      ...formData,
      scheduled_date: formattedDate
    });
  };
  
  /**
   * Proceed to details form after date selection
   */
  const proceedToDetails = () => {
    if (!selectedDate) {
      toast.error('Please select a date first');
      return;
    }
    setView('form');
  };
  
  /**
   * Handle form input changes
   * @param {Event} e - The change event
   */
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  /**
   * Handle date input changes in the form
   * Ensures correct date handling and timezone consistency
   * @param {Event} e - The change event for the date input
   */
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    
    // Update the form with the raw string value
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Parse the date string to a Date object
    if (value) {
      const newDate = parseISODate(value);
      setSelectedDate(newDate);
    } else {
      setSelectedDate(null);
    }
  };
  
  /**
   * Handle form submission to schedule a job
   * @param {Event} e - The submit event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedJob) {
      toast.error('Please select a job');
      return;
    }
    
    if (!formData.scheduled_date) {
      toast.error('Please select a date');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await scheduleJob(selectedJob.id, formData);
      toast.success('Job scheduled successfully');
      navigate(`/jobs/${selectedJob.id}`);
    } catch (error) {
      console.error('Error scheduling job:', error);
      setError('Failed to schedule job. Please try again.');
      toast.error('Error scheduling job');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  /**
   * Handle cancellation and navigation
   */
  const handleCancel = () => {
    // If we're editing an existing job, go back to job details
    if (selectedJob) {
      navigate(`/jobs/${selectedJob.id}`);
    } else {
      // Otherwise, go back to jobs list
      navigate('/jobs');
    }
  };
  
  /**
   * Switch between different views (list, calendar, form)
   * @param {string} newView - The view to switch to
   */
  const switchView = (newView) => {
    setView(newView);
  };
  
  /**
   * Format date for display
   * @param {Date} date - The date to format
   * @returns {string} Formatted date string
   */
  const formatDisplayDate = (date) => {
    if (!date) return '';
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };
  
  /**
   * Get region display name from code
   * @param {string} regionCode - The region code
   * @returns {string} The region display name
   */
  const getRegionName = (regionCode) => {
    const regions = {
      'OC': 'Orange County',
      'LA': 'Los Angeles',
      'IE': 'Inland Empire'
    };
    return regions[regionCode] || regionCode;
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="text-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading job details...</p>
      </div>
    );
  }
  
  return (
    <div className="schedule-form-container">
      <h2 className="page-title mb-4">Schedule Job</h2>
      
      {/* Error message display */}
      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}
      
      {/* Selected Job Info Display */}
      {selectedJob && (
        <Card className="mb-4 schedule-form-card">
          <Card.Body>
            <div className="selected-job-info mb-3">
              <span className="job-number">{selectedJob.job_number}</span>
              <span className="customer-name">{selectedJob.customer_name}</span>
              <div className="job-address">{selectedJob.address || 'No address provided'}</div>
            </div>
            
            {/* Navigation Tabs */}
            <Nav variant="tabs" className="mb-3 schedule-tabs">
              <Nav.Item>
                <Nav.Link 
                  className={view === 'list' ? 'active' : ''}
                  onClick={() => switchView('list')}
                >
                  Job List
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link 
                  className={view === 'calendar' ? 'active' : ''}
                  onClick={() => switchView('calendar')}
                >
                  Calendar
                </Nav.Link>
              </Nav.Item>
              {selectedDate && (
                <Nav.Item>
                  <Nav.Link 
                    className={view === 'form' ? 'active' : ''}
                    onClick={() => switchView('form')}
                  >
                    Details
                  </Nav.Link>
                </Nav.Item>
              )}
            </Nav>
          </Card.Body>
        </Card>
      )}
      
      {/* Selected Date Display */}
      {selectedDate && view !== 'list' && (
        <div className="selected-date-display mb-3">
          <span className="date-label">Selected Date:</span>
          <span className="date-value">{formatDisplayDate(selectedDate)}</span>
          {view === 'calendar' && (
            <Button 
              variant="primary" 
              size="sm" 
              className="ms-3"
              onClick={proceedToDetails}
            >
              Continue to Details →
            </Button>
          )}
        </div>
      )}
      
      {/* Job List View */}
      {view === 'list' && (
        <Card className="mb-4">
          <Card.Header>{selectedJob ? 'Change Job Selection' : 'Select a Job to Schedule'}</Card.Header>
          <Card.Body>
            <JobList onSelectJob={handleSelectJob} />
          </Card.Body>
        </Card>
      )}
      
      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="calendar-container">
          <JobCalendar 
            region={selectedJob?.region || formData.region}
            onSelectDate={handleSelectDate}
          />
          
          {/* Calendar Actions */}
          {selectedDate && (
            <Card className="mt-3">
              <Card.Body className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>Ready to schedule for {formatDisplayDate(selectedDate)}?</strong>
                  <div className="text-muted small">
                    Review the existing jobs above, then proceed to enter scheduling details.
                  </div>
                </div>
                <div>
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    className="me-2"
                    onClick={() => setSelectedDate(null)}
                  >
                    Clear Date
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={proceedToDetails}
                  >
                    Continue to Details →
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}
        </div>
      )}
      
      {/* Form View */}
      {view === 'form' && selectedJob && selectedDate && (
        <Card className="schedule-form-card">
          <Card.Header style={{background:'none', border:'none', fontWeight:600, fontSize:'1.15rem'}}>
            Schedule Details
          </Card.Header>
          <Card.Body>
            <Form onSubmit={handleSubmit}>
              <Row>
                <Col md={6} className="mb-3 mb-md-0">
                  <Form.Group className="mb-3">
                    <Form.Label>Scheduled Date</Form.Label>
                    <Form.Control
                      type="date"
                      name="scheduled_date"
                      value={formData.scheduled_date}
                      onChange={handleDateChange}
                      required
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Check 
                      type="checkbox"
                      id="material-ready"
                      label="Material Ready"
                      name="material_ready"
                      checked={formData.material_ready}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Material Location</Form.Label>
                    <Form.Select
                      name="material_location"
                      value={formData.material_location}
                      onChange={handleInputChange}
                    >
                      <option value="S">Shop</option>
                      <option value="C">Client</option>
                    </Form.Select>
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Region</Form.Label>
                    <Form.Select
                      name="region"
                      value={formData.region}
                      onChange={handleInputChange}
                    >
                      <option value="OC">Orange County (OC)</option>
                      <option value="LA">Los Angeles (LA)</option>
                      <option value="IE">Inland Empire (IE)</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group className="h-100 d-flex flex-column">
                    <Form.Label>Additional Notes</Form.Label>
                    <Form.Control
                      as="textarea"
                      name="job_scope"
                      value={formData.job_scope}
                      onChange={handleInputChange}
                      placeholder="Enter job scope or special instructions"
                      className="flex-grow-1"
                      style={{minHeight: '200px', resize: 'vertical'}}
                    />
                  </Form.Group>
                </Col>
              </Row>
              
              <div className="d-flex justify-content-between mt-4">
                <Button 
                  variant="outline-secondary" 
                  onClick={() => setView('calendar')}
                  type="button"
                >
                  ← Back to Calendar
                </Button>
                <div>
                  <Button 
                    variant="secondary" 
                    onClick={handleCancel}
                    className="me-2"
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="primary" 
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Scheduling...' : 'Schedule Job'}
                  </Button>
                </div>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}
      
      {/* Default view if no job is selected */}
      {!selectedJob && view !== 'list' && (
        <Card className="mb-4">
          <Card.Header>Select a Job to Schedule</Card.Header>
          <Card.Body>
            <JobList onSelectJob={handleSelectJob} />
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default ScheduleForm;