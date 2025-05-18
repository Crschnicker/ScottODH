import api from './api';

/**
 * Get all estimates
 * @returns {Promise<Array>} Promise resolving to an array of estimates
 */
export const getEstimates = async () => {
  try {
    const response = await api.get('/estimates');
    return response.data;
  } catch (error) {
    console.error('Error getting estimates:', error);
    throw error;
  }
};

/**
 * Get estimate by ID
 * @param {number|string} id - The estimate ID
 * @returns {Promise<Object>} Promise resolving to the estimate data
 */
export const getEstimate = async (id) => {
  try {
    const response = await api.get(`/estimates/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting estimate ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new estimate with optional scheduling information
 * @param {Object} estimateData - Complete estimate data including scheduling fields
 * @returns {Promise<Object>} Promise resolving to the created estimate
 */
export const createEstimate = async (estimateData) => {
  try {
    // Send the complete estimate data to properly include scheduling information
    const response = await api.post('/estimates', estimateData);
    return response.data;
  } catch (error) {
    // Log detailed error and rethrow for component handling
    console.error('Error creating estimate:', error);
    
    // Provide more helpful error message based on error type
    if (error.type === 'request_error') {
      if (!error.online) {
        throw new Error('Unable to connect to server. Please check your internet connection.');
      } else {
        throw new Error('Server is not responding. Please try again later.');
      }
    } else if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    } else {
      throw error;
    }
  }
};

/**
 * Schedule an estimate
 * @param {number|string} id - The estimate ID
 * @param {Object} scheduleData - The scheduling information
 * @returns {Promise<Object>} Promise resolving to the updated estimate
 */
export const scheduleEstimate = async (id, scheduleData) => {
  try {
    const response = await api.post(`/estimates/${id}/schedule`, scheduleData);
    return response.data;
  } catch (error) {
    console.error(`Error scheduling estimate ${id}:`, error);
    throw error;
  }
};

/**
 * Unschedule an estimate (cancel appointment)
 * @param {number|string} id - The estimate ID
 * @returns {Promise<Object>} Promise resolving to the updated estimate
 */
export const unscheduleEstimate = async (id) => {
  try {
    const response = await api.post(`/estimates/${id}/unschedule`);
    return response.data;
  } catch (error) {
    console.error(`Error unscheduling estimate ${id}:`, error);
    throw error;
  }
};

/**
 * Update estimate status
 * @param {number|string} id - The estimate ID
 * @param {string} status - The new status
 * @returns {Promise<Object>} Promise resolving to the updated estimate
 */
export const updateEstimateStatus = async (id, status) => {
  try {
    const response = await api.put(`/estimates/${id}/status`, { status });
    return response.data;
  } catch (error) {
    console.error(`Error updating estimate ${id} status:`, error);
    throw error;
  }
};

/**
 * Get sites by customer ID
 * @param {number|string} customerId - The customer ID
 * @returns {Promise<Array>} Promise resolving to an array of sites
 */
export const getSitesByCustomerId = async (customerId) => {
  try {
    const response = await api.get(`/customers/${customerId}/sites`);
    return response.data;
  } catch (error) {
    console.error(`Error getting sites for customer ${customerId}:`, error);
    throw error;
  }
};

/**
 * Create a new site for a customer
 * @param {number|string} customerId - The customer ID
 * @param {Object} siteData - The site data
 * @returns {Promise<Object>} Promise resolving to the created site
 */
export const createSite = async (customerId, siteData) => {
  try {
    const response = await api.post(`/customers/${customerId}/sites`, siteData);
    return response.data;
  } catch (error) {
    console.error(`Error creating site for customer ${customerId}:`, error);
    throw error;
  }
};

/**
 * Updates an estimate with door information
 * @param {number|string} estimateId - The ID of the estimate to update
 * @param {Array} doors - Array of door objects to save with the estimate
 * @returns {Promise<Object>} Promise resolving to the updated estimate data
 */
export const updateEstimateWithDoors = async (estimateId, doors) => {
  try {
    const response = await api.put(`/estimates/${estimateId}/doors`, { doors });
    return response.data;
  } catch (error) {
    console.error('Error updating estimate with doors:', error);
    throw error;
  }
};

/**
 * Gets the doors for an estimate
 * @param {number|string} estimateId - The ID of the estimate
 * @returns {Promise<Array>} Promise resolving to the doors data
 */
export const getEstimateDoors = async (estimateId) => {
  try {
    const response = await api.get(`/estimates/${estimateId}/doors`);
    return response.data.doors || [];
  } catch (error) {
    console.error('Error getting estimate doors:', error);
    return [];
  }
};

/**
 * Get scheduled estimates within a date range
 * @param {string} startDate - ISO string for range start
 * @param {string} endDate - ISO string for range end
 * @returns {Promise<Array>} Promise resolving to array of scheduled estimates
 */
export const getScheduledEstimates = async (startDate, endDate) => {
  try {
    const response = await api.get('/estimates/scheduled', {
      params: { startDate, endDate }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching scheduled estimates:', error);
    throw error;
  }
};