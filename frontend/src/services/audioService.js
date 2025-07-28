// audioService.js - Fixed implementation
import api from './api';

// Get audio recordings for an estimate
export const getAudioRecordings = async (estimateId) => {
  try {
    console.log(`Fetching audio recordings for estimate: ${estimateId}`);
    const response = await api.get(`/audio/estimate/${estimateId}/recordings`);
    console.log(`Retrieved ${response.data.length} recordings`);
    return response.data;
  } catch (error) {
    console.error('Error getting audio recordings:', error);
    throw error;
  }
};

// Transcribe audio recording
export const transcribeAudio = async (recordingId) => {
  try {
    console.log(`Transcribing audio recording: ${recordingId}`);
    const response = await api.post(`/audio/${recordingId}/transcribe`);
    console.log('Transcription response:', response.data);
    return response.data;
  } catch (error) {
    console.error(`Error transcribing audio ${recordingId}:`, error);
    throw error;
  }
};

// Process audio with AI
export const processAudioWithAI = async (recordingId) => {
  try {
    console.log(`Processing audio with AI: ${recordingId}`);
    const response = await api.post(`/audio/${recordingId}/process-with-ai`);
    
    // Additional logging to debug door extraction
    console.log('AI processing response:', response.data);
    
    if (response.data.doors) {
      console.log(`Extracted ${response.data.doors.length} doors from recording ${recordingId}`);
      
      // Log each door's details
      response.data.doors.forEach((door, index) => {
        console.log(`Door ${index + 1} details:`, {
          door_number: door.door_number,
          description: door.description,
          details: door.details,
          id: door.id
        });
      });
    } else {
      console.warn(`No doors extracted from recording ${recordingId}`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error processing audio ${recordingId} with AI:`, error);
    throw error;
  }
};

// Delete audio recording
export const deleteAudio = async (recordingId) => {
  try {
    console.log(`Deleting audio recording: ${recordingId}`);
    const response = await api.delete(`/audio/${recordingId}/delete`);
    console.log('Delete response:', response.data);
    return response.data;
  } catch (error) {
    console.error(`Error deleting audio ${recordingId}:`, error);
    throw error;
  }
};

// Upload audio file (specifically for use in AudioRecorder.js)
export const uploadAudio = async (audioBlob, estimateId) => {
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Audio file is empty or invalid');
  }

  try {
    console.log(`Preparing to upload audio for estimate: ${estimateId}`);
    console.log(`Audio blob size: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
    
    // Create a proper file with name and type
    const audioFile = new File(
      [audioBlob], 
      'recording.wav',
      { type: audioBlob.type || 'audio/wav' }
    );
    
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('estimate_id', String(estimateId));
    
    // We need to use a different content type for file uploads
    const response = await api.post('/audio/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    console.log('Upload successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error uploading audio:', error);
    throw error;
  }
};

const audioService = {
  getAudioRecordings,
  transcribeAudio,
  processAudioWithAI,
  deleteAudio,
  uploadAudio
};
export default audioService;