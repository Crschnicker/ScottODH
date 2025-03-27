
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
