
import React, { useState } from 'react';
import { Button, Alert, Spinner, Card, Accordion } from 'react-bootstrap';
import { FaCog, FaEdit, FaCheck, FaTrash, FaPlus } from 'react-icons/fa';
import { transcribeAudio, processAudio } from '../../services/audioService';
import './AudioProcessor.css';

const AudioProcessor = ({ recordings, onProcessingComplete, onError }) => {
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState(null);
  const [transcripts, setTranscripts] = useState({});
  const [doors, setDoors] = useState([]);
  const [editingDoor, setEditingDoor] = useState(null);
  
  const handleTranscribe = async (recordingId) => {
    setProcessing(true);
    setProcessingStep('Transcribing audio...');
    setError(null);
    
    try {
      const response = await transcribeAudio(recordingId);
      
      // Update transcripts
      setTranscripts(prev => ({
        ...prev,
        [recordingId]: response.transcript
      }));
      
    } catch (err) {
      setError('Failed to transcribe audio. Please try again.');
      console.error('Error transcribing audio:', err);
      
      if (onError) {
        onError(err);
      }
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  };
  
  const handleProcessRecording = async (recordingId) => {
    if (!transcripts[recordingId]) {
      await handleTranscribe(recordingId);
    }
    
    setProcessing(true);
    setProcessingStep('Processing doors...');
    
    try {
      const response = await processAudio(recordingId);
      
      // Add the new doors to the list
      setDoors(prev => [...prev, ...response.doors]);
      
    } catch (err) {
      setError('Failed to process doors from recording. Please try again.');
      console.error('Error processing doors:', err);
      
      if (onError) {
        onError(err);
      }
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  };
  
  const handleProcessAll = async () => {
    setProcessing(true);
    setError(null);
    
    try {
      // First transcribe all recordings that haven't been transcribed
      for (const recording of recordings) {
        if (!transcripts[recording.id]) {
          setProcessingStep(`Transcribing recording ${recording.id}...`);
          await handleTranscribe(recording.id);
        }
      }
      
      // Then process all recordings
      const allDoors = [];
      for (const recording of recordings) {
        setProcessingStep(`Processing doors from recording ${recording.id}...`);
        const response = await processAudio(recording.id);
        allDoors.push(...response.doors);
      }
      
      // Update doors list
      setDoors(allDoors);
      
      // Notify parent component
      if (onProcessingComplete) {
        onProcessingComplete(allDoors);
      }
      
    } catch (err) {
      setError('An error occurred during processing. Please try again.');
      console.error('Error in batch processing:', err);
      
      if (onError) {
        onError(err);
      }
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  };
  
  const startEditingDoor = (door) => {
    setEditingDoor({
      ...door,
      details: [...door.details]
    });
  };
  
  const handleDoorChange = (field, value) => {
    setEditingDoor(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleDetailChange = (index, value) => {
    const newDetails = [...editingDoor.details];
    newDetails[index] = value;
    
    setEditingDoor(prev => ({
      ...prev,
      details: newDetails
    }));
  };
  
  const addDetail = () => {
    setEditingDoor(prev => ({
      ...prev,
      details: [...prev.details, '']
    }));
  };
  
  const removeDetail = (index) => {
    const newDetails = [...editingDoor.details];
    newDetails.splice(index, 1);
    
    setEditingDoor(prev => ({
      ...prev,
      details: newDetails
    }));
  };
  
  const saveDoorChanges = () => {
    setDoors(prev => 
      prev.map(door => 
        door.id === editingDoor.id ? editingDoor : door
      )
    );
    
    setEditingDoor(null);
  };
  
  const cancelEditing = () => {
    setEditingDoor(null);
  };
  
  const removeDoor = (doorId) => {
    setDoors(prev => prev.filter(door => door.id !== doorId));
  };
  
  return (
    <div className="audio-processor-container">
      {error && <Alert variant="danger">{error}</Alert>}
      
      {recordings.length > 0 && (
        <>
          <div className="process-controls">
            <Button 
              variant="primary" 
              onClick={handleProcessAll} 
              disabled={processing || recordings.length === 0}
              className="process-button"
            >
              <FaCog /> Process All Recordings
            </Button>
            
            {processing && (
              <div className="processing-status">
                <Spinner animation="border" size="sm" />
                <span>{processingStep}</span>
              </div>
            )}
          </div>
          
          <div className="transcripts-section">
            <h5>Audio Transcripts</h5>
            <Accordion>
              {recordings.map((recording) => (
                <Accordion.Item key={recording.id} eventKey={recording.id.toString()}>
                  <Accordion.Header>
                    Recording {recording.id}
                    {!transcripts[recording.id] && (
                      <Button 
                        variant="outline-primary" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTranscribe(recording.id);
                        }}
                        disabled={processing}
                        className="ms-2"
                      >
                        Transcribe
                      </Button>
                    )}
                  </Accordion.Header>
                  <Accordion.Body>
                    {transcripts[recording.id] ? (
                      <>
                        <div className="transcript-text">
                          {transcripts[recording.id]}
                        </div>
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          onClick={() => handleProcessRecording(recording.id)}
                          disabled={processing}
                          className="mt-2"
                        >
                          <FaCog /> Process Doors
                        </Button>
                      </>
                    ) : (
                      <p>No transcript available. Click 'Transcribe' to generate.</p>
                    )}
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          </div>
        </>
      )}
      
      {doors.length > 0 && (
        <div className="doors-section">
          <h5>Identified Doors</h5>
          {doors.map((door) => (
            <Card key={door.id} className="door-card">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <span>Door #{door.door_number}</span>
                <div>
                  <Button 
                    variant="outline-primary" 
                    size="sm" 
                    onClick={() => startEditingDoor(door)}
                    disabled={editingDoor !== null}
                    className="me-2"
                  >
                    <FaEdit />
                  </Button>
                  <Button 
                    variant="outline-danger" 
                    size="sm" 
                    onClick={() => removeDoor(door.id)}
                    disabled={editingDoor !== null}
                  >
                    <FaTrash />
                  </Button>
                </div>
              </Card.Header>
              <Card.Body>
                {editingDoor && editingDoor.id === door.id ? (
                  <div className="door-edit-form">
                    <div className="form-group mb-3">
                      <label>Door Number</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={editingDoor.door_number}
                        onChange={(e) => handleDoorChange('door_number', e.target.value)}
                      />
                    </div>
                    
                    <div className="form-group mb-3">
                      <label>Description</label>
                      <textarea 
                        className="form-control" 
                        value={editingDoor.description}
                        onChange={(e) => handleDoorChange('description', e.target.value)}
                        rows={3}
                      />
                    </div>
                    
                    <div className="form-group mb-3">
                      <label>Details</label>
                      {editingDoor.details.map((detail, index) => (
                        <div key={index} className="detail-input-group">
                          <input 
                            type="text" 
                            className="form-control" 
                            value={detail}
                            onChange={(e) => handleDetailChange(index, e.target.value)}
                          />
                          <Button 
                            variant="outline-danger" 
                            size="sm" 
                            onClick={() => removeDetail(index)}
                          >
                            <FaTrash />
                          </Button>
                        </div>
                      ))}
                      <Button 
                        variant="outline-secondary" 
                        size="sm" 
                        onClick={addDetail}
                        className="mt-2"
                      >
                        <FaPlus /> Add Detail
                      </Button>
                    </div>
                    
                    <div className="door-edit-actions">
                      <Button 
                        variant="primary" 
                        onClick={saveDoorChanges}
                        className="me-2"
                      >
                        <FaCheck /> Save
                      </Button>
                      <Button 
                        variant="secondary" 
                        onClick={cancelEditing}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="door-description">{door.description}</p>
                    
                    {door.details.length > 0 && (
                      <div className="door-details">
                        <h6>Details:</h6>
                        <ul>
                          {door.details.map((detail, index) => (
                            <li key={index}>{detail}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioProcessor;
