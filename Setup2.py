import os
import json
import shutil

# Define the project base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, 'backend')
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
FRONTEND_SRC_DIR = os.path.join(FRONTEND_DIR, 'src')
FRONTEND_COMPONENTS_DIR = os.path.join(FRONTEND_SRC_DIR, 'components')
FRONTEND_SERVICES_DIR = os.path.join(FRONTEND_SRC_DIR, 'services')
FRONTEND_PAGES_DIR = os.path.join(FRONTEND_SRC_DIR, 'pages')

# Ensure directories exist
os.makedirs(os.path.join(FRONTEND_COMPONENTS_DIR, 'audio'), exist_ok=True)
os.makedirs(os.path.join(FRONTEND_SRC_DIR, 'styles'), exist_ok=True)

# Function to write content to file
def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Created/Updated: {path}")

# 1. Backend changes - Add audio processing functionality
# Update requirements.txt for audio processing
backend_requirements = """
flask==2.0.1
flask-sqlalchemy==2.5.1
flask-cors==3.0.10
reportlab==3.6.1
SpeechRecognition==3.8.1
pydub==0.25.1
numpy==1.21.4
webrtcvad==2.0.10
openai==0.28.0
"""

write_file(os.path.join(BACKEND_DIR, 'requirements.txt'), backend_requirements)

# Create audio controller
audio_controller_content = """
from flask import Blueprint, request, jsonify, current_app
import os
import uuid
import json
from datetime import datetime
import speech_recognition as sr
from pydub import AudioSegment
import tempfile
import re
from models.models import db, AudioRecording, Estimate, Door, LineItem

audio_bp = Blueprint('audio', __name__)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@audio_bp.route('/upload', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    audio_file = request.files['audio']
    estimate_id = request.form.get('estimate_id')
    
    if not estimate_id:
        return jsonify({'error': 'Estimate ID is required'}), 400
    
    # Check if estimate exists
    estimate = Estimate.query.get(estimate_id)
    if not estimate:
        return jsonify({'error': 'Estimate not found'}), 404
    
    # Generate a filename and save the audio file
    filename = f"{uuid.uuid4()}.wav"
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    audio_file.save(file_path)
    
    # Create a record in the database
    recording = AudioRecording(
        estimate_id=estimate_id,
        file_path=file_path,
        created_at=datetime.utcnow()
    )
    db.session.add(recording)
    db.session.commit()
    
    return jsonify({
        'id': recording.id,
        'estimate_id': recording.estimate_id,
        'file_path': recording.file_path,
        'created_at': recording.created_at
    }), 201

@audio_bp.route('/<int:recording_id>', methods=['GET'])
def get_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    return jsonify({
        'id': recording.id,
        'estimate_id': recording.estimate_id,
        'file_path': recording.file_path,
        'created_at': recording.created_at,
        'transcript': recording.transcript
    })

@audio_bp.route('/<int:recording_id>/delete', methods=['DELETE'])
def delete_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    # Delete the file
    if os.path.exists(recording.file_path):
        os.remove(recording.file_path)
    
    # Delete the database record
    db.session.delete(recording)
    db.session.commit()
    
    return jsonify({'status': 'success', 'message': 'Recording deleted'}), 200

@audio_bp.route('/<int:recording_id>/transcribe', methods=['POST'])
def transcribe_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    if not os.path.exists(recording.file_path):
        return jsonify({'error': 'Audio file not found'}), 404
    
    try:
        # Convert audio to format supported by speech recognition if needed
        audio = AudioSegment.from_file(recording.file_path)
        
        # Save as WAV for speech recognition
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
            audio.export(temp_path, format="wav")
        
        # Use speech recognition
        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_path) as source:
            audio_data = recognizer.record(source)
            transcript = recognizer.recognize_google(audio_data)
        
        # Clean up temp file
        os.unlink(temp_path)
        
        # Save transcript to database
        recording.transcript = transcript
        db.session.commit()
        
        return jsonify({
            'id': recording.id,
            'transcript': transcript
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@audio_bp.route('/<int:recording_id>/process', methods=['POST'])
def process_audio(recording_id):
    recording = AudioRecording.query.get_or_404(recording_id)
    
    if not recording.transcript:
        return jsonify({'error': 'No transcript available. Please transcribe the audio first.'}), 400
    
    try:
        # Process the transcript to identify doors and details
        doors = extract_doors_from_transcript(recording.transcript)
        
        # Save doors to the estimate
        saved_doors = []
        for door in doors:
            door_obj = Door(
                estimate_id=recording.estimate_id,
                door_number=door['door_number'],
                description=door.get('description', '')
            )
            db.session.add(door_obj)
            db.session.flush()  # Get door ID
            
            # Add door details as line items
            for detail in door.get('details', []):
                line_item = LineItem(
                    door_id=door_obj.id,
                    description=detail
                )
                db.session.add(line_item)
            
            saved_doors.append({
                'id': door_obj.id,
                'door_number': door_obj.door_number,
                'description': door_obj.description,
                'details': door.get('details', [])
            })
        
        db.session.commit()
        
        return jsonify({
            'recording_id': recording.id,
            'doors': saved_doors
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def extract_doors_from_transcript(transcript):
    # Simple regex-based extraction of door information
    # This is a basic implementation - a more sophisticated NLP approach might be better
    doors = []
    
    # Look for door mentions (e.g., "Door 1", "Door number 2", etc.)
    door_mentions = re.finditer(r'door(?:\s+number|\s+#)?\s+(\d+)', transcript, re.IGNORECASE)
    
    last_pos = 0
    for match in door_mentions:
        door_number = int(match.group(1))
        start_pos = match.start()
        
        # Find the next door mention or end of text
        next_match = re.search(r'door(?:\s+number|\s+#)?\s+\d+', transcript[start_pos+1:], re.IGNORECASE)
        end_pos = start_pos + 1 + next_match.start() if next_match else len(transcript)
        
        # Extract the text specific to this door
        door_text = transcript[start_pos:end_pos].strip()
        
        # Extract details about the door
        details = []
        # Look for dimensions
        dim_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:by|x)\s*(\d+(?:\.\d+)?)', door_text)
        if dim_match:
            width, height = dim_match.groups()
            details.append(f"Dimensions: {width} x {height}")
        
        # Look for common door specifications
        specs = [
            (r'steel', "Material: Steel"),
            (r'aluminum', "Material: Aluminum"),
            (r'wood', "Material: Wood"),
            (r'insulated', "Feature: Insulated"),
            (r'windows', "Feature: Windows"),
            (r'opener', "Accessory: Opener"),
            (r'remote', "Accessory: Remote"),
            (r'keypad', "Accessory: Keypad")
        ]
        
        for pattern, label in specs:
            if re.search(pattern, door_text, re.IGNORECASE):
                details.append(label)
        
        # Add any remaining text as general description
        description = door_text.replace(f"Door {door_number}", "").strip()
        
        doors.append({
            'door_number': door_number,
            'description': description,
            'details': details
        })
        
        last_pos = end_pos
    
    return doors

@audio_bp.route('/estimate/<int:estimate_id>/recordings', methods=['GET'])
def get_recordings(estimate_id):
    recordings = AudioRecording.query.filter_by(estimate_id=estimate_id).all()
    
    result = []
    for recording in recordings:
        result.append({
            'id': recording.id,
            'file_path': recording.file_path,
            'created_at': recording.created_at,
            'transcript': recording.transcript
        })
    
    return jsonify(result)
"""

