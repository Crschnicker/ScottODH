import api from './api';

/**
 * Logger for date operations to help debug timezone issues
 * @param {string} operation - The operation being performed
 * @param {any} input - The input data
 * @param {any} output - The output data
 * @param {string} message - Optional additional context message
 */
const logDateOperation = (operation, input, output, message = '') => {
  console.log(`[DATE DEBUG - ${operation}]${message ? ' ' + message : ''}`, {
    input: typeof input === 'object' ? JSON.parse(JSON.stringify(input)) : input,
    output: typeof output === 'object' ? JSON.parse(JSON.stringify(output)) : output,
    inputType: input instanceof Date ? 'Date object' : typeof input,
    outputType: output instanceof Date ? 'Date object' : typeof output,
    timestamp: new Date().toISOString(),
    browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browserOffset: new Date().getTimezoneOffset()
  });
};

/**
 * Extracts time from a time string in various formats and returns hours and minutes
 * @param {string} timeStr - The time string (e.g., "1:30 PM", "13:30", "1 PM")
 * @returns {Object} Object with hours and minutes properties
 */
function parseTimeString(timeStr) {
  if (!timeStr) return { hours: 12, minutes: 0 }; // Default to noon
  
  let hours = 0;
  let minutes = 0;
  
  // Clean up and normalize the string
  const cleanTime = timeStr.trim().toUpperCase();
  const isPM = cleanTime.includes('PM');
  const isAM = cleanTime.includes('AM');
  
  // Remove AM/PM indicators for parsing
  const numericPart = cleanTime.replace(/\s?[AP]M/, '').trim();
  
  if (numericPart.includes(':')) {
    // Format: "1:30" or "13:30"
    const [hourStr, minuteStr] = numericPart.split(':');
    hours = parseInt(hourStr, 10);
    minutes = parseInt(minuteStr, 10);
  } else {
    // Format: "1" or "13"
    hours = parseInt(numericPart, 10);
    minutes = 0;
  }
  
  // Convert from 12-hour to 24-hour format if needed
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  
  return { hours, minutes };
}

/**
 * Creates a formatted ISO datetime string without timezone info
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {number} day - Day of month
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes
 * @returns {string} Formatted ISO string without timezone (YYYY-MM-DDTHH:MM:00)
 */
function formatISODateTimeString(year, month, day, hours, minutes) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

/**
 * Get all estimates
 * @returns {Promise<Array>} Promise resolving to an array of estimates
 */
