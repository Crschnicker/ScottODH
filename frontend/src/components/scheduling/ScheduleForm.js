import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getJob, scheduleJob } from '../../services/jobService';
import JobList from '../jobs/JobList';
import JobCalendar from './Calendar';
import './ScheduleForm.css';

const ScheduleForm = () => {
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [formData, setFormData] = useState({
    scheduled_date: '',
    material_ready: false,
    material_location: 'S',
    region: 'OC',
    job_scope: ''
  });
  const [showJobList, setShowJobList] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const jobId = queryParams.get('jobId');
  
  useEffect(() => {
    if (jobId) {
      loadJob(jobId);
    }
  }, [jobId]);
  
  const loadJob = async (id) => {
    setLoading(true);
    try {
      const job = await getJob(id);
      setSelectedJob(job);
      setShowJobList(false);
      
      // Initialize form with job data
      setFormData({
        scheduled_date: job.scheduled_date || '',
        material_ready: job.material_ready || false,
        material_location: job.material_location || 'S',
        region: job.region || 'OC',
        job_scope: job.job_scope || ''
      });
    } catch (error) {
      console.error('Error loading job:', error);
      toast.error('Error loading job details');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setShowJobList(false);
    setShowCalendar(true);
    
    // Initialize form with job data
    setFormData({
      scheduled_date: job.scheduled_date || '',
      material_ready: job.material_ready || false,
      material_location: job.material_location || 'S',
      region: job.region || 'OC',
      job_scope: job.job_scope || ''
    });
  };
  
  const handleSelectDate = (date) => {
    setSelectedDate(date);
    setShowCalendar(false);
    
    // Format date for form
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    setFormData({
      ...formData,
      scheduled_date: formattedDate
    });
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    
    // If date is manually changed in the form
    setFormData({
      ...formData,
      [name]: value
    });
    
    setSelectedDate(value ? new Date(value) : null);
  };
  
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
    try {
      await scheduleJob(selectedJob.id, formData);
      toast.success('Job scheduled successfully');
      navigate(`/jobs/${selectedJob.id}`);
    } catch (error) {
      console.error('Error scheduling job:', error);
      toast.error('Error scheduling job');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    // If we're editing an existing job, go back to job details
    if (selectedJob) {
      navigate(`/jobs/${selectedJob.id}`);
    } else {
      // Otherwise, go back to jobs list
      navigate('/jobs');
    }
  };
  
  if (loading) {
    return <div>Loading job details...</div>;
  }
  
  return (
    <div className="schedule-form-container">
      <h2>Schedule Job</h2>
      
      {showJobList && (
        <Card className="mb-4">
          <Card.Header>Select a Job to Schedule</Card.Header>
          <Card.Body>
            <JobList onSelectJob={handleSelectJob} />
          </Card.Body>
        </Card>
      )}
      
      {showCalendar && (
        <Card className="mb-4">
          <Card.Header>Select a Date</Card.Header>
          <Card.Body>
            <JobCalendar 
              region={formData.region}
              onSelectDate={handleSelectDate}
            />
          </Card.Body>
        </Card>
      )}
      
      {selectedJob && !showJobList && !showCalendar && (
        <>
          <Card className="mb-4">
            <Card.Header>Selected Job</Card.Header>
            <Card.Body>
              <div className="selected-job-info">
                <div>
                  <span className="job-number">{selectedJob.job_number}</span> 
                  <span className="customer-name">{selectedJob.customer_name}</span>
                </div>
                <div className="job-address">{selectedJob.address || 'No address'}</div>
              </div>
              
              <div className="mt-3">
                <Button 
                  variant="outline-primary" 
                  onClick={() => setShowJobList(true)}
                  className="me-2"
                >
                  Change Job
                </Button>
                <Button 
                  variant="outline-primary" 
                  onClick={() => setShowCalendar(true)}
                >
                  View Calendar
                </Button>
              </div>
            </Card.Body>
          </Card>
          
          <Card>
            <Card.Header>Schedule Details</Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
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
                  </Col>
                  
                  <Col md={6}>
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
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Job Scope</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        name="job_scope"
                        value={formData.job_scope}
                        onChange={handleInputChange}
                        placeholder="Enter job scope or special instructions"
                      />
                    </Form.Group>
                  </Col>
                </Row>
                
                <div className="d-flex justify-content-end mt-3">
                  <Button 
                    variant="secondary" 
                    onClick={handleCancel}
                    className="me-2"
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
              </Form>
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
};

export default ScheduleForm;
