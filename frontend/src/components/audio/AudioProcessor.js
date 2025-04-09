import React, { useState } from 'react';
import { Button, Alert, Spinner, Card, Accordion, Badge } from 'react-bootstrap';
import { FaCog, FaEdit, FaCheck, FaTrash, FaPlus, FaRobot } from 'react-icons/fa';
import { transcribeAudio, processAudio, processAudioWithAI } from '../../services/audioService';
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
  
  const handleProcessRecording = async (recordingId, useAI = true) => {
    if (!transcripts[recordingId]) {
      await handleTranscribe(recordingId);
    }
    
    setProcessing(true);
    setProcessingStep(useAI ? 'Processing doors with AI...' : 'Processing doors...');
    
    try {
      // Use AI processing if requested, otherwise use regular processing
      const response = useAI 
        ? await processAudioWithAI(recordingId)
        : await processAudio(recordingId);
      
      // Add the new doors to the list
      setDoors(prev => [...prev, ...response.doors]);
      
    } catch (err) {
      setError(`Failed to process doors from recording. ${err.response?.data?.error || 'Please try again.'}`);
      console.error('Error processing doors:', err);
      
      if (onError) {
        onError(err);
      }
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  };
  
  const handleProcessAll = async (useAI = true) => {
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
        setProcessingStep(useAI 
          ? `Processing doors from recording ${recording.id} with AI...` 
          : `Processing doors from recording ${recording.id}...`);
        
        // Use AI processing if requested, otherwise use regular processing
        const response = useAI 
          ? await processAudioWithAI(recording.id)
          : await processAudio(recording.id);
        
        allDoors.push(...response.doors);
      }
      
      // Update doors list
      setDoors(allDoors);
      
      // Notify parent component
      if (onProcessingComplete) {
        onProcessingComplete(allDoors);
      }
      
    } catch (err) {
      setError(`An error occurred during processing. ${err.response?.data?.error || 'Please try again.'}`);
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
            <div className="btn-group" role="group">
              <Button 
                variant="primary" 
                onClick={() => handleProcessAll(true)} 
                disabled={processing || recordings.length === 0}
                className="process-button"
              >
                <FaRobot /> Process All with AI
              </Button>
              <Button 
                variant="outline-primary" 
                onClick={() => handleProcessAll(false)} 
                disabled={processing || recordings.length === 0}
                className="process-button"
              >
                <FaCog /> Process All (Basic)
              </Button>
            </div>
            
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
                    <div className="d-flex w-100 justify-content-between align-items-center">
                      <span>Recording {recording.id}</span>
                      {!transcripts[recording.id] && (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTranscribe(recording.id);
                          }}
                        >
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            disabled={processing}
                            className="ms-2"
                          >
                            Transcribe
                          </Button>
                        </span>
                      )}
                    </div>
                  </Accordion.Header>
                  <Accordion.Body>
                    {transcripts[recording.id] ? (
                      <>
                        <div className="transcript-text">
                          {transcripts[recording.id]}
                        </div>
                        <div className="mt-2">
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => handleProcessRecording(recording.id, true)}
                            disabled={processing}
                            className="me-2"
                          >
                            <FaRobot /> Process with AI
                          </Button>
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            onClick={() => handleProcessRecording(recording.id, false)}
                            disabled={processing}
                          >
                            <FaCog /> Process (Basic)
                          </Button>
                        </div>
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
                        <div className="detail-tags">
                          {door.details.map((detail, index) => {
                            // Determine tag type for styling
                            let tagClass = 'detail-tag';
                            if (detail.toLowerCase().startsWith('dimensions:')) {
                              tagClass += ' dimension';
                            } else if (detail.toLowerCase().startsWith('type:')) {
                              tagClass += ' type';
                            } else if (detail.toLowerCase().startsWith('material:')) {
                              tagClass += ' material';
                            } else if (detail.toLowerCase().startsWith('feature:')) {
                              tagClass += ' feature';
                            } else if (detail.toLowerCase().startsWith('labor')) {
                              tagClass += ' labor';
                            } else if (detail.toLowerCase().startsWith('accessory:')) {
                              tagClass += ' accessory';
                            } else if (detail.toLowerCase().startsWith('notes:')) {
                              tagClass += ' note';
                            }
                            
                            return (
                              <span key={index} className={tagClass}>
                                {detail}
                              </span>
                            );
                          })}
                        </div>
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