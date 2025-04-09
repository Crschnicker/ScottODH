// IOSAudioRecorder.js - With fixed API integration
import React, { useState, useRef, useEffect } from 'react';
import { Button, Alert, Spinner, Form } from 'react-bootstrap';
import { FaMicrophone, FaStop, FaVolumeUp, FaCheck, FaUndo, FaUpload } from 'react-icons/fa';
import './AudioRecorder.css';

const IOSAudioRecorder = ({ estimateId, onAudioUploaded, onError }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecordingPermission, setHasRecordingPermission] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  
  // Check for audio recording permission
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setHasRecordingPermission(true);
        // Stop the stream since we're just checking permission
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Error accessing microphone:', err);
        setHasRecordingPermission(false);
        setError('Microphone access permission denied. Please enable microphone access in your browser settings.');
      }
    };
    
    checkPermission();
    
    return () => {
      // Clean up any active streams or timers on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Start recording function
  const startRecording = async () => {
    setError(null);
    
    try {
      // Request microphone access with optimized settings for voice
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];
      
      // For iOS, use MediaRecorder with optimal settings
      if (window.MediaRecorder) {
        console.log('Using MediaRecorder API');
        
        // Try different formats in order of preference for iOS compatibility
        let options;
        let recorder;
        
        // Check for supported MIME types
        const mimeTypes = [
          'audio/wav',
          'audio/mp4',
          'audio/webm',
          'audio/mpeg'
        ];
        
        // Find first supported type
        let selectedMimeType = null;
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            selectedMimeType = mimeType;
            console.log(`Using supported mime type: ${mimeType}`);
            break;
          }
        }
        
        try {
          if (selectedMimeType) {
            options = { mimeType: selectedMimeType };
            recorder = new MediaRecorder(stream, options);
          } else {
            // Use default
            recorder = new MediaRecorder(stream);
          }
          console.log(`Created recorder with mime type: ${recorder.mimeType}`);
        } catch (e) {
          console.log('MediaRecorder with specified options failed, using default');
          recorder = new MediaRecorder(stream);
        }
        
        mediaRecorderRef.current = recorder;
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
            console.log(`Received audio chunk: ${event.data.size} bytes`);
          }
        };
        
        recorder.onstop = () => {
          // Stop the timer
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          
          // Indicate processing
          setProcessingAudio(true);
          
          try {
            // Determine the mimetype from the recorder
            const mimeType = recorder.mimeType || 'audio/wav';
            console.log(`Recording completed with mime type: ${mimeType}`);
            
            // Create a blob from the audio chunks
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            console.log(`Created audio blob: ${audioBlob.size} bytes`);
            
            // Create file name with proper extension based on mime type
            let extension = 'wav';
            if (mimeType.includes('mp4')) extension = 'm4a';
            else if (mimeType.includes('mpeg')) extension = 'mp3';
            else if (mimeType.includes('webm')) extension = 'webm';
            
            // Create URL for preview
            const url = URL.createObjectURL(audioBlob);
            
            // Update state
            setSelectedFile(audioBlob);
            setAudioUrl(url);
            setIsRecording(false);
            setRecordingComplete(true);
            
            console.log(`Audio ready: ${extension}, ${mimeType}, ${audioBlob.size} bytes`);
          } catch (err) {
            console.error('Error processing audio:', err);
            setError('Error processing the recorded audio. Please try again.');
          } finally {
            setProcessingAudio(false);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
          }
        };
        
        // Start recording - request data every 500ms for better results on iOS
        recorder.start(500);
        setIsRecording(true);
        
        // Start a timer to show recording duration
        setRecordingTime(0);
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        setError('Your browser does not support direct audio recording. Please use the file upload option instead.');
      }
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not start recording. Please ensure microphone access is enabled and try again.');
      if (onError) onError(err);
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
  
  // Handle file selection (as fallback)
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
    console.log('File type:', file.type);
    console.log('File size:', file.size);
    
    // Create a URL for preview
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setAudioUrl(url);
    setRecordingComplete(true);
    setError(null);
  };
  
  // Reset recording
  const resetRecording = () => {
    setSelectedFile(null);
    setAudioUrl('');
    setRecordingComplete(false);
    setError(null);
    setRecordingTime(0);
  };
  
  // Play audio preview
  const playRecording = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(err => {
        console.error('Error playing audio preview:', err);
        setError('Unable to play audio preview.');
      });
    }
  };
  
  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle file upload - using direct fetch call
  const handleConfirmRecording = async () => {
    if (!selectedFile) {
      setError('No audio file selected. Please record or select an audio file.');
      return;
    }
    
    // Check file size before upload
    if (selectedFile.size === 0) {
      setError('The audio file is empty. Please try recording again.');
      return;
    }
    
    // Ensure we have a valid estimate ID
    if (!estimateId) {
      setError('No estimate ID provided. Please ensure you are in a valid estimate context.');
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      console.log('Uploading audio from iOS recorder:', {
        size: selectedFile.size,
        type: selectedFile.type || 'audio/wav'
      });
      
      // Create FormData for upload
      const formData = new FormData();
      
      // Create a proper file with name and type
      let filename = 'recording.wav';
      let filetype = selectedFile.type || 'audio/wav';
      
      // Adjust file extension based on type
      if (filetype.includes('mp4')) filename = 'recording.m4a';
      else if (filetype.includes('mpeg')) filename = 'recording.mp3';
      else if (filetype.includes('webm')) filename = 'recording.webm';
      
      const fileToUpload = new File(
        [selectedFile], 
        filename,
        { type: filetype }
      );
      
      formData.append('audio', fileToUpload);
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
      console.log('Successfully uploaded audio:', uploadedAudio);
      
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
  
  return (
    <div className="audio-recorder ios-recorder">
      {error && <Alert variant="danger">{error}</Alert>}
      
      <div className="device-info mb-3">
        <small className="text-muted">
          iOS detected. Use the microphone button to record audio directly.
          Speak clearly for better transcription results.
        </small>
      </div>
      
      {/* Hidden file input for upload option */}
      <Form.Control
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*"
        style={{ display: 'none' }}
      />
      
      <div className="controls">
        {!isRecording && !recordingComplete && !processingAudio && (
          <>
            <Button 
              variant="primary" 
              onClick={startRecording}
              disabled={uploading || !hasRecordingPermission}
              className="control-button"
            >
              <FaMicrophone /> Start Recording
            </Button>
            
            <Button 
              variant="outline-secondary" 
              onClick={() => fileInputRef.current?.click()}
              className="ml-2 mt-2"
            >
              <FaUpload /> Upload Audio
            </Button>
            
            {!hasRecordingPermission && (
              <div className="mt-2">
                <small className="text-warning">
                  Microphone access denied. Please enable microphone access in your browser settings.
                </small>
              </div>
            )}
          </>
        )}
        
        {isRecording && !processingAudio && (
          <>
            <Button 
              variant="danger" 
              onClick={stopRecording}
              className="control-button recording"
            >
              <FaStop /> Stop Recording
            </Button>
            
            <div className="recording-timer mt-2">
              Recording: {formatTime(recordingTime)}
            </div>
          </>
        )}
        
        {processingAudio && (
          <div className="processing-indicator">
            <Spinner animation="border" size="sm" className="mr-2" />
            <span>Processing audio...</span>
          </div>
        )}
        
        {recordingComplete && !processingAudio && (
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
      
      {isRecording && !processingAudio && (
        <div className="recording-indicator">
          <div className="recording-dot"></div>
          <span>Recording...</span>
        </div>
      )}
      
      {selectedFile && !processingAudio && (
        <div className="audio-info mt-2">
          <small className="text-muted">
            {recordingTime > 0 ? 
              `Recording: ${formatTime(recordingTime)} | ` : 
              ''}
            Size: {(selectedFile.size / 1024).toFixed(2)} KB | 
            Type: {selectedFile.type || 'audio/wav'}
          </small>
        </div>
      )}
    </div>
  );
};

export default IOSAudioRecorder;