export const getEstimates = async () => {
  try {
    const response = await api.get('/estimates');
    
    // Log the received estimates for debugging
    console.log('[ESTIMATES] Received estimates:', response.data);
    
    // Look for scheduled estimates and log their dates
    const scheduledEstimates = response.data.filter(est => est.scheduled_date);
    if (scheduledEstimates.length > 0) {
      console.log('[ESTIMATES] Scheduled estimates dates:', 
        scheduledEstimates.map(est => ({
          id: est.id,
          scheduledDate: est.scheduled_date,
          parsedDate: est.scheduled_date ? new Date(est.scheduled_date) : null,
          localString: est.scheduled_date ? new Date(est.scheduled_date).toLocaleString() : null
        }))
      );
    }
    
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
    
    // Log the estimate data with detailed scheduling information
    if (response.data.scheduled_date) {
      logDateOperation('GET ESTIMATE', id, response.data.scheduled_date, 
        `Estimate #${id} has a scheduled date`);
      
      // Additional date conversion logging
      const parsedDate = new Date(response.data.scheduled_date);
      console.log(`[ESTIMATE ${id}] Scheduled date conversions:`, {
        original: response.data.scheduled_date,
        asDate: parsedDate,
        toISOString: parsedDate.toISOString(),
        toLocaleString: parsedDate.toLocaleString(),
        toLocaleDateString: parsedDate.toLocaleDateString(),
        toLocaleTimeString: parsedDate.toLocaleTimeString(),
        dateComponents: {
          year: parsedDate.getFullYear(),
          month: parsedDate.getMonth() + 1,
          day: parsedDate.getDate(),
          hours: parsedDate.getHours(),
          minutes: parsedDate.getMinutes()
        }
      });
    }
    
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
    // Log original data before any modifications
    console.log('[CREATE ESTIMATE] Original request data:', JSON.parse(JSON.stringify(estimateData)));
    
    let processedData = { ...estimateData };
    
    // Handle date from schedule_date and schedule_time fields if present
    if (processedData.schedule_date && processedData.schedule_time) {
      console.log('[CREATE ESTIMATE] Processing separate date and time fields:', {
        date: processedData.schedule_date,
        time: processedData.schedule_time
      });
      
      try {
        // Parse the date components
        const [year, month, day] = processedData.schedule_date.split('-').map(Number);
        
        // Parse the time string to extract hours and minutes
        const { hours, minutes } = parseTimeString(processedData.schedule_time);
        
        // Format the combined datetime as ISO string without timezone
        const formattedDate = formatISODateTimeString(year, month, day, hours, minutes);
        
        console.log('[CREATE ESTIMATE] Combined date and time:', {
          originalDate: processedData.schedule_date,
          originalTime: processedData.schedule_time,
          parsed: { year, month, day, hours, minutes },
          result: formattedDate
        });
        
        // Set the scheduled_date field with the formatted date
        processedData.scheduled_date = formattedDate;
        
      } catch (error) {
        console.error('[CREATE ESTIMATE] Error combining date and time:', error);
        // Keep the original scheduled_date if present
      }
    }
    // Handle existing scheduled_date field if present
    else if (processedData.scheduled_date) {
      logDateOperation('CREATE ESTIMATE - BEFORE PROCESSING', 
        processedData.scheduled_date, null, 'Processing scheduled date');
      
      // Process the scheduled_date to handle timezone issues
      processedData = handleScheduledDate(processedData);
      
      logDateOperation('CREATE ESTIMATE - AFTER PROCESSING', 
        estimateData.scheduled_date, processedData.scheduled_date, 
        'Processed scheduled date for API request');
    }
    
    // Send the complete estimate data to properly include scheduling information
    const response = await api.post('/estimates', processedData);
    
    // Log the response from the server
    if (response.data.scheduled_date) {
      logDateOperation('CREATE ESTIMATE - RESPONSE', 
        processedData.scheduled_date, response.data.scheduled_date, 
        `New estimate #${response.data.id} scheduled date from server`);
    }
    
    return response.data;
  } catch (error) {
    // Log detailed error and rethrow for component handling
    console.error('Error creating estimate:', error);
    
    // Enhanced error logging
    if (error.response) {
      console.error('[CREATE ESTIMATE] Server response error:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      console.error('[CREATE ESTIMATE] No response received:', error.request);
    } else {
      console.error('[CREATE ESTIMATE] Request setup error:', error.message);
    }
    
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
 * @param {number|string} estimateId - The estimate ID
 * @param {Object} scheduleData - The scheduling information
 * @returns {Promise<Object>} Promise resolving to the scheduled estimate
 */
export const scheduleEstimate = async (estimateId, scheduleData) => {
  try {
    // Log input data
    console.log(`[SCHEDULE ESTIMATE ${estimateId}] Original request data:`, 
      JSON.parse(JSON.stringify(scheduleData)));
    
    // Log timezone information
    console.log('[SCHEDULE ESTIMATE] Browser timezone information:', {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: new Date().getTimezoneOffset(),
      currentDate: new Date().toISOString(),
      currentDateLocal: new Date().toLocaleString()
    });
    
    // Create a copy for processing
    let processedData = { ...scheduleData };
    
    // Handle date from schedule_date and schedule_time fields if present
    if (processedData.schedule_date && processedData.schedule_time) {
      console.log(`[SCHEDULE ESTIMATE ${estimateId}] Processing separate date and time fields:`, {
        date: processedData.schedule_date,
        time: processedData.schedule_time
      });
      
      try {
        // Parse the date components
        const [year, month, day] = processedData.schedule_date.split('-').map(Number);
        
        // Parse the time string to extract hours and minutes
        const { hours, minutes } = parseTimeString(processedData.schedule_time);
        
        // Format the combined datetime as ISO string without timezone
        const formattedDate = formatISODateTimeString(year, month, day, hours, minutes);
        
        console.log(`[SCHEDULE ESTIMATE ${estimateId}] Combined date and time:`, {
          originalDate: processedData.schedule_date,
          originalTime: processedData.schedule_time,
          parsed: { year, month, day, hours, minutes },
          result: formattedDate
        });
        
        // Set the scheduled_date field with the formatted date
        processedData.scheduled_date = formattedDate;
        
      } catch (error) {
        console.error(`[SCHEDULE ESTIMATE ${estimateId}] Error combining date and time:`, error);
        // Use handleScheduledDate as fallback
        processedData = handleScheduledDate(processedData);
      }
    }
    // Handle existing scheduled_date field
    else {
      // Fix timezone issues by preserving the exact time the user selected
      const originalDate = scheduleData.scheduled_date;
      processedData = handleScheduledDate(scheduleData);
      
      // Log the date transformation
      logDateOperation('SCHEDULE ESTIMATE - DATE TRANSFORMATION', 
        originalDate, processedData.scheduled_date, 
        `Transformed date for estimate #${estimateId}`);
        
      // Additional date component logging
      if (originalDate instanceof Date) {
        console.log(`[SCHEDULE ESTIMATE ${estimateId}] Date component breakdown:`, {
          originalComponents: {
            year: originalDate.getFullYear(),
            month: originalDate.getMonth() + 1,
            day: originalDate.getDate(),
            hours: originalDate.getHours(),
            minutes: originalDate.getMinutes(),
            seconds: originalDate.getSeconds()
          },
          originalToString: originalDate.toString(),
          originalToISOString: originalDate.toISOString(),
          originalToLocaleString: originalDate.toLocaleString()
        });
      }
    }
    
    // Send the processed data to the server
    console.log(`[SCHEDULE ESTIMATE ${estimateId}] Sending to server:`, 
      JSON.parse(JSON.stringify(processedData)));
    
    const response = await api.post(`/estimates/${estimateId}/schedule`, processedData);
    
    // Log the response
    console.log(`[SCHEDULE ESTIMATE ${estimateId}] Server response:`, response.data);
    
    if (response.data.scheduled_date) {
      const responseDate = new Date(response.data.scheduled_date);
      console.log(`[SCHEDULE ESTIMATE ${estimateId}] Response date conversions:`, {
        original: response.data.scheduled_date,
        asDate: responseDate,
        toISOString: responseDate.toISOString(),
        toLocaleString: responseDate.toLocaleString(),
        dateComponents: {
          year: responseDate.getFullYear(),
          month: responseDate.getMonth() + 1,
          day: responseDate.getDate(),
          hours: responseDate.getHours(),
          minutes: responseDate.getMinutes()
        }
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('Error scheduling estimate:', error);
    
    // Enhanced error logging
    if (error.response) {
      console.error(`[SCHEDULE ESTIMATE ${estimateId}] Server response error:`, {
        status: error.response.status,
        data: error.response.data
      });
    }
    
    throw error;
  }
};

/**
 * Helper function to handle scheduled date timezone issues
 * @param {Object} data - Data object containing scheduled_date
 * @returns {Object} Modified data object with corrected scheduled_date
 */
function handleScheduledDate(data) {
  // Create a copy to avoid mutating the original object
  const modifiedData = { ...data };
  
  if (!modifiedData.scheduled_date) {
    return modifiedData;
  }
  
  console.log('[HANDLE SCHEDULED DATE] Processing date:', {
    input: modifiedData.scheduled_date,
    type: typeof modifiedData.scheduled_date,
    isDate: modifiedData.scheduled_date instanceof Date
  });
  
  // If it's a Date object, preserve the exact time by using ISO string without timezone
  if (modifiedData.scheduled_date instanceof Date) {
    // Get date parts in local timezone to preserve the exact time selected by user
    const year = modifiedData.scheduled_date.getFullYear();
    const month = modifiedData.scheduled_date.getMonth() + 1; // getMonth() is 0-indexed
    const day = modifiedData.scheduled_date.getDate();
    const hours = modifiedData.scheduled_date.getHours();
    const minutes = modifiedData.scheduled_date.getMinutes();
    
    console.log('[HANDLE SCHEDULED DATE] Date object components:', {
      year, month, day, hours, minutes,
      localString: modifiedData.scheduled_date.toLocaleString(),
      ISOString: modifiedData.scheduled_date.toISOString()
    });
    
    // Format as ISO string without timezone offset to preserve local time
    const formattedDate = formatISODateTimeString(year, month, day, hours, minutes);
    
    console.log('[HANDLE SCHEDULED DATE] Formatted date result:', {
      original: modifiedData.scheduled_date,
      formatted: formattedDate
    });
    
    modifiedData.scheduled_date = formattedDate;
  } 
  // If it's a simple YYYY-MM-DD string without time
  else if (typeof modifiedData.scheduled_date === 'string' && modifiedData.scheduled_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    console.log('[HANDLE SCHEDULED DATE] Processing YYYY-MM-DD string:', modifiedData.scheduled_date);
    
    // Add the time component if hour/minute are specified
    if (modifiedData.hour !== undefined && modifiedData.minute !== undefined) {
      const hour = modifiedData.hour.toString().padStart(2, '0');
      const minute = modifiedData.minute.toString().padStart(2, '0');
      const formattedDate = `${modifiedData.scheduled_date}T${hour}:${minute}:00`;
      
      console.log('[HANDLE SCHEDULED DATE] Added time components:', {
        original: modifiedData.scheduled_date,
        hour: modifiedData.hour,
        minute: modifiedData.minute,
        formatted: formattedDate
      });
      
      modifiedData.scheduled_date = formattedDate;
    } else {
      // Default to noon if no time specified
      const formattedDate = `${modifiedData.scheduled_date}T12:00:00`;
      
      console.log('[HANDLE SCHEDULED DATE] Using default noon time:', {
        original: modifiedData.scheduled_date,
        formatted: formattedDate
      });
      
      modifiedData.scheduled_date = formattedDate;
    }
  } 
  // Handle ISO string with timezone information (Z or +/-XX:XX)
  else if (typeof modifiedData.scheduled_date === 'string' && modifiedData.scheduled_date.includes('T')) {
    // Already in ISO format with time
    console.log('[HANDLE SCHEDULED DATE] Already in ISO format:', modifiedData.scheduled_date);
    
    // Check if it has timezone information
    if (modifiedData.scheduled_date.endsWith('Z') || 
        modifiedData.scheduled_date.includes('+') || 
        modifiedData.scheduled_date.includes('-', 10)) { // Look for timezone offset after position 10
      
      console.log('[HANDLE SCHEDULED DATE] Contains timezone information, extracting local components');
      
      // Parse it into a Date to get local components
      const parsedDate = new Date(modifiedData.scheduled_date);
      
      // Reconstruct without timezone info to preserve the exact time
      const year = parsedDate.getFullYear();
      const month = parsedDate.getMonth() + 1;
      const day = parsedDate.getDate();
      const hours = parsedDate.getHours();
      const minutes = parsedDate.getMinutes();
      
      // Generate consistent format without timezone
      const formattedDate = formatISODateTimeString(year, month, day, hours, minutes);
      
      console.log('[HANDLE SCHEDULED DATE] Removed timezone information:', {
        original: modifiedData.scheduled_date,
        formatted: formattedDate
      });
      
      modifiedData.scheduled_date = formattedDate;
    }
  }
  
  console.log('[HANDLE SCHEDULED DATE] Final processed date:', modifiedData.scheduled_date);
  
  return modifiedData;
}

/**
 * Unschedule an estimate (cancel appointment)
 * @param {number|string} id - The estimate ID
 * @returns {Promise<Object>} Promise resolving to the updated estimate
 */
export const unscheduleEstimate = async (id) => {
  try {
    console.log(`[UNSCHEDULE ESTIMATE] Canceling appointment for estimate #${id}`);
    
    const response = await api.post(`/estimates/${id}/unschedule`);
    
    console.log(`[UNSCHEDULE ESTIMATE] Response for estimate #${id}:`, response.data);
    
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
    console.log(`[UPDATE ESTIMATE STATUS] Changing estimate #${id} status to "${status}"`);
    
    const response = await api.put(`/estimates/${id}/status`, { status });
    
    console.log(`[UPDATE ESTIMATE STATUS] Response for estimate #${id}:`, response.data);
    
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
    console.log('[GET SCHEDULED ESTIMATES] Fetching for date range:', { startDate, endDate });
    
    const response = await api.get('/estimates/scheduled', {
      params: { startDate, endDate }
    });
    
    // Log the scheduled estimates with date information
    if (response.data.length > 0) {
      console.log('[GET SCHEDULED ESTIMATES] Received scheduled estimates:', 
        response.data.map(est => ({
          id: est.id,
          customer: est.customer_name,
          scheduledDate: est.scheduled_date,
          parsedDate: est.scheduled_date ? new Date(est.scheduled_date) : null,
          localString: est.scheduled_date ? new Date(est.scheduled_date).toLocaleString() : null
        }))
      );
    } else {
      console.log('[GET SCHEDULED ESTIMATES] No scheduled estimates found in range');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching scheduled estimates:', error);
    throw error;
  }
};