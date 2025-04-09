import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Alert, Row, Col, Spinner, ListGroup } from 'react-bootstrap';
import { FaArrowLeft, FaCheck, FaFileAlt, FaVolumeUp, FaTrash } from 'react-icons/fa';
import AudioRecorder from '../components/audio/AudioRecorder';
import { getEstimate } from '../services/estimateService';
import { getCustomer } from '../services/customerService';
import { getAudioRecordings, transcribeAudio, processAudioWithAI, deleteAudio } from '../services/audioService';
import { createBid, addDoorsToBid } from '../services/bidService'; // Import the addDoorsToBid function
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(''); // New state for progress updates
  
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
  
  const handleAudioUploaded = async (recording) => {
    try {
      setIsProcessing(true);
      setError(null);
      
      // First add the recording to the list
      setRecordings(prev => [...prev, recording]);
      
      // Step 1: Transcribe the audio
      const transcribeResponse = await transcribeAudio(recording.id);
      console.log('Transcription complete:', transcribeResponse);
      
      // Step 2: Process with AI
      const processResponse = await processAudioWithAI(recording.id);
      console.log('AI processing complete:', processResponse);
      console.log('Doors extracted from AI processing:', JSON.stringify(processResponse.doors));
      
      // Step 3: Add doors from processing
      if (processResponse.doors && processResponse.doors.length > 0) {
        // Ensure each door has a proper description that includes the location
        const processedDoors = processResponse.doors.map(door => {
          // Make sure description is formatted correctly
          let location = "";
          if (door.details && door.details.length > 0) {
            for (const detail of door.details) {
              if (detail.startsWith("Location:")) {
                location = detail.split("Location:")[1].trim();
                console.log(`Found location in door detail: "${location}"`);
                break;
              }
            }
          }
          
          // If description doesn't already include location, update it
          if (location && (!door.description || !door.description.includes(location))) {
            console.log(`Updating door description to include location: Door #${door.door_number} (${location})`);
            door.description = `Door #${door.door_number} (${location})`;
          }
          
          return door;
        });
        
        console.log('Setting doors state with processed doors:', JSON.stringify(processedDoors));
        setDoors(prev => [...prev, ...processedDoors]);
      }
      
      // Refresh recordings to get updated transcripts
      const updatedRecordings = await getAudioRecordings(estimateId);
      setRecordings(updatedRecordings);
      
    } catch (err) {
      setError('Error processing audio: ' + (err.message || 'Unknown error'));
      console.error('Error processing audio:', err);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Reference to the current audio player
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  
  const handlePlayAudio = (filePath, recordingId) => {
    // If there's already audio playing, stop it
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    // If we're clicking the same recording that's playing, just toggle pause/play
    if (isPlaying && currentPlayingId === recordingId) {
      currentAudio.pause();
      setIsPlaying(false);
      return;
    }
    
    // Create audio element with correct path
    // Ensure the path is correct - the API may be at a different path than the React app
    const apiBasePath = window.location.origin; // Use the current origin
    const audioPath = filePath.startsWith('http') 
      ? filePath 
      : `${apiBasePath}/${filePath.replace(/^\//, '')}`; // Remove leading slash if present
    
    console.log('Attempting to play audio from:', audioPath);
    
    const audio = new Audio(audioPath);
    
    // Add event listeners
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentPlayingId(null);
    });
    
    audio.addEventListener('error', (err) => {
      console.error('Error playing audio:', err);
      setError('Unable to play audio recording. Check the file path: ' + audioPath);
      setIsPlaying(false);
      setCurrentPlayingId(null);
    });
    
    // Start playing
    audio.play()
      .then(() => {
        setIsPlaying(true);
        setCurrentAudio(audio);
        setCurrentPlayingId(recordingId);
      })
      .catch(err => {
        console.error('Error playing audio:', err);
        setError('Unable to play audio recording. Error: ' + err.message);
      });
  };
  
  const handleDeleteRecording = async (recordingId) => {
    try {
      await deleteAudio(recordingId);
      
      // Update recordings list
      const updatedRecordings = recordings.filter(rec => rec.id !== recordingId);
      setRecordings(updatedRecordings);
      
    } catch (err) {
      setError('Failed to delete recording. Please try again.');
      console.error('Error deleting recording:', err);
    }
  };
  
  // UPDATED: handleSubmitToBid function to add doors to the bid
  const handleSubmitToBid = async () => {
    if (doors.length === 0) {
      setError('No doors to submit. Please record and process audio first.');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    setSubmissionProgress('Creating bid...');
    
    try {
      console.log('Starting bid submission process with doors:', doors);
      
      // Step 1: Create a new bid
      const bidResponse = await createBid(estimateId);
      const bidId = bidResponse.id;
      console.log('Bid created successfully:', bidId);
      
      setSubmissionProgress(`Adding ${doors.length} doors to bid...`);
      
      // Step 2: Add all the doors to the bid using our new function
      const doorsResponse = await addDoorsToBid(bidId, doors);
      
      setSubmissionProgress('Finalizing bid...');
      console.log('Doors added to bid:', doorsResponse);
      
      // Success!
      setSubmitSuccess(true);
      setSubmissionProgress('Bid created successfully!');
      
      // Navigate to the bid page after a short delay
      setTimeout(() => {
        navigate(`/bids/${bidId}`);
      }, 2000);
      
    } catch (err) {
      console.error('Error submitting to bid:', err);
      setError('Failed to submit to bid: ' + (err.message || 'Unknown error'));
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
        <Card.Header>Record Door Information</Card.Header>
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
          
          {isProcessing && (
            <div className="processing-indicator mt-3">
              <Spinner animation="border" size="sm" className="mr-2" />
              <span>Processing recording... (transcribing and extracting door information)</span>
            </div>
          )}
        </Card.Body>
      </Card>
      
      {recordings.length > 0 && (
        <Card className="audio-recordings-card">
          <Card.Header>Saved Recordings</Card.Header>
          <Card.Body>
            <ListGroup>
              {recordings.map((recording, index) => (
                <ListGroup.Item key={recording.id} className="d-flex justify-content-between align-items-center">
                  <div>
                    <strong>Recording {index + 1}</strong>
                    <p className="text-muted small mb-1">
                      {new Date(recording.created_at).toLocaleString()}
                    </p>
                    {recording.transcript && (
                      <div className="transcript-text mt-2 mb-2">
                        <small><strong>Transcript:</strong> {recording.transcript}</small>
                      </div>
                    )}
                  </div>
                  <div>
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      className="mr-2"
                      onClick={() => handlePlayAudio(recording.file_path, recording.id)}
                    >
                      <FaVolumeUp /> {isPlaying && currentPlayingId === recording.id ? 'Pause' : 'Play'}
                    </Button>
                    <Button 
                      variant="outline-danger" 
                      size="sm"
                      onClick={() => handleDeleteRecording(recording.id)}
                    >
                      <FaTrash /> Delete
                    </Button>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card.Body>
        </Card>
      )}
      
      {doors.length > 0 && (
        <Card className="door-information-card">
          <Card.Header>Extracted Door Information</Card.Header>
          <Card.Body>
            <ListGroup>
              {doors.map((door) => (
                <ListGroup.Item key={door.id}>
                  <h5>{door.description}</h5>
                  <ul>
                    {door.details.map((detail, index) => (
                      <li key={index}>{detail}</li>
                    ))}
                  </ul>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card.Body>
        </Card>
      )}
      
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
              <span>
                {submissionProgress || 'Submitting...'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EstimateInProgress;