import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Row, Col, Badge, ListGroup, Modal, Form } from 'react-bootstrap';
import { FaEdit, FaCheckCircle } from 'react-icons/fa';
import SignatureCanvas from 'react-signature-canvas';
import { toast } from 'react-toastify';
import { getJob, updateJobStatus, completeDoor } from '../../services/jobService';
import './JobDetails.css';

const JobDetails = () => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedDoor, setSelectedDoor] = useState(null);
  const [signature, setSignature] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [video, setVideo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { jobId } = useParams();
  const navigate = useNavigate();
  let sigCanvas = null;
  
  useEffect(() => {
    loadJob();
  }, [jobId]);
  
  const loadJob = async () => {
    try {
      const data = await getJob(jobId);
      setJob(data);
    } catch (error) {
      console.error('Error loading job:', error);
      toast.error('Error loading job details');
    } finally {
      setLoading(false);
    }
  };
  
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
  
  const openCompleteModal = (door) => {
    setSelectedDoor(door);
    setShowCompleteModal(true);
    setSignature(null);
    setPhoto(null);
    setVideo(null);
  };
  
  const handleSignatureClear = () => {
    sigCanvas.clear();
    setSignature(null);
  };
  
  const handleSignatureEnd = () => {
    setSignature(sigCanvas.toDataURL());
  };
  
  const handlePhotoChange = (e) => {
    setPhoto(e.target.files[0]);
  };
  
  const handleVideoChange = (e) => {
    setVideo(e.target.files[0]);
  };
  
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
  
  const getStatusBadge = (status) => {
    switch(status) {
      case 'unscheduled':
        return <Badge bg="secondary">Unscheduled</Badge>;
      case 'scheduled':
        return <Badge bg="primary">Scheduled</Badge>;
      case 'waiting_for_parts':
        return <Badge bg="warning">Waiting for Parts</Badge>;
      case 'on_hold':
        return <Badge bg="danger">On Hold</Badge>;
      case 'completed':
        return <Badge bg="success">Completed</Badge>;
      default:
        return <Badge bg="info">{status}</Badge>;
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'Not Scheduled';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  if (loading) {
    return <div>Loading job details...</div>;
  }
  
  if (!job) {
    return <div>Job not found</div>;
  }
  
  return (
    <div className="job-details-container">
      <div className="job-details-header">
        <h2>Job #{job.job_number}</h2>
        <div className="job-actions">
          <Button 
            variant="outline-primary" 
            className="me-2"
            onClick={() => navigate(`/schedule?jobId=${job.id}`)}
          >
            Schedule
          </Button>
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate('/jobs')}
          >
            Back to Jobs
          </Button>
        </div>
      </div>
      
      <Row>
        <Col md={6}>
          <Card className="mb-3">
            <Card.Header>Job Information</Card.Header>
            <Card.Body>
              <div className="info-row">
                <span className="info-label">Customer:</span>
                <span className="info-value">{job.customer_name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Address:</span>
                <span className="info-value">{job.address || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Contact:</span>
                <span className="info-value">{job.contact_name || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Phone:</span>
                <span className="info-value">{job.phone || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Region:</span>
                <span className="info-value">{job.region}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Scope:</span>
                <span className="info-value">{job.job_scope || 'N/A'}</span>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card className="mb-3">
            <Card.Header>Status Information</Card.Header>
            <Card.Body>
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className="info-value status-value">
                  {getStatusBadge(job.status)}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Scheduled Date:</span>
                <span className="info-value">{formatDate(job.scheduled_date)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Material Ready:</span>
                <span className="info-value">
                  {job.material_ready ? 
                    <Badge bg="success">Yes</Badge> : 
                    <Badge bg="danger">No</Badge>
                  }
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Material Location:</span>
                <span className="info-value">
                  {job.material_location === 'S' ? 'Shop' : 
                   job.material_location === 'C' ? 'Client' : 
                   job.material_location || 'N/A'}
                </span>
              </div>
              
              <div className="status-actions mt-3">
                <p><strong>Update Status:</strong></p>
                <div className="status-buttons">
                  <Button 
                    variant={job.status === 'unscheduled' ? 'secondary' : 'outline-secondary'} 
                    size="sm"
                    onClick={() => handleStatusChange('unscheduled')}
                    className="me-2 mb-2"
                  >
                    Unscheduled
                  </Button>
                  <Button 
                    variant={job.status === 'scheduled' ? 'primary' : 'outline-primary'} 
                    size="sm"
                    onClick={() => handleStatusChange('scheduled')}
                    className="me-2 mb-2"
                  >
                    Scheduled
                  </Button>
                  <Button 
                    variant={job.status === 'waiting_for_parts' ? 'warning' : 'outline-warning'} 
                    size="sm"
                    onClick={() => handleStatusChange('waiting_for_parts')}
                    className="me-2 mb-2"
                  >
                    Waiting for Parts
                  </Button>
                  <Button 
                    variant={job.status === 'on_hold' ? 'danger' : 'outline-danger'} 
                    size="sm"
                    onClick={() => handleStatusChange('on_hold')}
                    className="me-2 mb-2"
                  >
                    On Hold
                  </Button>
                  <Button 
                    variant={job.status === 'completed' ? 'success' : 'outline-success'} 
                    size="sm"
                    onClick={() => handleStatusChange('completed')}
                    className="mb-2"
                  >
                    Completed
                  </Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Card>
        <Card.Header>Doors</Card.Header>
        <Card.Body>
          <ListGroup>
            {job.doors.map(door => (
              <ListGroup.Item 
                key={door.id}
                className="door-list-item"
              >
                <div className="door-info">
                  <span className="door-number">Door #{door.door_number}</span>
                  {door.completed ? (
                    <Badge bg="success" className="door-status">Completed</Badge>
                  ) : (
                    <Badge bg="secondary" className="door-status">Pending</Badge>
                  )}
                </div>
                <div className="door-actions">
                  {!door.completed && (
                    <Button 
                      variant="success" 
                      size="sm"
                      onClick={() => openCompleteModal(door)}
                    >
                      <FaCheckCircle /> Complete
                    </Button>
                  )}
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Card.Body>
      </Card>
      
      {/* Complete Door Modal */}
      <Modal show={showCompleteModal} onHide={() => setShowCompleteModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Complete Door #{selectedDoor?.door_number}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCompleteDoor}>
            <Form.Group className="mb-3">
              <Form.Label>Signature</Form.Label>
              <div className="signature-container">
                <SignatureCanvas
                  ref={(ref) => { sigCanvas = ref; }}
                  penColor="black"
                  canvasProps={{ className: 'signature-canvas' }}
                  onEnd={handleSignatureEnd}
                />
              </div>
              <Button 
                variant="outline-secondary" 
                size="sm"
                onClick={handleSignatureClear}
              >
                Clear
              </Button>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Photo of Completed Door</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Video of Door Operation</Form.Label>
              <Form.Control
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                required
              />
            </Form.Group>
            
            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
              <Button 
                variant="secondary" 
                onClick={() => setShowCompleteModal(false)}
                className="me-md-2"
              >
                Cancel
              </Button>
              <Button 
                variant="success" 
                type="submit"
                disabled={isSubmitting || !signature || !photo || !video}
              >
                {isSubmitting ? 'Submitting...' : 'Mark as Completed'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default JobDetails;
