
import React, { useState, useRef, useEffect } from 'react';
import { Button, Alert, Card, ProgressBar } from 'react-bootstrap';
import { FaMicrophone, FaStop, FaTrash, FaPlay, FaPause } from 'react-icons/fa';
import { uploadAudio, deleteAudioRecording } from '../../services/audioService';
import './AudioRecorder.css';

const AudioRecorder = ({ estimateId, onAudioUploaded, onError }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioElementRef = useRef(null);
  const timerIntervalRef = useRef(null);
  
  useEffect(() => {
    // Clean up when component unmounts
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);
  
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      setRecordingDuration(0);
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        // Convert to audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Add to recordings array (temporarily until uploaded)
        const tempRecording = {
          id: `temp-${Date.now()}`,
          url: audioUrl,
          duration: recordingDuration,
          blob: audioBlob,
          isTemp: true
        };
        
        setRecordings(prev => [...prev, tempRecording]);
        
        // Upload to server
        await uploadRecording(tempRecording);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      setError('Could not access microphone. Please ensure you have granted permission.');
      console.error('Error starting recording:', err);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      clearInterval(timerIntervalRef.current);
      setIsRecording(false);
    }
  };
  
  const uploadRecording = async (recording) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('audio', recording.blob, 'recording.wav');
      formData.append('estimate_id', estimateId);
      
      const response = await uploadAudio(formData, {
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });
      
      // Update recordings list
      setRecordings(prev => prev.map(rec => 
        rec.id === recording.id 
          ? { ...rec, id: response.data.id, isTemp: false, file_path: response.data.file_path }
          : rec
      ));
      
      // Call the callback
      if (onAudioUploaded) {
        onAudioUploaded(response.data);
      }
      
    } catch (err) {
      setError('Failed to upload audio recording. Please try again.');
      console.error('Error uploading recording:', err);
      
      if (onError) {
        onError(err);
      }
    } finally {
      setIsUploading(false);
    }
  };
  
  const deleteRecording = async (recordingId, isTemp) => {
    try {
      if (!isTemp) {
        await deleteAudioRecording(recordingId);
      }
      
      // Remove from list
      setRecordings(prev => prev.filter(rec => rec.id !== recordingId));
      
    } catch (err) {
      setError('Failed to delete audio recording.');
      console.error('Error deleting recording:', err);
    }
  };
  
  const togglePlayback = (recording) => {
    if (currentlyPlaying === recording.id) {
      // Pause current playback
      audioElementRef.current.pause();
      setCurrentlyPlaying(null);
    } else {
      // Stop current playback if any
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      
      // Start new playback
      audioElementRef.current = new Audio(recording.url);
      audioElementRef.current.play();
      setCurrentlyPlaying(recording.id);
      
      // Reset when finished
      audioElementRef.current.onended = () => {
        setCurrentlyPlaying(null);
      };
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };
  
  return (
    <div className="audio-recorder-container">
      <div className="recording-controls">
        {isRecording ? (
          <Button 
            variant="danger" 
            onClick={stopRecording} 
            className="record-button"
          >
            <FaStop /> Stop Recording
          </Button>
        ) : (
          <Button 
            variant="primary" 
            onClick={startRecording} 
            className="record-button"
            disabled={isUploading}
          >
            <FaMicrophone /> Start Recording
          </Button>
        )}
        
        {isRecording && (
          <div className="recording-indicator">
            <span className="recording-time">{formatTime(recordingDuration)}</span>
            <div className="pulse-indicator"></div>
          </div>
        )}
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      {isUploading && (
        <div className="upload-progress">
          <p>Uploading recording...</p>
          <ProgressBar now={uploadProgress} label={`${uploadProgress}%`} />
        </div>
      )}
      
      {recordings.length > 0 && (
        <div className="recordings-list">
          <h5>Recordings</h5>
          {recordings.map((recording) => (
            <Card key={recording.id} className="recording-item">
              <Card.Body className="d-flex justify-content-between align-items-center">
                <div className="recording-info">
                  {recording.isTemp ? 'Processing...' : `Recording ${recording.id}`}
                  {recording.duration && <span className="duration"> ({formatTime(recording.duration)})</span>}
                </div>
                
                <div className="recording-actions">
                  <Button 
                    variant="outline-primary" 
                    size="sm" 
                    onClick={() => togglePlayback(recording)}
                    disabled={recording.isTemp}
                  >
                    {currentlyPlaying === recording.id ? <FaPause /> : <FaPlay />}
                  </Button>
                  
                  <Button 
                    variant="outline-danger" 
                    size="sm" 
                    onClick={() => deleteRecording(recording.id, recording.isTemp)}
                    disabled={isUploading}
                  >
                    <FaTrash />
                  </Button>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
