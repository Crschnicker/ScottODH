import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Row, Col, ListGroup, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import { FaCheckCircle, FaCalendarAlt, FaArrowLeft, FaMapMarkerAlt, FaUserAlt, FaPhoneAlt, FaGlobe, FaTools, FaBoxOpen, FaInfo } from 'react-icons/fa';
import SignatureCanvas from 'react-signature-canvas';
import { toast } from 'react-toastify';
import { getJob, updateJobStatus, completeDoor } from '../../services/jobService';
import './JobDetails.css';

/**
 * Enhanced JobDetails Component
 * 
 * Displays comprehensive job information with a modern UI
 * and improved mobile responsiveness
 */
const JobDetails = () => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedDoor, setSelectedDoor] = useState(null);
  const [signature, setSignature] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [video, setVideo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const { jobId } = useParams();
  const navigate = useNavigate();
  let sigCanvas = null;
  
  /**
   * Load job details from API
   */
  const loadJob = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getJob(jobId);
      setJob(data);
    } catch (err) {
      console.error('Error loading job:', err);
      setError('Failed to load job details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);
  
  /**
   * Load job data on component mount
   */
  useEffect(() => {
    loadJob();
  }, [loadJob]);
  
  /**
   * Handle job status change
   */
  const handleStatusChange = async (newStatus) => {
    try {
      await updateJobStatus(job.id, { status: newStatus });
      toast.success(`Job status updated to ${newStatus.replace('_', ' ')}`);
      loadJob();
    } catch (error) {
      console.error('Error updating job status:', error);
      toast.error('Error updating job status');
    }
  };
  
  /**
   * Open modal to complete a door
   */
  const openCompleteModal = (door) => {
    setSelectedDoor(door);
    setShowCompleteModal(true);
    setSignature(null);
    setPhoto(null);
    setVideo(null);
  };
  
  /**
   * Clear signature pad
   */
  const handleSignatureClear = () => {
    sigCanvas.clear();
    setSignature(null);
  };
  
  /**
   * Capture signature when drawing ends
   */
  const handleSignatureEnd = () => {
    setSignature(sigCanvas.toDataURL());
  };
  
  /**
   * Handle photo selection
   */
  const handlePhotoChange = (e) => {
    setPhoto(e.target.files[0]);
  };
  
  /**
   * Handle video selection
   */
  const handleVideoChange = (e) => {
    setVideo(e.target.files[0]);
  };
  
  /**
   * Mark a door as completed
   */
  const handleCompleteDoor = async (e) => {
    e.preventDefault();
    
    if (!signature) {
      toast.error('Please provide a signature');
      return;
    }
    
    if (!photo) {
      toast.error('Please upload a photo');
      return;
    }
    
    if (!video) {
      toast.error('Please upload a video');
      return;
    }
    
    setIsSubmitting(true);
    try {
      // In a real app, we would upload files to the server
      // Here we'll just simulate a successful submission
      await completeDoor(job.id, selectedDoor.id, {
        signature: signature,
        photo_file: 'simulated_photo.jpg', // Would be actual file in real app
        video_file: 'simulated_video.mp4'  // Would be actual file in real app
      });
      
      toast.success(`Door #${selectedDoor.door_number} marked as completed`);
      setShowCompleteModal(false);
      loadJob();
    } catch (error) {
      console.error('Error completing door:', error);
      toast.error('Error completing door');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'Not Scheduled';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner animation="border" variant="primary" />
        <p>Loading job details...</p>
      </div>
    );
  }
  
  /**
   * Render error state
   */
  if (error) {
    return (
      <Alert variant="danger" className="error-alert">
        <Alert.Heading>Error Loading Job</Alert.Heading>
        <p>{error}</p>
        <div className="d-flex justify-content-between">
          <Button variant="outline-danger" onClick={() => navigate('/jobs')}>
            Back to Jobs
          </Button>
          <Button variant="primary" onClick={loadJob}>
            Try Again
          </Button>
        </div>
      </Alert>
    );
  }
  
  /**
   * Render not found state
   */
  if (!job) {
    return (
      <Alert variant="warning" className="not-found-alert">
        <Alert.Heading>Job Not Found</Alert.Heading>
        <p>The requested job could not be found.</p>
        <Button variant="primary" onClick={() => navigate('/jobs')}>
          Back to Jobs
        </Button>
      </Alert>
    );
  }
  
  return (
    <div className="job-details-container">
      <div className="job-details-header">
        <div className="job-title">
          <h2>Job #{job.job_number}</h2>
          <div className="d-flex align-items-center mb-2">
            <span className="status-label me-3">
              Status:
            </span>
            <span className="status-text">
              {job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1).replace(/_/g, ' ') : 'No Status'}
            </span>
          </div>
        </div>
        <div className="job-actions">
          <Button 
            variant="outline-primary" 
            className="action-button"
            onClick={() => navigate(`/schedule?jobId=${job.id}`)}
          >
            <FaCalendarAlt className="me-2" /> Schedule
          </Button>
          <Button 
            variant="outline-secondary" 
            className="action-button"
            onClick={() => navigate('/jobs')}
          >
            <FaArrowLeft className="me-2" /> Back to Jobs
          </Button>
        </div>
      </div>
      
      <Row className="job-info-row">
        <Col lg={6} className="mb-3 mb-lg-0">
          <Card className="info-card">
            <Card.Header>
              <h5 className="mb-0">
                <FaInfo className="me-2" /> Job Information
              </h5>
            </Card.Header>
            <Card.Body>
              <div className="info-row">
                <div className="info-item">
                  <span className="info-label">
                    <FaUserAlt className="me-2" /> Customer
                  </span>
                  <span className="info-value">{job.customer_name}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <FaMapMarkerAlt className="me-2" /> Address
                  </span>
                  <span className="info-value">{job.address || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <FaUserAlt className="me-2" /> Contact
                  </span>
                  <span className="info-value">{job.contact_name || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <FaPhoneAlt className="me-2" /> Phone
                  </span>
                  <span className="info-value">{job.phone || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <FaGlobe className="me-2" /> Region
                  </span>
                  <span className="info-value">{job.region}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <FaTools className="me-2" /> Scope
                  </span>
                  <span className="info-value">{job.job_scope || 'N/A'}</span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={6}>
          <Card className="info-card">
            <Card.Header>
              <h5 className="mb-0">
                <FaInfo className="me-2" /> Status Information
              </h5>
            </Card.Header>
            <Card.Body>
              <div className="info-row">
                <div className="info-item">
                  <span className="info-label">Scheduled Date</span>
                  <span className="info-value">
                    <FaCalendarAlt className="me-2" />
                    {formatDate(job.scheduled_date)}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status</span>
                  <span className="status-text">
                    {job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1).replace(/_/g, ' ') : 'No Status'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Material Ready</span>
                  <span className="status-text">
                    {job.material_ready ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Material Location</span>
                  <span className="info-value">
                    <FaBoxOpen className="me-2" />
                    {job.material_location === 'S' ? 'Shop' : 
                     job.material_location === 'C' ? 'Client' : 
                     job.material_location || 'N/A'}
                  </span>
                </div>
              </div>
              
              <div className="status-actions">
                <div className="status-label">Update Status:</div>
                <div className="status-buttons">
                  <Button 
                    variant={job.status === 'unscheduled' ? 'secondary' : 'outline-secondary'} 
                    size="sm"
                    onClick={() => handleStatusChange('unscheduled')}
                    className="status-btn"
                  >
                    Unscheduled
                  </Button>
                  <Button 
                    variant={job.status === 'scheduled' ? 'primary' : 'outline-primary'} 
                    size="sm"
                    onClick={() => handleStatusChange('scheduled')}
                    className="status-btn"
                  >
                    Scheduled
                  </Button>
                  <Button 
                    variant={job.status === 'waiting_for_parts' ? 'warning' : 'outline-warning'} 
                    size="sm"
                    onClick={() => handleStatusChange('waiting_for_parts')}
                    className="status-btn"
                  >
                    Waiting
                  </Button>
                  <Button 
                    variant={job.status === 'on_hold' ? 'danger' : 'outline-danger'} 
                    size="sm"
                    onClick={() => handleStatusChange('on_hold')}
                    className="status-btn"
                  >
                    On Hold
                  </Button>
                  <Button 
                    variant={job.status === 'completed' ? 'success' : 'outline-success'} 
                    size="sm"
                    onClick={() => handleStatusChange('completed')}
                    className="status-btn"
                  >
                    Completed
                  </Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Card className="doors-card mt-4">
        <Card.Header>
          <h5 className="mb-0">
            <FaTools className="me-2" /> Doors
          </h5>
        </Card.Header>
        <Card.Body>
          {job.doors.length === 0 ? (
            <Alert variant="info">
              No doors associated with this job.
            </Alert>
          ) : (
            <ListGroup variant="flush" className="door-list">
              {job.doors.map(door => (
                <ListGroup.Item 
                  key={door.id}
                  className="door-list-item"
                >
                  <div className="door-info">
                    <div className="door-number">Door #{door.door_number}</div>
                    <span className="door-status-text">
                      {door.completed ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                  <div className="door-actions">
                    {!door.completed && (
                      <Button 
                        variant="primary" 
                        size="sm"
                        onClick={() => openCompleteModal(door)}
                        className="complete-btn"
                      >
                        <FaCheckCircle className="me-2" /> Complete
                      </Button>
                    )}
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Card.Body>
      </Card>
      
      {/* Complete Door Modal */}
      <Modal 
        show={showCompleteModal} 
        onHide={() => setShowCompleteModal(false)} 
        size="lg"
        centered
        className="complete-door-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaCheckCircle className="me-2 text-success" /> 
            Complete Door #{selectedDoor?.door_number}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCompleteDoor}>
            <Form.Group className="mb-4">
              <Form.Label>Client Signature</Form.Label>
              <div className="signature-container">
                <SignatureCanvas
                  ref={(ref) => { sigCanvas = ref; }}
                  penColor="black"
                  canvasProps={{ className: 'signature-canvas' }}
                  onEnd={handleSignatureEnd}
                />
              </div>
              <div className="signature-actions">
                <small className="text-muted">Please sign above</small>
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={handleSignatureClear}
                >
                  Clear
                </Button>
              </div>
            </Form.Group>
            
            <Form.Group className="mb-4">
              <Form.Label>Photo of Completed Door</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                required
                className="file-input"
              />
              <Form.Text className="text-muted">
                Please upload a clear photo of the completed door installation.
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-4">
              <Form.Label>Video of Door Operation</Form.Label>
              <Form.Control
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                required
                className="file-input"
              />
              <Form.Text className="text-muted">
                Upload a short video showing the door operating properly.
              </Form.Text>
            </Form.Group>
            
            <div className="modal-actions">
              <Button 
                variant="secondary" 
                onClick={() => setShowCompleteModal(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="success" 
                type="submit"
                disabled={isSubmitting || !signature || !photo || !video}
              >
                {isSubmitting ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FaCheckCircle className="me-2" /> Mark as Completed
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default JobDetails;