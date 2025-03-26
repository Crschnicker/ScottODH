import api from './api';

// Get all estimates
export const getEstimates = async () => {
  try {
    const response = await api.get('/estimates');
    return response.data;
  } catch (error) {
    console.error('Error getting estimates:', error);
    throw error;
  }
};

// Get estimate by ID
export const getEstimate = async (id) => {
  try {
    const response = await api.get(`/estimates/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting estimate ${id}:`, error);
    throw error;
  }
};

// Create a new estimate
export const createEstimate = async (estimateData) => {
  try {
    const response = await api.post('/estimates', estimateData);
    return response.data;
  } catch (error) {
    console.error('Error creating estimate:', error);
    throw error;
  }
};

// Update estimate status
export const updateEstimateStatus = async (id, status) => {
  try {
    const response = await api.put(`/estimates/${id}/status`, { status });
    return response.data;
  } catch (error) {
    console.error(`Error updating estimate ${id} status:`, error);
    throw error;
  }
};
