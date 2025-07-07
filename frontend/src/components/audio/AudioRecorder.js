// AudioRecorder.js - With improved upload handling
import React, { useState, useRef } from 'react';
import { Button, Alert, Spinner, Form } from 'react-bootstrap';
import { FaMicrophone, FaStop, FaCheck, FaUndo, FaUpload, FaVolumeUp } from 'react-icons/fa';
import './AudioRecorder.css';

// Import the iOS-specific component
import IOSAudioRecorder from './IOSAudioRecorder';

// =================================================================
// === ADD THIS IMPORT TO USE YOUR CONFIGURED AXIOS INSTANCE       ===
// =================================================================
import api from '../../services/api'; 
// =================================================================

const AudioRecorder = ({ estimateId, onAudioUploaded, onError }) => {
  // Detect if running on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  // States for all devices
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  
  // Refs for all devices
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // If on iOS, render the iOS-specific component
  if (isIOS) {
    return (
      <IOSAudioRecorder 
        estimateId={estimateId}
        onAudioUploaded={onAudioUploaded}
        onError={onError}
      />
    );
  }
  
  // Regular implementation for non-iOS devices
  const startRecording = async () => {
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setSelectedFile(audioBlob);
        setAudioUrl(url);
        setIsRecording(false);
        setRecordingComplete(true);
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please try again or use the file upload option.');
      if (onError) onError(err);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
  
  const resetRecording = () => {
    setSelectedFile(null);
    setAudioUrl('');
    setRecordingComplete(false);
    setError(null);
  };
  
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    
    if (!file) {
      return;
    }
    
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file');
      return;
    }
    
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setAudioUrl(url);
    setRecordingComplete(true);
  };
  
  const handleConfirmRecording = async () => {
    if (!selectedFile) {
      setError('No audio file selected. Please record or upload an audio file.');
      return;
    }
    
    if (selectedFile.size === 0) {
      setError('The audio file is empty. Please try recording again.');
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      console.log('Using estimate ID:', estimateId);
      if (!estimateId) {
        throw new Error('No estimate ID provided. Please ensure you are in a valid estimate context.');
      }
      
      const formData = new FormData();
      const fileToUpload = new File(
        [selectedFile], 
        selectedFile.name || 'recording.wav',
        { type: selectedFile.type || 'audio/wav' }
      );
      
      formData.append('audio', fileToUpload);
      formData.append('estimate_id', String(estimateId));
      
      // =================================================================
      // === REPLACED FETCH WITH THE CONFIGURED 'api' (AXIOS) INSTANCE ===
      // =================================================================
      // The `api` instance automatically includes credentials (cookies)
      // and points to the correct base URL. This fixes the auth issue.
      const response = await api.post('/audio/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      // =================================================================

      // Axios puts the response JSON in the `data` property
      const uploadedAudio = response.data;
      
      resetRecording();
      
      if (onAudioUploaded) {
        onAudioUploaded(uploadedAudio);
      }
    } catch (err) {
      console.error('Error uploading audio:', err);
      // Axios provides better error details in `err.response`
      const errorMessage = err.response?.data?.error || err.message || "Failed to upload audio.";
      setError(`Failed to upload audio: ${errorMessage}. Please try again.`);
      if (onError) onError(err);
    } finally {
      setUploading(false);
    }
  };
  
  const playRecording = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(err => {
        console.error('Error playing audio preview:', err);
        setError('Unable to play audio preview.');
      });
    }
  };
  
  return (
    <div className="audio-recorder">
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Form.Control
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*"
        style={{ display: 'none' }}
      />
      
      <div className="controls">
        {!isRecording && !recordingComplete && (
          <>
            <Button 
              variant="primary" 
              onClick={startRecording}
              disabled={uploading}
              className="control-button"
            >
              <FaMicrophone /> Start Recording
            </Button>
            
            <Button 
              variant="outline-secondary" 
              onClick={() => fileInputRef.current?.click()}
              className="ml-2"
            >
              <FaUpload /> Upload Audio
            </Button>
          </>
        )}
        
        {isRecording && (
          <Button 
            variant="danger" 
            onClick={stopRecording}
            className="control-button recording"
          >
            <FaStop /> Stop Recording
          </Button>
        )}
        
        {recordingComplete && (
          <div className="complete-controls">
            {audioUrl && (
              <Button 
                variant="outline-secondary" 
                onClick={playRecording}
                className="mr-2"
              >
                <FaVolumeUp /> Preview
              </Button>
            )}
            
            <Button 
              variant="outline-secondary" 
              onClick={resetRecording}
              className="mr-2"
              disabled={uploading}
            >
              <FaUndo /> Reset
            </Button>
            
            <Button 
              variant="success" 
              onClick={handleConfirmRecording}
              disabled={uploading}
            >
              <FaCheck /> {uploading ? 'Processing...' : 'Confirm & Process'}
            </Button>
            
            {uploading && (
              <Spinner animation="border" size="sm" className="ml-2" />
            )}
          </div>
        )}
      </div>
      
      {isRecording && (
        <div className="recording-indicator">
          <div className="recording-dot"></div>
          <span>Recording...</span>
        </div>
      )}
      
      {selectedFile && (
        <div className="audio-info mt-2">
          <small className="text-muted">
            File: {selectedFile.name || 'recording.wav'} | 
            Size: {(selectedFile.size / 1024).toFixed(2)} KB | 
            Type: {selectedFile.type || 'audio/wav'}
          </small>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;