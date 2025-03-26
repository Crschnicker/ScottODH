import api from './api';

// Get all bids
export const getBids = async () => {
  try {
    const response = await api.get('/bids');
    return response.data;
  } catch (error) {
    console.error('Error getting bids:', error);
    throw error;
  }
};

// Get bid by ID
export const getBid = async (id) => {
  try {
    const response = await api.get(`/bids/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting bid ${id}:`, error);
    throw error;
  }
};

// Create a new bid
export const createBid = async (estimateId) => {
  try {
    const response = await api.post(`/estimates/${estimateId}/bids`);
    return response.data;
  } catch (error) {
    console.error('Error creating bid:', error);
    throw error;
  }
};

// Add a door to a bid
export const addDoor = async (bidId, doorData = {}) => {
  try {
    const response = await api.post(`/bids/${bidId}/doors`, doorData);
    return response.data;
  } catch (error) {
    console.error(`Error adding door to bid ${bidId}:`, error);
    throw error;
  }
};

// Add a line item to a door
export const addLineItem = async (doorId, lineItemData) => {
  try {
    const response = await api.post(`/doors/${doorId}/line-items`, lineItemData);
    return response.data;
  } catch (error) {
    console.error(`Error adding line item to door ${doorId}:`, error);
    throw error;
  }
};

// Duplicate a door
export const duplicateDoor = async (doorId, targetData) => {
  try {
    const response = await api.post(`/doors/${doorId}/duplicate`, targetData);
    return response.data;
  } catch (error) {
    console.error(`Error duplicating door ${doorId}:`, error);
    throw error;
  }
};

// Approve a bid and create a job
export const approveBid = async (bidId, jobData) => {
  try {
    const response = await api.post(`/bids/${bidId}/approve`, jobData);
    return response.data;
  } catch (error) {
    console.error(`Error approving bid ${bidId}:`, error);
    throw error;
  }
};

// Generate bid report
export const generateBidReport = (bidId) => {
  return `/api/bids/${bidId}/report`;
};

// Generate bid proposal
export const generateBidProposal = (bidId) => {
  return `/api/bids/${bidId}/proposal`;
};
