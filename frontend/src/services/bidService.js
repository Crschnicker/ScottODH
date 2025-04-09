import api from './api';
import axios from 'axios';

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

// New function to add doors to a bid
export const addDoorsToBid = async (bidId, doorsData) => {
  try {
    // First, create the doors
    const doors = [];
    
    for (let i = 0; i < doorsData.length; i++) {
      const doorData = doorsData[i];
      console.log('Door data:', doorData);
      
      // Find location in the details if present
      let location = '';
      if (doorData.details) {
        const locationDetail = doorData.details.find(detail => 
          detail.toLowerCase().startsWith('location:')
        );
        
        if (locationDetail) {
          location = locationDetail.split(':')[1].trim();
          console.log(`Found location: "${location}" for door #${doorData.door_number}`);
        }
      }
      
      console.log(`Adding door #${doorData.door_number} to bid ${bidId}`);
      console.log('Door data:', doorData);
      
      // Create the door with the location
      const response = await axios.post(`/api/bids/${bidId}/doors`, {
        door_number: doorData.door_number,
        location: location
      });
      
      const doorId = response.data.id;
      console.log(`Door added successfully, got door ID: ${doorId}`);
      
      // Now add all the details as line items
      if (doorData.details && doorData.details.length > 0) {
        for (const detail of doorData.details) {
          await axios.post(`/api/doors/${doorId}/line-items`, {
            description: detail,
            quantity: 1,
            price: 0,
            labor_hours: 0,
            hardware: 0
          });
        }
      }
      
      doors.push({
        id: doorId,
        door_number: doorData.door_number,
        description: doorData.location ? 
          `Door #${doorData.door_number} (${doorData.location})` : 
          `Door #${doorData.door_number}`
      });
    }
    
    console.log('Doors added to bid:', { bidId, doors });
    return { bidId, doors };
  } catch (error) {
    console.error('Error adding doors to bid:', error);
    throw error;
  }
};