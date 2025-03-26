import api from './api';

// Get all jobs with optional filters
export const getJobs = async (params = {}) => {
  try {
    const response = await api.get('/jobs', { params });
    return response.data;
  } catch (error) {
    console.error('Error getting jobs:', error);
    throw error;
  }
};

// Get job by ID
export const getJob = async (id) => {
  try {
    const response = await api.get(`/jobs/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting job ${id}:`, error);
    throw error;
  }
};

// Schedule a job
export const scheduleJob = async (jobId, scheduleData) => {
  try {
    const response = await api.post(`/jobs/${jobId}/schedule`, scheduleData);
    return response.data;
  } catch (error) {
    console.error(`Error scheduling job ${jobId}:`, error);
    throw error;
  }
};

// Update job status
export const updateJobStatus = async (jobId, statusData) => {
  try {
    const response = await api.put(`/jobs/${jobId}/status`, statusData);
    return response.data;
  } catch (error) {
    console.error(`Error updating job ${jobId} status:`, error);
    throw error;
  }
};

// Complete a door for a job
export const completeDoor = async (jobId, doorId, completionData) => {
  try {
    const response = await api.post(`/jobs/${jobId}/doors/${doorId}/complete`, completionData);
    return response.data;
  } catch (error) {
    console.error(`Error completing door ${doorId} for job ${jobId}:`, error);
    throw error;
  }
};
