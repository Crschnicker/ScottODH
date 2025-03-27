
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Alert, Row, Col, Spinner } from 'react-bootstrap';
import { FaArrowLeft, FaCheck, FaFileAlt } from 'react-icons/fa';
import AudioRecorder from '../components/audio/AudioRecorder';
import AudioProcessor from '../components/audio/AudioProcessor';
import { getEstimate } from '../services/estimateService';
import { getCustomer } from '../services/customerService';
import { getAudioRecordings } from '../services/audioService';
import { createBid } from '../services/bidService';
import './EstimateInProgress.css';

const EstimateInProgress = () => {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  
  const [estimate, setEstimate] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [doors, setDoors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  useEffect(() => {
    loadData();
  }, [estimateId]);
  
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load estimate
      const estimateData = await getEstimate(estimateId);
      setEstimate(estimateData);
      
      // Load customer
      const customerData = await getCustomer(estimateData.customer_id);
      setCustomer(customerData);
      
      // Load recordings
      const recordingsData = await getAudioRecordings(estimateId);
      setRecordings(recordingsData);
      
    } catch (err) {
      setError('Failed to load estimate data. Please try again.');
      console.error('Error loading estimate data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAudioUploaded = (recording) => {
    setRecordings(prev => [...prev, recording]);
  };
  
  const handleProcessingComplete = (processedDoors) => {
    setDoors(processedDoors);
  };
  
  const handleSubmitToBid = async () => {
    if (doors.length === 0) {
      setError('No doors to submit. Please process recordings first.');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      // Create a new bid
      const bidResponse = await createBid(estimateId);
      const bidId = bidResponse.id;
      
      // Create doors in the bid (This would need a new API endpoint)
      // For now, we'll assume success
      
      setSubmitSuccess(true);
      
      // Navigate to the bid page after a short delay
      setTimeout(() => {
        navigate(`/bids/${bidId}`);
      }, 2000);
      
    } catch (err) {
      setError('Failed to submit to bid. Please try again.');
      console.error('Error submitting to bid:', err);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner animation="border" />
        <p>Loading estimate data...</p>
      </div>
    );
  }
  
  return (
    <div className="estimate-in-progress-container">
      <div className="page-header">
        <Button 
          variant="outline-secondary" 
          onClick={() => navigate('/estimates')}
          className="back-button"
        >
          <FaArrowLeft /> Back to Estimates
        </Button>
        <h2>Estimate in Progress</h2>
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {submitSuccess && (
        <Alert variant="success">
          Successfully submitted to bid! Redirecting...
        </Alert>
      )}
      
      <Card className="customer-info-card">
        <Card.Header>Customer Information</Card.Header>
        <Card.Body>
          {customer ? (
            <Row>
              <Col md={6}>
                <p><strong>Name:</strong> {customer.name}</p>
                <p><strong>Address:</strong> {customer.address || 'N/A'}</p>
                <p><strong>Email:</strong> {customer.email || 'N/A'}</p>
              </Col>
              <Col md={6}>
                <p><strong>Onsite Contact:</strong> {customer.contact_name || 'N/A'}</p>
                <p><strong>Phone:</strong> {customer.phone || 'N/A'}</p>
                <p><strong>Lockbox Location:</strong> {customer.lockbox_location || 'N/A'}</p>
              </Col>
            </Row>
          ) : (
            <p>No customer information available.</p>
          )}
        </Card.Body>
      </Card>
      
      <Card className="audio-recorder-card">
        <Card.Header>Record Audio</Card.Header>
        <Card.Body>
          <p>
            Record audio notes for each door. Speak clearly and include dimensions, 
            specifications, and any special details about the doors.
          </p>
          <AudioRecorder 
            estimateId={estimateId} 
            onAudioUploaded={handleAudioUploaded}
            onError={(err) => setError(err.message || 'Error with audio recording')}
          />
        </Card.Body>
      </Card>
      
      <Card className="audio-processor-card">
        <Card.Header>Process Recordings</Card.Header>
        <Card.Body>
          <p>
            Process your recordings to extract door information. You can review and edit 
            the extracted information before submitting to a bid.
          </p>
          <AudioProcessor 
            recordings={recordings}
            onProcessingComplete={handleProcessingComplete}
            onError={(err) => setError(err.message || 'Error processing recordings')}
          />
        </Card.Body>
      </Card>
      
      {doors.length > 0 && (
        <div className="submit-actions">
          <Button 
            variant="success" 
            size="lg"
            onClick={handleSubmitToBid}
            disabled={submitting || submitSuccess}
            className="submit-button"
          >
            <FaCheck /> Submit to Bid
          </Button>
          
          {submitting && (
            <div className="submitting-indicator">
              <Spinner animation="border" size="sm" />
              <span>Submitting...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EstimateInProgress;
