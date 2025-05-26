import api from './api';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
    const response = await api.post(`/estimates/${estimateId}/bids`);
    return response.data;
  } catch (error) {
    console.error('Error creating bid:', error);
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
    // Validate input data
    if (!bidId || !changes) {
      throw new Error('Bid ID and changes data are required');
    }

    console.log('Saving bid changes:', { bidId, changes });
    
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
    // Validate input data
    if (!bidId || !bidData) {
      throw new Error('Bid ID and bid data are required');
    }

    console.log('Saving complete bid:', { bidId, bidData });
    
    // Structure the data for the comprehensive save endpoint
    const saveData = {
      bid_metadata: {
        status: bidData.status || 'draft',
        notes: bidData.notes || '',
        // Include any other bid-level metadata
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
      // Include calculated totals for verification
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
    // Use a lighter save operation for auto-save
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
    // Auto-save failures should be silent to avoid disrupting user workflow
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

  // Check if bid has doors
  if (!bidData.doors || bidData.doors.length === 0) {
    errors.push('Bid must have at least one door');
  }

  // Validate each door
  bidData.doors?.forEach((door, doorIndex) => {
    if (!door.door_number) {
      errors.push(`Door ${doorIndex + 1} is missing a door number`);
    }

    // Check for line items
    if (!door.line_items || door.line_items.length === 0) {
      warnings.push(`Door #${door.door_number} has no line items`);
    }

    // Validate line items
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

      if (item.labor_hours < 0) {
        errors.push(`Door #${door.door_number}, Item ${itemIndex + 1}: Labor hours cannot be negative`);
      }

      if (item.hardware < 0) {
        errors.push(`Door #${door.door_number}, Item ${itemIndex + 1}: Hardware cost cannot be negative`);
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Generate bid report URL
 * @param {number} bidId - The bid ID
 * @returns {string} Report URL
 */
export const generateBidReport = (bidId) => {
  return `${API_BASE_URL}/bids/${bidId}/report`;
};

/**
 * Generate bid proposal URL
 * @param {number} bidId - The bid ID
 * @returns {string} Proposal URL
 */
export const generateBidProposal = (bidId) => {
  return `${API_BASE_URL}/bids/${bidId}/proposal`;
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
      console.log('Processing door data:', doorData);
      
      // Extract location from details if present
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
      
      // Create the door with location
      const doorResponse = await api.post(`/bids/${bidId}/doors`, {
        door_number: doorData.door_number,
        location: location
      });
      
      const doorId = doorResponse.data.id;
      console.log(`Door added successfully, got door ID: ${doorId}`);
      
      // Add all details as line items (except location which is already set)
      if (doorData.details && doorData.details.length > 0) {
        for (const detail of doorData.details) {
          // Skip location detail as it's already been processed
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
    
    console.log('All doors added to bid successfully:', { bidId, doors });
    return { bidId, doors, count: doors.length };
    
  } catch (error) {
    console.error('Error adding doors to bid:', error);
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
  } catch (error) {
    console.error(`Error getting bid summary for ${bidId}:`, error);
    throw error;
  }
};

/**
 * Export bid data in various formats
 * @param {number} bidId - The bid ID
 * @param {string} format - Export format ('pdf', 'excel', 'csv')
 * @returns {Promise} Promise resolving to export data/URL
 */
export const exportBid = async (bidId, format = 'pdf') => {
  try {
    const response = await api.get(`/bids/${bidId}/export`, {
      params: { format },
      responseType: format === 'pdf' ? 'blob' : 'json'
    });
    return response.data;
  } catch (error) {
    console.error(`Error exporting bid ${bidId} as ${format}:`, error);
    throw error;
  }
};

/**
 * Validate bid data before submission
 * @param {number} bidId - The bid ID
 * @returns {Promise} Promise resolving to validation results
 */
export const validateBid = async (bidId) => {
  try {
    const response = await api.post(`/bids/${bidId}/validate`);
    return response.data;
  } catch (error) {
    console.error(`Error validating bid ${bidId}:`, error);
    throw error;
  }
};

/**
 * Get bid change history/audit trail
 * @param {number} bidId - The bid ID
 * @returns {Promise} Promise resolving to change history
 */
export const getBidHistory = async (bidId) => {
  try {
    const response = await api.get(`/bids/${bidId}/history`);
    return response.data;
  } catch (error) {
    console.error(`Error getting bid history for ${bidId}:`, error);
    throw error;
  }
};

/**
 * Restore bid to a previous version
 * @param {number} bidId - The bid ID
 * @param {number} versionId - The version to restore to
 * @returns {Promise} Promise resolving to restored bid data
 */
export const restoreBidVersion = async (bidId, versionId) => {
  try {
    const response = await api.post(`/bids/${bidId}/restore`, { versionId });
    return response.data;
  } catch (error) {
    console.error(`Error restoring bid ${bidId} to version ${versionId}:`, error);
    throw error;
  }
};

/**
 * Clone/copy an existing bid
 * @param {number} bidId - The source bid ID
 * @param {object} newBidData - Data for the new bid
 * @returns {Promise} Promise resolving to new bid data
 */
export const cloneBid = async (bidId, newBidData) => {
  try {
    const response = await api.post(`/bids/${bidId}/clone`, newBidData);
    return response.data;
  } catch (error) {
    console.error(`Error cloning bid ${bidId}:`, error);
    throw error;
  }
};

/**
 * Utility function to check if there are unsaved changes
 * This can be used by components to determine if they need to save before navigation
 * @returns {boolean} True if there are unsaved changes
 */
export const hasUnsavedChanges = () => {
  // Check for the presence of unsaved changes warning in the DOM
  return !!document.querySelector('.alert-warning');
};

/**
 * Utility function to save all pending changes across all components
 * @returns {Promise} Promise resolving when all changes are saved
 */
export const saveAllPendingChanges = async () => {
  try {
    // Call the global save function if it exists
    if (window.lineItemTableSaveAll) {
      await window.lineItemTableSaveAll();
    }
    
    // Add any other component save functions here
    // if (window.otherComponentSaveAll) {
    //   await window.otherComponentSaveAll();
    // }
    
    return true;
  } catch (error) {
    console.error('Error saving all pending changes:', error);
    throw error;
  }
};

/**
 * Helper function to format currency values consistently
 * @param {number} value - The numeric value
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value) => {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

/**
 * Helper function to calculate bid totals from door data
 * @param {Array} doors - Array of door objects with line items
 * @returns {object} Calculated totals
 */
export const calculateBidTotals = (doors) => {
  if (!doors || doors.length === 0) {
    return {
      totalQuantity: 0,
      totalPartsPrice: 0,
      totalLaborHours: 0,
      totalLaborCost: 0,
      totalHardwareCost: 0,
      totalBeforeTax: 0,
      taxAmount: 0,
      totalWithTax: 0,
      doorCount: 0
    };
  }

  const LABOR_RATE = 47.02; // $47.02 per hour
  const TAX_RATE = 0.0875; // 8.75%

  return doors.reduce((bidTotals, door) => {
    const doorTotals = (door.line_items || []).reduce((doorSum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      const laborHours = parseFloat(item.labor_hours) || 0;
      const hardware = parseFloat(item.hardware) || 0;
      const partsPrice = quantity * price;
      const laborCost = laborHours * LABOR_RATE;

      return {
        totalQuantity: doorSum.totalQuantity + quantity,
        totalPartsPrice: doorSum.totalPartsPrice + partsPrice,
        totalLaborHours: doorSum.totalLaborHours + laborHours,
        totalLaborCost: doorSum.totalLaborCost + laborCost,
        totalHardwareCost: doorSum.totalHardwareCost + hardware
      };
    }, {
      totalQuantity: 0,
      totalPartsPrice: 0,
      totalLaborHours: 0,
      totalLaborCost: 0,
      totalHardwareCost: 0
    });

    const newTotals = {
      totalQuantity: bidTotals.totalQuantity + doorTotals.totalQuantity,
      totalPartsPrice: bidTotals.totalPartsPrice + doorTotals.totalPartsPrice,
      totalLaborHours: bidTotals.totalLaborHours + doorTotals.totalLaborHours,
      totalLaborCost: bidTotals.totalLaborCost + doorTotals.totalLaborCost,
      totalHardwareCost: bidTotals.totalHardwareCost + doorTotals.totalHardwareCost,
      doorCount: bidTotals.doorCount + 1
    };

    // Calculate subtotal (parts + hardware, labor is separate)
    newTotals.totalBeforeTax = newTotals.totalPartsPrice + newTotals.totalLaborCost + newTotals.totalHardwareCost;
    
    // Calculate tax (on parts + hardware only, not labor)
    newTotals.taxAmount = (newTotals.totalPartsPrice + newTotals.totalHardwareCost) * TAX_RATE;
    
    // Calculate total with tax
    newTotals.totalWithTax = newTotals.totalBeforeTax + newTotals.taxAmount;

    return newTotals;
  }, {
    totalQuantity: 0,
    totalPartsPrice: 0,
    totalLaborHours: 0,
    totalLaborCost: 0,
    totalHardwareCost: 0,
    totalBeforeTax: 0,
    taxAmount: 0,
    totalWithTax: 0,
    doorCount: 0
  });
};

/**
 * Auto-save manager for bid data
 */
export class BidAutoSaveManager {
  constructor(bidId, onSave = null, interval = 30000) { // 30 seconds default
    this.bidId = bidId;
    this.onSave = onSave;
    this.interval = interval;
    this.timeoutId = null;
    this.isEnabled = true;
    this.lastSaveData = null;
  }

  /**
   * Enable auto-save
   */
  enable() {
    this.isEnabled = true;
  }

  /**
   * Disable auto-save
   */
  disable() {
    this.isEnabled = false;
    this.clearTimeout();
  }

  /**
   * Schedule an auto-save operation
   * @param {object} bidData - Current bid data
   */
  scheduleAutoSave(bidData) {
    if (!this.isEnabled) return;

    // Clear existing timeout
    this.clearTimeout();

    // Check if data has actually changed
    if (this.lastSaveData && JSON.stringify(bidData) === JSON.stringify(this.lastSaveData)) {
      return; // No changes, no need to save
    }

    // Schedule the save
    this.timeoutId = setTimeout(async () => {
      try {
        await autoSaveBid(this.bidId, bidData);
        this.lastSaveData = JSON.parse(JSON.stringify(bidData)); // Deep copy
        
        if (this.onSave) {
          this.onSave({ success: true, timestamp: new Date() });
        }
        
        console.log(`Auto-saved bid ${this.bidId} at ${new Date().toISOString()}`);
      } catch (error) {
        console.warn('Auto-save failed:', error);
        
        if (this.onSave) {
          this.onSave({ success: false, error, timestamp: new Date() });
        }
      }
    }, this.interval);
  }

  /**
   * Clear the current timeout
   */
  clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Destroy the auto-save manager
   */
  destroy() {
    this.disable();
    this.onSave = null;
  }
}

// Export all functions as default
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
  exportBid,
  validateBid,
  getBidHistory,
  restoreBidVersion,
  cloneBid,
  hasUnsavedChanges,
  saveAllPendingChanges,
  formatCurrency,
  calculateBidTotals,
  BidAutoSaveManager
};