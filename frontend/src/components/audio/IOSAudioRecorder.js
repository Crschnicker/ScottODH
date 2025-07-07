// IOSAudioRecorder.js - With fixed API integration
import React, { useState, useRef, useEffect } from 'react';
import { Button, Alert, Spinner, Form } from 'react-bootstrap';
import { FaMicrophone, FaStop, FaVolumeUp, FaCheck, FaUndo, FaUpload } from 'react-icons/fa';
import './AudioRecorder.css';

// =================================================================
// === ADD THIS IMPORT TO USE YOUR CONFIGURED AXIOS INSTANCE       ===
// =================================================================
import api from '../../services/api'; 
// =================================================================

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
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Error accessing microphone:', err);
        setHasRecordingPermission(false);
        setError('Microphone access permission denied. Please enable microphone access in your browser settings.');
      }
    };
    
    checkPermission();
    
    return () => {
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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];
      
      if (window.MediaRecorder) {
        let recorder;
        const mimeTypes = ['audio/mp4', 'audio/wav', 'audio/webm', 'audio/mpeg'];
        let selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
        
        try {
            const options = selectedMimeType ? { mimeType: selectedMimeType } : {};
            recorder = new MediaRecorder(stream, options);
            console.log(`Created recorder with mime type: ${recorder.mimeType}`);
        } catch (e) {
          console.log('MediaRecorder with specified options failed, using default');
          recorder = new MediaRecorder(stream);
        }
        
        mediaRecorderRef.current = recorder;
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        recorder.onstop = () => {
          if (timerRef.current) clearInterval(timerRef.current);
          setProcessingAudio(true);
          
          try {
            const mimeType = recorder.mimeType || 'audio/wav';
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            
            const url = URL.createObjectURL(audioBlob);
            setSelectedFile(audioBlob);
            setAudioUrl(url);
            setIsRecording(false);
            setRecordingComplete(true);
          } catch (err) {
            console.error('Error processing audio:', err);
            setError('Error processing the recorded audio. Please try again.');
          } finally {
            setProcessingAudio(false);
            stream.getTracks().forEach(track => track.stop());
          }
        };
        
        recorder.start(500);
        setIsRecording(true);
        
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
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
  
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('audio/')) {
      setError('Please select a valid audio file');
      return;
    }
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setAudioUrl(url);
    setRecordingComplete(true);
    setError(null);
  };
  
  const resetRecording = () => {
    setSelectedFile(null);
    setAudioUrl('');
    setRecordingComplete(false);
    setError(null);
    setRecordingTime(0);
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
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleConfirmRecording = async () => {
    if (!selectedFile || selectedFile.size === 0) {
      setError('No audio file selected or file is empty. Please record or select an audio file.');
      return;
    }
    if (!estimateId) {
      setError('No estimate ID provided. Please ensure you are in a valid estimate context.');
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      let filename = 'recording.wav';
      let filetype = selectedFile.type || 'audio/wav';
      
      if (filetype.includes('mp4')) filename = 'recording.m4a';
      else if (filetype.includes('mpeg')) filename = 'recording.mp3';
      else if (filetype.includes('webm')) filename = 'recording.webm';
      
      const fileToUpload = new File([selectedFile], filename, { type: filetype });
      
      formData.append('audio', fileToUpload);
      formData.append('estimate_id', String(estimateId));
      
      // =================================================================
      // === REPLACED FETCH WITH THE CONFIGURED 'api' (AXIOS) INSTANCE ===
      // =================================================================
      const response = await api.post('/audio/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      // =================================================================
      
      const uploadedAudio = response.data;
      console.log('Successfully uploaded audio:', uploadedAudio);
      
      resetRecording();
      
      if (onAudioUploaded) {
        onAudioUploaded(uploadedAudio);
      }
    } catch (err) {
      console.error('Error uploading audio:', err);
      const errorMessage = err.response?.data?.error || err.message || "Failed to upload audio.";
      setError(`Failed to upload audio: ${errorMessage}. Please try again.`);
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
          iOS detected. Use the microphone button to record audio directly. Speak clearly for better transcription results.
        </small>
      </div>
      
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