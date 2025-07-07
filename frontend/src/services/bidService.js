import api from './api';

/**
 * Get all bids
 * @returns {Promise} Promise resolving to array of bids
 */
export const getBids = async () => {
  try {
    const response = await api.get('/bids');
    return response.data;
  } catch (error) {
    console.error('Error getting bids:', error);
    throw error;
  }
};

/**
 * Get bid by ID with full details including doors and line items
 * @param {number} id - The bid ID
 * @returns {Promise} Promise resolving to bid data
 */
export const getBid = async (id) => {
  try {
    const response = await api.get(`/bids/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting bid ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new bid from an estimate
 * @param {number} estimateId - The estimate ID to create bid from
 * @returns {Promise} Promise resolving to new bid data
 */
export const createBid = async (estimateId) => {
  try {
    const response = await api.post(`/bids/estimates/${estimateId}`);
    return response.data;
  } catch (error) {
    console.error('Error creating bid:', error);
    throw error;
  }
};

/**
 * Get bid summary with calculated totals
 * @param {number} bidId - The bid ID
 * @returns {Promise} Promise resolving to bid summary data
 */
export const getBidSummary = async (bidId) => {
  try {
    const response = await api.get(`/bids/${bidId}/summary`);
    return response.data;
  } catch (error)
  {
    console.error(`Error getting bid summary for ${bidId}:`, error);
    throw error;
  }
};

/**
 * Add a door to a bid
 * @param {number} bidId - The bid ID
 * @param {object} doorData - Door data (optional)
 * @returns {Promise} Promise resolving to new door data
 */
export const addDoor = async (bidId, doorData = {}) => {
  try {
    const response = await api.post(`/bids/${bidId}/doors`, doorData);
    return response.data;
  } catch (error) {
    console.error(`Error adding door to bid ${bidId}:`, error);
    throw error;
  }
};

/**
 * Update door information
 * @param {number} bidId - The bid ID
 * @param {number} doorId - The door ID
 * @param {object} doorData - Updated door data
 * @returns {Promise} Promise resolving to updated door data
 */
export const updateDoor = async (bidId, doorId, doorData) => {
  try {
    const response = await api.put(`/bids/${bidId}/doors/${doorId}`, doorData);
    return response.data;
  } catch (error) {
    console.error(`Error updating door ${doorId}:`, error);
    throw error;
  }
};

/**
 * Delete a door and all its line items
 * @param {number} bidId - The bid ID
 * @param {number} doorId - The door ID
 * @returns {Promise} Promise resolving to deletion confirmation
 */
export const deleteDoor = async (bidId, doorId) => {
  try {
    const response = await api.delete(`/bids/${bidId}/doors/${doorId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting door ${doorId}:`, error);
    throw error;
  }
};

/**
 * Add a line item to a door
 * @param {number} doorId - The door ID
 * @param {object} lineItemData - Line item data
 * @returns {Promise} Promise resolving to new line item data
 */
export const addLineItem = async (doorId, lineItemData) => {
  try {
    const response = await api.post(`/doors/${doorId}/line-items`, lineItemData);
    return response.data;
  } catch (error) {
    console.error(`Error adding line item to door ${doorId}:`, error);
    throw error;
  }
};

/**
 * Update an existing line item
 * @param {number} doorId - The door ID
 * @param {number} lineItemId - The line item ID
 * @param {object} data - Updated line item data
 * @returns {Promise} Promise resolving to updated line item data
 */
export const updateLineItem = async (doorId, lineItemId, data) => {
  try {
    const response = await api.put(`/doors/${doorId}/line-items/${lineItemId}`, data);
    return response.data;
  } catch (error) {
    console.error(`Error updating line item ${lineItemId}:`, error);
    throw error;
  }
};

/**
 * Delete a line item
 * @param {number} doorId - The door ID
 * @param {number} lineItemId - The line item ID
 * @returns {Promise} Promise resolving to deletion confirmation
 */
export const deleteLineItem = async (doorId, lineItemId) => {
  try {
    const response = await api.delete(`/doors/${doorId}/line-items/${lineItemId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting line item ${lineItemId}:`, error);
    throw error;
  }
};

/**
 * Duplicate a door configuration to multiple target doors
 * @param {number} doorId - Source door ID
 * @param {object} targetData - Target configuration
 * @returns {Promise} Promise resolving to duplication results
 */
export const duplicateDoor = async (doorId, targetData) => {
  try {
    const response = await api.post(`/doors/${doorId}/duplicate`, targetData);
    return response.data;
  } catch (error) {
    console.error(`Error duplicating door ${doorId}:`, error);
    throw error;
  }
};

/**
 * Approve a bid and create a job
 * @param {number} bidId - The bid ID
 * @param {object} jobData - Job creation data
 * @returns {Promise} Promise resolving to new job data
 */
export const approveBid = async (bidId, jobData) => {
  try {
    const response = await api.post(`/bids/${bidId}/approve`, jobData);
    return response.data;
  } catch (error) {
    console.error(`Error approving bid ${bidId}:`, error);
    throw error;
  }
};

/**
 * Update bid metadata (status, notes, etc.)
 * @param {number} bidId - The bid ID
 * @param {object} bidData - Updated bid data
 * @returns {Promise} Promise resolving to updated bid data
 */
export const updateBid = async (bidId, bidData) => {
  try {
    const response = await api.put(`/bids/${bidId}`, bidData);
    return response.data;
  } catch (error) {
    console.error(`Error updating bid ${bidId}:`, error);
    throw error;
  }
};

/**
 * Save all pending changes for a bid (bulk update)
 * @param {number} bidId - The bid ID
 * @param {object} changes - All pending changes
 * @returns {Promise} Promise resolving to save confirmation
 */
export const saveBidChanges = async (bidId, changes) => {
  try {
    if (!bidId || !changes) {
      throw new Error('Bid ID and changes data are required');
    }
    const response = await api.put(`/bids/${bidId}/save-changes`, changes);
    return response.data;
  } catch (error) {
    console.error(`Error saving bid changes for ${bidId}:`, error);
    throw error;
  }
};

/**
 * Comprehensive save of entire bid including all doors and line items
 * @param {number} bidId - The bid ID
 * @param {object} bidData - Complete bid data structure
 * @returns {Promise} Promise resolving to save confirmation
 */
export const saveCompleteBid = async (bidId, bidData) => {
  try {
    if (!bidId || !bidData) {
      throw new Error('Bid ID and bid data are required');
    }
    const saveData = {
      bid_metadata: {
        status: bidData.status || 'draft',
        notes: bidData.notes || '',
      },
      doors: bidData.doors?.map(door => ({
        id: door.id,
        door_number: door.door_number,
        location: door.location || '',
        description: door.description || '',
        line_items: door.line_items?.map(item => ({
          id: item.id,
          description: item.description || '',
          quantity: parseFloat(item.quantity) || 0,
          price: parseFloat(item.price) || 0,
          labor_hours: parseFloat(item.labor_hours) || 0,
          hardware: parseFloat(item.hardware) || 0,
          part_number: item.part_number || ''
        })) || []
      })) || [],
      totals: calculateBidTotals(bidData.doors || [])
    };
    const response = await api.put(`/bids/${bidId}/save-complete`, saveData);
    return response.data;
  } catch (error) {
    console.error(`Error saving complete bid ${bidId}:`, error);
    throw error;
  }
};

/**
 * Auto-save bid data at regular intervals
 * @param {number} bidId - The bid ID
 * @param {object} bidData - Current bid data
 * @returns {Promise} Promise resolving to save confirmation
 */
export const autoSaveBid = async (bidId, bidData) => {
  try {
    const autoSaveData = {
      last_modified: new Date().toISOString(),
      doors: bidData.doors?.map(door => ({
        id: door.id,
        line_items: door.line_items?.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          labor_hours: item.labor_hours,
          hardware: item.hardware
        })) || []
      })) || []
    };
    const response = await api.put(`/bids/${bidId}/auto-save`, autoSaveData);
    return response.data;
  } catch (error) {
    console.warn(`Auto-save failed for bid ${bidId}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Validate bid data before saving
 * @param {object} bidData - Bid data to validate
 * @returns {object} Validation result with errors if any
 */
export const validateBidData = (bidData) => {
  const errors = [];
  const warnings = [];
  if (!bidData.doors || bidData.doors.length === 0) {
    errors.push('Bid must have at least one door');
  }
  bidData.doors?.forEach((door, doorIndex) => {
    if (!door.door_number) {
      errors.push(`Door ${doorIndex + 1} is missing a door number`);
    }
    if (!door.line_items || door.line_items.length === 0) {
      warnings.push(`Door #${door.door_number} has no line items`);
    }
    door.line_items?.forEach((item, itemIndex) => {
      if (!item.description || item.description.trim() === '') {
        errors.push(`Door #${door.door_number}, Item ${itemIndex + 1}: Description is required`);
      }
      if (item.quantity <= 0) {
        errors.push(`Door #${door.door_number}, Item ${itemIndex + 1}: Quantity must be greater than 0`);
      }
      if (item.price < 0) {
        errors.push(`Door #${door.door_number}, Item ${itemIndex + 1}: Price cannot be negative`);
      }
    });
  });
  return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Generate bid report URL
 * @param {number} bidId - The bid ID
 * @returns {string} Report URL
 */
export const generateBidReport = (bidId) => {
  return `${api.defaults.baseURL}/bids/${bidId}/report`;
};

/**
 * Generate bid proposal URL
 * @param {number} bidId - The bid ID
 * @returns {string} Proposal URL
 */
export const generateBidProposal = (bidId) => {
  return `${api.defaults.baseURL}/bids/${bidId}/proposal`;
};

/**
 * Bulk add doors to a bid from parsed door data
 * @param {number} bidId - The bid ID
 * @param {Array} doorsData - Array of door data objects
 * @returns {Promise} Promise resolving to added doors summary
 */
export const addDoorsToBid = async (bidId, doorsData) => {
  try {
    const doors = [];
    for (let i = 0; i < doorsData.length; i++) {
      const doorData = doorsData[i];
      let location = '';
      if (doorData.details) {
        const locationDetail = doorData.details.find(detail => 
          detail.toLowerCase().startsWith('location:')
        );
        if (locationDetail) {
          location = locationDetail.split(':')[1].trim();
        }
      }
      
      const doorResponse = await api.post(`/bids/${bidId}/doors`, {
        door_number: doorData.door_number,
        location: location
      });
      
      const doorId = doorResponse.data.id;
      
      if (doorData.details && doorData.details.length > 0) {
        for (const detail of doorData.details) {
          if (!detail.toLowerCase().startsWith('location:')) {
            await api.post(`/doors/${doorId}/line-items`, {
              description: detail,
              quantity: 1,
              price: 0,
              labor_hours: 0,
              hardware: 0
            });
          }
        }
      }
      
      doors.push({
        id: doorId,
        door_number: doorData.door_number,
        description: location ? 
          `Door #${doorData.door_number} (${location})` : 
          `Door #${doorData.door_number}`,
        location: location
      });
    }
    
    return { bidId, doors, count: doors.length };
    
  } catch (error) {
    console.error('Error adding doors to bid:', error);
    throw error;
  }
};

/**
 * Helper function to calculate bid totals from door data
 * @param {Array} doors - Array of door objects with line items
 * @returns {object} Calculated totals
 */
export const calculateBidTotals = (doors) => {
  if (!doors || doors.length === 0) {
    return {
      totalQuantity: 0, totalPartsPrice: 0, totalLaborHours: 0, totalLaborCost: 0,
      totalHardwareCost: 0, totalBeforeTax: 0, taxAmount: 0, totalWithTax: 0, doorCount: 0
    };
  }
  const LABOR_RATE = 47.02;
  const TAX_RATE = 0.0875;
  return doors.reduce((bidTotals, door) => {
    const doorTotals = (door.line_items || []).reduce((doorSum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      const laborHours = parseFloat(item.labor_hours) || 0;
      const hardware = parseFloat(item.hardware) || 0;
      return {
        totalQuantity: doorSum.totalQuantity + quantity,
        totalPartsPrice: doorSum.totalPartsPrice + (quantity * price),
        totalLaborHours: doorSum.totalLaborHours + laborHours,
        totalLaborCost: doorSum.totalLaborCost + (laborHours * LABOR_RATE),
        totalHardwareCost: doorSum.totalHardwareCost + hardware
      };
    }, { totalQuantity: 0, totalPartsPrice: 0, totalLaborHours: 0, totalLaborCost: 0, totalHardwareCost: 0 });
    const newTotals = {
      totalQuantity: bidTotals.totalQuantity + doorTotals.totalQuantity,
      totalPartsPrice: bidTotals.totalPartsPrice + doorTotals.totalPartsPrice,
      totalLaborHours: bidTotals.totalLaborHours + doorTotals.totalLaborHours,
      totalLaborCost: bidTotals.totalLaborCost + doorTotals.totalLaborCost,
      totalHardwareCost: bidTotals.totalHardwareCost + doorTotals.totalHardwareCost,
      doorCount: bidTotals.doorCount + 1
    };
    newTotals.totalBeforeTax = newTotals.totalPartsPrice + newTotals.totalLaborCost + newTotals.totalHardwareCost;
    newTotals.taxAmount = (newTotals.totalPartsPrice + newTotals.totalHardwareCost) * TAX_RATE;
    newTotals.totalWithTax = newTotals.totalBeforeTax + newTotals.taxAmount;
    return newTotals;
  }, { totalQuantity: 0, totalPartsPrice: 0, totalLaborHours: 0, totalLaborCost: 0, totalHardwareCost: 0, totalBeforeTax: 0, taxAmount: 0, totalWithTax: 0, doorCount: 0 });
};

// =================================================================
// === CORRECTED DEFAULT EXPORT OBJECT                           ===
// =================================================================
// This list only contains functions that are actually defined in this file.
// `exportBid` and `validateBid` were removed because they were not defined.
export default {
  getBids,
  getBid,
  createBid,
  addDoor,
  updateDoor,
  deleteDoor,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  duplicateDoor,
  approveBid,
  updateBid,
  saveBidChanges,
  saveCompleteBid,
  autoSaveBid,
  validateBidData,
  generateBidReport,
  generateBidProposal,
  addDoorsToBid,
  getBidSummary,
  // Removed `exportBid`
  // Removed `validateBid`
  // Removed `getBidHistory`
  // Removed `restoreBidVersion`
  // Removed `cloneBid`
  calculateBidTotals,
};