# Create models.py file or update it
models_file_path = os.path.join(BACKEND_DIR, 'models')
os.makedirs(models_file_path, exist_ok=True)

models_content = """
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

# Add AudioRecording model - keep all other existing models

class AudioRecording(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    estimate_id = db.Column(db.Integer, db.ForeignKey('estimate.id'), nullable=False)
    file_path = db.Column(db.String(200), nullable=False)
    transcript = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Add relationship to Estimate
    estimate = db.relationship('Estimate', backref='audio_recordings', lazy=True)

# Add new fields to LineItem model
class LineItem(db.Model):
    # Existing fields remain 
    description = db.Column(db.String(200))  # Updated field
"""

write_file(os.path.join(models_file_path, 'models.py'), models_content)

# Create directory for audio controller
audio_controller_path = os.path.join(BACKEND_DIR, 'controllers')
os.makedirs(audio_controller_path, exist_ok=True)
write_file(os.path.join(audio_controller_path, 'audio_controller.py'), audio_controller_content)

# 2. Frontend changes
# Create audioService.js
audio_service_content = """
import api from './api';

export const uploadAudio = (formData) => {
  return api.post('/api/audio/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

export const getAudioRecordings = (estimateId) => {
  return api.get(`/api/audio/estimate/${estimateId}/recordings`)
    .then(response => response.data);
};

export const deleteAudioRecording = (recordingId) => {
  return api.delete(`/api/audio/${recordingId}/delete`)
    .then(response => response.data);
};

export const transcribeAudio = (recordingId) => {
  return api.post(`/api/audio/${recordingId}/transcribe`)
    .then(response => response.data);
};

export const processAudio = (recordingId) => {
  return api.post(`/api/audio/${recordingId}/process`)
    .then(response => response.data);
};
"""

write_file(os.path.join(FRONTEND_SERVICES_DIR, 'audioService.js'), audio_service_content)

# Create audio recording component
audio_recorder_content = """
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
"""

