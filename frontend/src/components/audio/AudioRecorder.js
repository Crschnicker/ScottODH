// AudioRecorder.js - With improved upload handling
import React, { useState, useRef } from 'react';
import { Button, Alert, Spinner, Form } from 'react-bootstrap';
import { FaMicrophone, FaStop, FaCheck, FaUndo, FaUpload, FaVolumeUp } from 'react-icons/fa';
import './AudioRecorder.css';

// Import the iOS-specific component
import IOSAudioRecorder from './IOSAudioRecorder';

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
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Request data every second instead of only at stop
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
    
    // Check if file is audio
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file');
      return;
    }
    
    console.log('Selected file:', file);
    
    // Create a URL for preview
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
    
    // Check file size before upload
    if (selectedFile.size === 0) {
      setError('The audio file is empty. Please try recording again.');
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      console.log('Using estimate ID:', estimateId);
      console.log('Uploading audio:', {
        size: selectedFile.size,
        type: selectedFile.type,
        name: selectedFile.name || 'recording.wav'
      });
      
      // Create FormData for upload
      const formData = new FormData();
      
      // Create a proper file with name and type to ensure it's processed correctly
      const fileToUpload = new File(
        [selectedFile], 
        selectedFile.name || 'recording.wav',
        { type: selectedFile.type || 'audio/wav' }
      );
      
      formData.append('audio', fileToUpload);
      
      // Convert estimateId to a string to ensure proper formatting
      if (!estimateId) {
        throw new Error('No estimate ID provided. Please ensure you are in a valid estimate context.');
      }
      
      formData.append('estimate_id', String(estimateId));
      
      // Use the correct API endpoint
      const apiUrl = 'https://scottohd-api.ngrok.io/api/audio/upload';
      
      // Upload using fetch
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed with status: ${response.status}`);
      }
      
      const uploadedAudio = await response.json();
      
      // Reset for next recording
      resetRecording();
      
      // Notify parent component
      if (onAudioUploaded) {
        onAudioUploaded(uploadedAudio);
      }
    } catch (err) {
      console.error('Error uploading audio:', err);
      setError(`Failed to upload audio: ${err.message}. Please try again.`);
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
      
      {/* Hidden file input */}
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