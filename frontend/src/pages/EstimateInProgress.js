import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Alert, Row, Col, Spinner, ListGroup, Form, InputGroup } from 'react-bootstrap';
import { FaArrowLeft, FaCheck, FaVolumeUp, FaTrash, FaServer, FaSync, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import AudioRecorder from '../components/audio/AudioRecorder';
import { getEstimate, updateEstimateWithDoors } from '../services/estimateService';
import { getCustomer } from '../services/customerService';
import { getAudioRecordings, transcribeAudio, processAudioWithAI, deleteAudio } from '../services/audioService';
import { createBid, addDoorsToBid } from '../services/bidService';
import './EstimateInProgress.css';

const EstimateInProgress = () => {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  
  // State management
  const [estimate, setEstimate] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [doors, setDoors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState('');
  const [savingDoors, setSavingDoors] = useState(false);
  const [doorsUpdated, setDoorsUpdated] = useState(false);
  
  // Edit mode state
  const [editingDoorId, setEditingDoorId] = useState(null);
  const [editingDoorDetails, setEditingDoorDetails] = useState([]);
  const [editingDoorDescription, setEditingDoorDescription] = useState('');
  
  // Audio playback state
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  
  /**
   * Safely execute API call with error handling
   * @param {Function} apiCall - The API function to call
   * @param {string} errorMessage - Custom error message to display
   * @param {Function} onSuccess - Callback for successful API call
   * @param {boolean} isCritical - If true, sets connectionError state on failure
   * @returns {Promise<any>} - The API call result or null on error
   */
  const safeApiCall = useCallback(async (apiCall, errorMessage, onSuccess, isCritical = false) => {
    try {
      const result = await apiCall();
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess(result);
      }
      return result;
    } catch (err) {
      console.error(`${errorMessage}:`, err);
      
      // Determine if this is a network/connection error
      const isNetworkError = 
        err.message === 'Network Error' || 
        err.code === 'ERR_NETWORK' ||
        !err.response;
      
      if (isNetworkError && isCritical) {
        setConnectionError(true);
        setError('Unable to connect to the server. Please check that the backend is running and try again.');
      } else {
        setError(`${errorMessage}: ${err.message || 'Unknown error'}`);
      }
      
      return null;
    }
  }, []);
  
  // Define loadData using useCallback to prevent infinite loops with useEffect
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConnectionError(false);
    
    // Get estimate data
    const estimateData = await safeApiCall(
      () => getEstimate(estimateId),
      'Failed to load estimate data',
      (data) => setEstimate(data),
      true // Critical - set connection error if this fails
    );
    
    // If estimate loaded successfully, get customer data
    if (estimateData && estimateData.customer_id) {
      await safeApiCall(
        () => getCustomer(estimateData.customer_id),
        'Failed to load customer data',
        (data) => setCustomer(data)
      );
    }
    
    // Try to load recordings (non-critical)
    await safeApiCall(
      () => getAudioRecordings(estimateId),
      'Failed to load audio recordings',
      (data) => setRecordings(data || [])
    );
    
    // If the estimate has saved doors, load them
    if (estimateData && estimateData.doors && estimateData.doors.length > 0) {
      setDoors(estimateData.doors);
    }
    
    setLoading(false);
  }, [estimateId]);
  
  // Load data when component mounts or estimateId changes
  useEffect(() => {
    if (estimateId) {
      loadData();
    }
    
    // Cleanup function for audio
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
      }
    };
  }, [estimateId, currentAudio, loadData]);
  
  /**
   * Handle retrying data load after connection error
   */
  const handleRetry = () => {
    loadData();
  };
  
  /**
   * Save doors to estimate
   */
  const saveDoorsToEstimate = async () => {
    setSavingDoors(true);
    setError(null);
    
    try {
      // Check if doors array is valid before attempting to save
      if (!doors || !Array.isArray(doors)) {
        setError('No valid door data to save');
        return null;
      }
      
      // Validate each door has required properties before saving
      const validDoors = doors.map(door => {
        // Ensure each door has the required properties
        return {
          id: door.id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          door_number: door.door_number,
          description: door.description || `Door #${door.door_number}`,
          details: Array.isArray(door.details) ? door.details : []
        };
      });
      
      // Log the data being saved (for debugging)
      console.log(`Saving ${validDoors.length} doors to estimate ${estimateId}...`);
      
      const result = await safeApiCall(
        () => updateEstimateWithDoors(estimateId, validDoors),
        'Failed to save doors to estimate',
        null,
        false
      );
      
      if (result) {
        setDoorsUpdated(true);
        
        // Reset the flag after 3 seconds
        setTimeout(() => {
          setDoorsUpdated(false);
        }, 3000);
        
        return result;
      } else {
        // If no result but no error was thrown, show a generic message
        setError('Unable to save doors. Please check your server connection.');
        return null;
      }
    } catch (err) {
      setError(`Error saving doors: ${err.message || 'Unknown error'}`);
      console.error('Save doors error:', err);
      return null;
    } finally {
      setSavingDoors(false);
    }
  };
  
  /**
   * Handle successful upload of an audio recording
   */
  const handleAudioUploaded = async (recording) => {
    try {
      setIsProcessing(true);
      setError(null);
      
      // First add the recording to the list
      setRecordings(prev => [...prev, recording]);
      
      // Step 1: Transcribe the audio
      const transcribeResponse = await safeApiCall(
        () => transcribeAudio(recording.id),
        'Error transcribing audio'
      );
      
      if (!transcribeResponse) {
        setIsProcessing(false);
        return;
      }
      
      // Step 2: Process with AI
      const processResponse = await safeApiCall(
        () => processAudioWithAI(recording.id),
        'Error processing audio with AI'
      );
      
      if (!processResponse) {
        setIsProcessing(false);
        return;
      }
      
      // Step 3: Add doors from processing
      if (processResponse.doors && processResponse.doors.length > 0) {
        // Find the highest door number in the existing doors list
        let highestDoorNumber = 0;
        doors.forEach(door => {
          const doorNum = parseInt(door.door_number, 10);
          if (!isNaN(doorNum) && doorNum > highestDoorNumber) {
            highestDoorNumber = doorNum;
          }
        });
        
        // Process and renumber the new doors to continue from the highest existing number
        const processedDoors = processResponse.doors.map((door, index) => {
          // Calculate the new door number
          const newDoorNumber = highestDoorNumber + index + 1;
          
          // Generate a unique ID if one doesn't exist
          if (!door.id) {
            door.id = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }
          
          // Extract location from details
          let location = "";
          if (door.details && door.details.length > 0) {
            for (const detail of door.details) {
              if (detail.startsWith("Location:")) {
                location = detail.split("Location:")[1].trim();
                break;
              }
            }
          }
          
          // Update door details that might reference the old door number
          const updatedDetails = door.details.map(detail => {
            // If the detail references the original door number, update it
            if (detail.includes(`Door #${door.door_number}`)) {
              return detail.replace(`Door #${door.door_number}`, `Door #${newDoorNumber}`);
            }
            return detail;
          });
          
          // Create updated door object with new door number
          return {
            ...door,
            door_number: newDoorNumber,
            details: updatedDetails,
            description: location ? `Door #${newDoorNumber} (${location})` : `Door #${newDoorNumber}`,
          };
        });
        
        console.log(`Added ${processedDoors.length} doors starting from #${highestDoorNumber + 1}`);
        
        // Add the new doors to the existing doors list
        setDoors(prev => [...prev, ...processedDoors]);
        
        // Automatically save doors to estimate after processing
        await saveDoorsToEstimate();
      }
      
      // Refresh recordings to get updated transcripts
      await safeApiCall(
        () => getAudioRecordings(estimateId),
        'Failed to refresh recordings',
        (data) => setRecordings(data || [])
      );
      
    } finally {
      setIsProcessing(false);
    }
  };
  
  /**
   * Handle playing an audio recording
   */
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
    const apiBasePath = window.location.origin;
    const audioPath = filePath.startsWith('http') 
      ? filePath 
      : `${apiBasePath}/${filePath.replace(/^\//, '')}`;
    
    const audio = new Audio(audioPath);
    
    // Add event listeners
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentPlayingId(null);
    });
    
    audio.addEventListener('error', (err) => {
      console.error('Error playing audio:', err);
      setError(`Unable to play audio recording. The file may be missing or inaccessible.`);
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
        setError(`Failed to play audio: ${err.message || 'Unknown error'}`);
      });
  };
  
  /**
   * Handle deleting a recording
   */
  const handleDeleteRecording = async (recordingId) => {
    const confirmed = window.confirm('Are you sure you want to delete this recording?');
    if (!confirmed) return;
    
    try {
      const result = await safeApiCall(
        () => deleteAudio(recordingId),
        'Failed to delete recording'
      );
      
      if (result) {
        // Update recordings list
        setRecordings(prev => prev.filter(rec => rec.id !== recordingId));
      }
    } catch (err) {
      // Error already handled by safeApiCall
    }
  };
  
  /**
   * Handle editing a door
   */
  const handleEditDoor = (door) => {
    setEditingDoorId(door.id);
    setEditingDoorDetails([...door.details]);
    setEditingDoorDescription(door.description);
  };
  
  /**
   * Handle updating a door detail during edit
   */
  const handleUpdateDoorDetail = (index, value) => {
    const updatedDetails = [...editingDoorDetails];
    updatedDetails[index] = value;
    setEditingDoorDetails(updatedDetails);
  };
  
  /**
   * Add a new blank detail to a door being edited
   */
  const handleAddDoorDetail = () => {
    setEditingDoorDetails([...editingDoorDetails, '']);
  };
  
  /**
   * Remove a detail from a door being edited
   */
  const handleRemoveDoorDetail = (index) => {
    const updatedDetails = [...editingDoorDetails];
    updatedDetails.splice(index, 1);
    setEditingDoorDetails(updatedDetails);
  };
  
  /**
   * Save edited door
   */
  const handleSaveDoorEdit = () => {
    // Find the door in the doors array and update it
    const updatedDoors = doors.map(door => {
      if (door.id === editingDoorId) {
        return {
          ...door,
          description: editingDoorDescription,
          details: editingDoorDetails.filter(detail => detail.trim() !== '') // Remove empty details
        };
      }
      return door;
    });
    
    setDoors(updatedDoors);
    setEditingDoorId(null);
    setEditingDoorDetails([]);
    setEditingDoorDescription('');
    
    // Save the updated doors to the estimate
    saveDoorsToEstimate();
  };

  const handleReprocessAudio = async (recordingId) => {
    try {
      setIsProcessing(true);
      setError(null);
      
      // Find the recording in the recordings list
      const recording = recordings.find(rec => rec.id === recordingId);
      if (!recording) {
        setError('Recording not found');
        setIsProcessing(false);
        return;
      }
  
      // Set temporary notification
      setSubmissionProgress(`Reprocessing recording ${recording.id}...`);
      
      // Step 1: Transcribe the audio (in case it wasn't transcribed properly before)
      const transcribeResponse = await safeApiCall(
        () => transcribeAudio(recordingId),
        'Error transcribing audio'
      );
      
      if (!transcribeResponse) {
        setIsProcessing(false);
        setSubmissionProgress('');
        return;
      }
  
      setSubmissionProgress('Extracting door information with AI...');
      
      // Step 2: Process with AI
      const processResponse = await safeApiCall(
        () => processAudioWithAI(recordingId),
        'Error processing audio with AI'
      );
      
      if (!processResponse) {
        setIsProcessing(false);
        setSubmissionProgress('');
        return;
      }
      
      // Step 3: Add doors from processing
      if (processResponse.doors && processResponse.doors.length > 0) {
        setSubmissionProgress(`Processing ${processResponse.doors.length} doors...`);
        
        // Find the highest door number in the existing doors list
        let highestDoorNumber = 0;
        doors.forEach(door => {
          const doorNum = parseInt(door.door_number, 10);
          if (!isNaN(doorNum) && doorNum > highestDoorNumber) {
            highestDoorNumber = doorNum;
          }
        });
        
        // Process and renumber the new doors to continue from the highest existing number
        const processedDoors = processResponse.doors.map((door, index) => {
          // Calculate the new door number
          const newDoorNumber = highestDoorNumber + index + 1;
          
          // Generate a unique ID if one doesn't exist
          if (!door.id) {
            door.id = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }
          
          // Extract location from details
          let location = "";
          if (door.details && door.details.length > 0) {
            for (const detail of door.details) {
              if (detail.startsWith("Location:")) {
                location = detail.split("Location:")[1].trim();
                break;
              }
            }
          }
          
          // Update door details that might reference the old door number
          const updatedDetails = door.details.map(detail => {
            // If the detail references the original door number, update it
            if (detail.includes(`Door #${door.door_number}`)) {
              return detail.replace(`Door #${door.door_number}`, `Door #${newDoorNumber}`);
            }
            return detail;
          });
          
          // Create updated door object with new door number
          return {
            ...door,
            door_number: newDoorNumber,
            details: updatedDetails,
            description: location ? `Door #${newDoorNumber} (${location})` : `Door #${newDoorNumber}`,
          };
        });
        
        console.log(`Added ${processedDoors.length} doors starting from #${highestDoorNumber + 1}`);
        
        // Add the new doors to the existing doors list
        setDoors(prev => [...prev, ...processedDoors]);
        
        // Automatically save doors to estimate after processing
        setSubmissionProgress('Saving doors to estimate...');
        await saveDoorsToEstimate();
      } else {
        setError('No door information could be extracted from this recording.');
      }
      
      // Refresh recordings to get updated transcripts
      await safeApiCall(
        () => getAudioRecordings(estimateId),
        'Failed to refresh recordings',
        (data) => setRecordings(data || [])
      );
      
      setSubmissionProgress('');
      
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Cancel door edit
   */
  const handleCancelDoorEdit = () => {
    setEditingDoorId(null);
    setEditingDoorDetails([]);
    setEditingDoorDescription('');
  };
  
  /**
   * Remove a door from the list
   */
  const handleRemoveDoor = (doorId) => {
    const confirmed = window.confirm('Are you sure you want to remove this door?');
    if (!confirmed) return;
    
    // Remove the door from the doors array
    const updatedDoors = doors.filter(door => door.id !== doorId);
    setDoors(updatedDoors);
    
    // Save the updated doors to the estimate
    saveDoorsToEstimate();
  };
  
  /**
   * Handle submitting the estimate to create a bid
   */
  const handleSubmitToBid = async () => {
    if (doors.length === 0) {
      setError('No doors to submit. Please record and process audio first.');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    setSubmissionProgress('Creating bid...');
    
    try {
      // Step 1: Create a new bid
      const bidResponse = await safeApiCall(
        () => createBid(estimateId),
        'Failed to create bid'
      );
      
      if (!bidResponse) {
        setSubmitting(false);
        return;
      }
      
      const bidId = bidResponse.id;
      setSubmissionProgress(`Adding ${doors.length} doors to bid...`);
      
      // Step 2: Add all the doors to the bid
      const doorsResponse = await safeApiCall(
        () => addDoorsToBid(bidId, doors),
        'Failed to add doors to bid'
      );
      
      if (!doorsResponse) {
        setSubmitting(false);
        return;
      }
      
      setSubmissionProgress('Finalizing bid...');
      
      // Success!
      setSubmitSuccess(true);
      setSubmissionProgress('Bid created successfully!');
      
      // Navigate to the bid page after a short delay
      setTimeout(() => {
        navigate(`/bids/${bidId}`);
      }, 2000);
      
    } finally {
      setSubmitting(false);
    }
  };
  
  // Connection error state - show a user-friendly message
  if (connectionError) {
    return (
      <div className="connection-error-container p-5 text-center">
        <FaServer size={48} className="text-danger mb-3" />
        <h3>Server Connection Error</h3>
        <p>
          Unable to connect to the backend server. Please ensure that:
        </p>
        <ul className="list-unstyled">
          <li>The backend server is running at http://127.0.0.1:5000</li>
          <li>No firewall or network issues are blocking the connection</li>
          <li>The API endpoint is configured correctly</li>
        </ul>
        <Button 
          variant="primary" 
          onClick={handleRetry}
          className="mt-3"
        >
          <FaSync className="me-2" /> Retry Connection
        </Button>
        <Button 
          variant="outline-secondary" 
          onClick={() => navigate('/estimates')}
          className="mt-3 ms-3"
        >
          <FaArrowLeft className="me-2" /> Back to Estimates
        </Button>
      </div>
    );
  }
  
  // Loading state
  if (loading) {
    return (
      <div className="loading-container text-center p-5">
        <Spinner animation="border" />
        <p className="mt-3">Loading estimate data...</p>
      </div>
    );
  }
  
  return (
    <div className="estimate-in-progress-container">
      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center">
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate('/estimates')}
            className="me-3"
          >
            <FaArrowLeft className="me-2" /> Back to Estimates
          </Button>
          <h2 className="mb-0">Estimate Details</h2>
        </div>
      </div>
      
      {error && (
        <Alert 
          variant="danger" 
          dismissible 
          onClose={() => setError(null)}
          className="mb-4"
        >
          {error}
        </Alert>
      )}
      
      {submitSuccess && (
        <Alert variant="success" className="mb-4">
          Successfully submitted to bid! Redirecting...
        </Alert>
      )}
      
      {doorsUpdated && (
        <Alert variant="success" dismissible onClose={() => setDoorsUpdated(false)} className="mb-4">
          Door information successfully saved!
        </Alert>
      )}
      
      <Card className="customer-info-card mb-4">
        <Card.Header>Customer Information</Card.Header>
        <Card.Body>
          {customer ? (
            <Row>
              <Col md={6}>
                <p><strong>Name:</strong> {customer.name}</p>
                <p><strong>Site:</strong> {estimate?.site_name || 'N/A'}</p>
                <p><strong>Site Address:</strong> {estimate?.site_address || 'N/A'}</p>
              </Col>
              <Col md={6}>
                <p><strong>Onsite Contact:</strong> {estimate?.site_contact_name || 'N/A'}</p>
                <p><strong>Phone:</strong> {estimate?.site_phone || 'N/A'}</p>
                <p><strong>Lockbox Location:</strong> {estimate?.site_lockbox_location || 'N/A'}</p>
              </Col>
            </Row>
          ) : (
            <p className="mb-0">No customer information available.</p>
          )}
        </Card.Body>
      </Card>
      
      {/* Only show this section if the estimate is pending (not converted to bid) */}
      {estimate && estimate.status === 'pending' && (
        <>
          <Card className="audio-recorder-card mb-4">
            <Card.Header>Record Door Information</Card.Header>
            <Card.Body>
              <p className="mb-3">
                Record audio notes for each door. Speak clearly and include dimensions, 
                specifications, and any special details about the doors.
              </p>
              <AudioRecorder 
                estimateId={estimateId} 
                onAudioUploaded={handleAudioUploaded}
                onError={(err) => setError(err.message || 'Error with audio recording')}
              />
              
              {isProcessing && (
                <div className="processing-indicator mt-3 d-flex align-items-center">
                  <Spinner animation="border" size="sm" className="me-2" />
                  <span>Processing recording... (transcribing and extracting door information)</span>
                </div>
              )}
            </Card.Body>
          </Card>
          
          {recordings.length > 0 && (
            <Card className="audio-recordings-card mb-4">
              <Card.Header>Saved Recordings</Card.Header>
              <Card.Body>
                <ListGroup>
                  {recordings.map((recording, index) => (
                    <ListGroup.Item key={recording.id} className="recording-list-item">
                      <div className="d-flex flex-column flex-md-row justify-content-between w-100">
                        <div className="recording-info flex-grow-1 mb-2 mb-md-0 me-md-3">
                          <strong>Recording {index + 1}</strong>
                          <p className="text-muted small mb-1">
                            {new Date(recording.created_at).toLocaleString()}
                          </p>
                          {recording.transcript && (
                            <div className="transcript-text mt-2 mb-2">
                              <small className="text-wrap"><strong>Transcript:</strong> {recording.transcript}</small>
                            </div>
                          )}
                        </div>
                        <div className="recording-actions d-flex flex-wrap justify-content-start justify-content-md-end align-items-center mt-2 mt-md-0">
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-2 mb-2 mb-md-0"
                            onClick={() => handlePlayAudio(recording.file_path, recording.id)}
                          >
                            <FaVolumeUp className="me-1" /> {isPlaying && currentPlayingId === recording.id ? 'Pause' : 'Play'}
                          </Button>
                          <Button 
                            variant="outline-info" 
                            size="sm" 
                            className="me-2 mb-2 mb-md-0"
                            onClick={() => handleReprocessAudio(recording.id)}
                            disabled={isProcessing}
                            title="Reprocess this recording to extract door information again"
                          >
                            <FaSync className="me-1" /> Reprocess
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            className="mb-2 mb-md-0"
                            onClick={() => handleDeleteRecording(recording.id)}
                          >
                            <FaTrash className="me-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card.Body>
            </Card>
          )}
          
          {doors.length > 0 && (
            <Card className="door-information-card mb-4">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <span>Extracted Door Information</span>
                <div>
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={saveDoorsToEstimate}
                    disabled={savingDoors || editingDoorId !== null}
                  >
                    {savingDoors ? (
                      <>
                        <Spinner 
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-1"
                        />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FaSave className="me-1" /> 
                        Save Doors
                      </>
                    )}
                  </Button>
                </div>
              </Card.Header>
              <Card.Body>
                {error && error.includes('save') && (
                  <Alert 
                    variant="danger" 
                    dismissible 
                    onClose={() => setError(null)}
                    className="mb-3"
                  >
                    <p className="mb-0"><strong>Save Error:</strong> {error}</p>
                    <p className="mb-0 mt-2 small">
                      <strong>Troubleshooting:</strong> Ensure the backend server is running and the
                      endpoint for saving doors is properly implemented.
                    </p>
                  </Alert>
                )}
                
                <p className="text-muted mb-3">
                  <small>
                    You have {doors.length} door{doors.length !== 1 ? 's' : ''} in this estimate. 
                    Record additional audio to add more doors, or use the buttons below to edit or remove existing doors.
                  </small>
                </p>
                
                <ListGroup>
                  {doors.map((door) => (
                    <ListGroup.Item key={door.id || `door-${door.door_number}`}>
                      {editingDoorId === door.id ? (
                        <div className="door-edit-container">
                          <Form.Group className="mb-3">
                            <Form.Label>Door Description</Form.Label>
                            <Form.Control
                              type="text"
                              value={editingDoorDescription}
                              onChange={(e) => setEditingDoorDescription(e.target.value)}
                            />
                          </Form.Group>
                          
                          <Form.Group className="mb-3">
                            <Form.Label>Door Details</Form.Label>
                            {editingDoorDetails.map((detail, index) => (
                              <InputGroup className="mb-2" key={index}>
                                <Form.Control
                                  type="text"
                                  value={detail}
                                  onChange={(e) => handleUpdateDoorDetail(index, e.target.value)}
                                />
                                <Button
                                  variant="outline-danger"
                                  onClick={() => handleRemoveDoorDetail(index)}
                                >
                                  <FaTimes />
                                </Button>
                              </InputGroup>
                            ))}
                            <Button 
                              variant="outline-secondary" 
                              size="sm"
                              onClick={handleAddDoorDetail}
                              className="mt-2"
                            >
                              + Add Detail
                            </Button>
                          </Form.Group>
                          
                          <div className="d-flex justify-content-end">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="me-2"
                              onClick={handleCancelDoorEdit}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="success"
                              size="sm"
                              onClick={handleSaveDoorEdit}
                            >
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <h5>{door.description}</h5>
                            <ul className="mb-0">
                              {door.details.map((detail, index) => (
                                <li key={index}>{detail}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="me-2"
                              onClick={() => handleEditDoor(door)}
                            >
                              <FaEdit className="me-1" /> Edit
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleRemoveDoor(door.id)}
                            >
                              <FaTrash className="me-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      )}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card.Body>
            </Card>
          )}
          
          {doors.length > 0 && (
            <div className="submit-actions mb-4">
              <Button 
                variant="success" 
                size="lg"
                onClick={handleSubmitToBid}
                disabled={submitting || submitSuccess || editingDoorId !== null}
                className="submit-button"
              >
                <FaCheck className="me-2" /> Submit to Bid
              </Button>
              
              {submitting && (
                <div className="submitting-indicator mt-3 d-flex align-items-center">
                  <Spinner animation="border" size="sm" className="me-2" />
                  <span>
                    {submissionProgress || 'Submitting...'}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
      
      {/* If the estimate is already converted to a bid, show a message */}
      {estimate && estimate.status === 'converted' && (
        <Card className="mb-4">
          <Card.Body>
            <Alert variant="info" className="mb-0">
              <h5>This estimate has been converted to a bid</h5>
              <p>You can view and manage the bid details from the bids page.</p>
              <Button 
                variant="primary"
                onClick={() => navigate(`/bids?estimateId=${estimateId}`)}
              >
                View Associated Bid
              </Button>
            </Alert>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default EstimateInProgress;