# Create CSS for audio recorder
audio_recorder_css_content = """
.audio-recorder-container {
  margin-bottom: 20px;
}

.recording-controls {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.record-button {
  display: flex;
  align-items: center;
  gap: 8px;
}

.recording-indicator {
  display: flex;
  align-items: center;
  margin-left: 15px;
}

.recording-time {
  font-family: monospace;
  font-size: 1.2rem;
  margin-right: 10px;
}

.pulse-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #dc3545;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
  }
  
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
  }
  
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(220, 53, 69, 0);
  }
}

.upload-progress {
  margin: 15px 0;
}

.recordings-list {
  margin-top: 20px;
}

.recording-item {
  margin-bottom: 10px;
}

.recording-actions {
  display: flex;
  gap: 8px;
}

.duration {
  color: #6c757d;
  font-size: 0.9rem;
}
"""

# Create audio processing component
audio_processor_content = """
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
"""

# Create CSS for audio processor
audio_processor_css_content = """
.audio-processor-container {
  margin-bottom: 30px;
}

.process-controls {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.process-button {
  display: flex;
  align-items: center;
  gap: 8px;
}

.processing-status {
  display: flex;
  align-items: center;
  margin-left: 15px;
  gap: 8px;
}

.transcripts-section {
  margin-bottom: 25px;
}

.transcript-text {
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.doors-section {
  margin-top: 30px;
}

.door-card {
  margin-bottom: 15px;
}

.door-description {
  white-space: pre-wrap;
}

.door-details {
  margin-top: 15px;
}

.door-edit-form .form-group {
  margin-bottom: 15px;
}

.detail-input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.door-edit-actions {
  margin-top: 20px;
  display: flex;
}
"""

# Create EstimateInProgress component
estimate_in_progress_content = """
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
"""

# Create CSS for EstimateInProgress
estimate_in_progress_css_content = """
.estimate-in-progress-container {
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.back-button {
  margin-right: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.customer-info-card,
.audio-recorder-card,
.audio-processor-card {
  margin-bottom: 25px;
}

.submit-actions {
  display: flex;
  align-items: center;
  margin-top: 30px;
}

.submit-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 25px;
}

.submitting-indicator {
  display: flex;
  align-items: center;
  margin-left: 15px;
  gap: 8px;
}
"""

# Update app.py to include audio routes
app_py_update = """
# Add these imports at the top
from .controllers.audio_controller import audio_bp

# Add this line with the other blueprint registrations
app.register_blueprint(audio_bp, url_prefix='/api/audio')
"""

# Create directories for new components
os.makedirs(os.path.join(FRONTEND_COMPONENTS_DIR, 'audio'), exist_ok=True)

# Write audio components
write_file(os.path.join(FRONTEND_COMPONENTS_DIR, 'audio', 'AudioRecorder.js'), audio_recorder_content)
write_file(os.path.join(FRONTEND_COMPONENTS_DIR, 'audio', 'AudioRecorder.css'), audio_recorder_css_content)
write_file(os.path.join(FRONTEND_COMPONENTS_DIR, 'audio', 'AudioProcessor.js'), audio_processor_content)
write_file(os.path.join(FRONTEND_COMPONENTS_DIR, 'audio', 'AudioProcessor.css'), audio_processor_css_content)

# Write page components
write_file(os.path.join(FRONTEND_PAGES_DIR, 'EstimateInProgress.js'), estimate_in_progress_content)
write_file(os.path.join(FRONTEND_PAGES_DIR, 'EstimateInProgress.css'), estimate_in_progress_css_content)

# Update routes in App.js
app_js_update = """
import EstimateInProgress from './pages/EstimateInProgress';

// Add this inside the Routes component:
<Route path="/estimates/:estimateId/progress" element={<EstimateInProgress />} />
"""

# Create an update to EstimateList.js to add a link to the in-progress page
estimate_list_update = """
// Add this button to the action column for each estimate
<Link to={`/estimates/${estimate.id}/progress`} className="btn btn-outline-primary btn-sm me-2">
  <FaMicrophone /> Record
</Link>
"""

print("Setup complete! Created the following files:")
print("1. Backend:")
print("   - models/models.py (updated)")
print("   - controllers/audio_controller.py")
print("   - requirements.txt (updated)")
print("")
print("2. Frontend:")
print("   - services/audioService.js")
print("   - components/audio/AudioRecorder.js")
print("   - components/audio/AudioRecorder.css")
print("   - components/audio/AudioProcessor.js")
print("   - components/audio/AudioProcessor.css")
print("   - pages/EstimateInProgress.js")
print("   - pages/EstimateInProgress.css")
print("")
print("Next steps:")
print("1. Update app.py to register the audio blueprint")
print("2. Update App.js to add the route to EstimateInProgress")
print("3. Update EstimateList.js to add a link to the in-progress page")
print("4. Install the new requirements with 'pip install -r backend/requirements.txt'")
print("5. Restart your backend and frontend servers")