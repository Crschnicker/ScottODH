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
 * Enhanced with retry logic and better error handling
 * @param {Object} estimateData - Complete estimate data including scheduling fields
 * @returns {Promise<Object>} Promise resolving to the created estimate
 */
export const createEstimate = async (estimateData, retryCount = 0) => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // Start with 1 second delay
  
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
    
    // Clean up any undefined values that might cause issues
    Object.keys(processedData).forEach(key => {
      if (processedData[key] === undefined) {
        delete processedData[key];
      }
    });
    
    console.log(`[CREATE ESTIMATE] Sending request (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, 
      JSON.parse(JSON.stringify(processedData)));
    
    // Send the complete estimate data to properly include scheduling information
    // Increase timeout for first attempt, then use shorter timeouts for retries
    const timeout = retryCount === 0 ? 15000 : 8000; // 15s first try, 8s for retries
    
    const response = await api.post('/estimates', processedData, {
      timeout: timeout,
      // Add explicit headers to ensure proper content type
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Log the response from the server
    console.log('[CREATE ESTIMATE] Success! Server response:', response.data);
    
    if (response.data.scheduled_date) {
      logDateOperation('CREATE ESTIMATE - RESPONSE', 
        processedData.scheduled_date, response.data.scheduled_date, 
        `New estimate #${response.data.id} scheduled date from server`);
    }
    
    return response.data;
    
  } catch (error) {
    // Log detailed error information
    console.error(`[CREATE ESTIMATE] Error on attempt ${retryCount + 1}:`, error);
    
    // Determine if this is a retryable error
    const isRetryableError = (
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.message === 'Network Error' ||
      (error.response && error.response.status >= 500) ||
      !error.response // No response received
    );
    
    // Enhanced error logging
    if (error.response) {
      console.error('[CREATE ESTIMATE] Server response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      console.error('[CREATE ESTIMATE] No response received:', {
        readyState: error.request.readyState,
        status: error.request.status,
        statusText: error.request.statusText,
        responseURL: error.request.responseURL,
        timeout: error.request.timeout
      });
    } else {
      console.error('[CREATE ESTIMATE] Request setup error:', error.message);
    }
    
    // Retry logic for network errors
    if (isRetryableError && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
      console.log(`[CREATE ESTIMATE] Retrying in ${delay}ms... (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Recursive retry with incremented count
      return createEstimate(estimateData, retryCount + 1);
    }
    
    // If all retries exhausted or non-retryable error, provide helpful error messages
    let errorMessage;
    
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      if (retryCount >= MAX_RETRIES) {
        errorMessage = `Unable to connect to server after ${MAX_RETRIES + 1} attempts. Please check that the backend server is running and try again.`;
      } else {
        errorMessage = 'Unable to connect to server. Please check your internet connection and that the backend server is running.';
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = `Request timed out after ${retryCount >= MAX_RETRIES ? MAX_RETRIES + 1 : 1} attempts. The server may be overloaded. Please try again.`;
    } else if (error.response && error.response.status === 400) {
      errorMessage = error.response.data?.error || error.response.data?.message || 'Invalid request data. Please check your input and try again.';
    } else if (error.response && error.response.status === 401) {
      errorMessage = 'Authentication failed. Please log in again.';
    } else if (error.response && error.response.status === 403) {
      errorMessage = 'Permission denied. You do not have access to create estimates.';
    } else if (error.response && error.response.status === 409) {
      errorMessage = 'Conflict: This estimate may already exist or there is a data conflict.';
    } else if (error.response && error.response.status >= 500) {
      errorMessage = `Server error (${error.response.status}). Please try again later or contact support.`;
    } else if (error.response && error.response.data && error.response.data.error) {
      errorMessage = error.response.data.error;
    } else {
      errorMessage = `Failed to create estimate: ${error.message || 'Unknown error'}`;
    }
    
    console.error('[CREATE ESTIMATE] Final error after all retries:', errorMessage);
    
    // Create a new error with our helpful message
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    enhancedError.retryCount = retryCount;
    
    throw enhancedError;
  }
};

/**
 * Helper function to check server connectivity
 * Can be used before attempting to create estimates
 * @returns {Promise<boolean>} Promise resolving to true if server is reachable
 */
export const checkServerConnectivity = async () => {
  try {
    console.log('[SERVER CHECK] Testing connectivity...');
    
    // Try a simple GET request to check if server is responding
    const response = await api.get('/estimates', { 
      timeout: 5000,
      headers: { 'Accept': 'application/json' }
    });
    
    console.log('[SERVER CHECK] Server is responsive:', {
      status: response.status,
      dataLength: response.data?.length || 0,
      statusText: response.statusText
    });
    return true;
  } catch (error) {
    console.error('[SERVER CHECK] Server connectivity failed:', error.message);
    return false;
  }
};

/**
 * Helper function to validate estimate data before submission
 * @param {Object} estimateData - The estimate data to validate
 * @returns {Object} Validation result with isValid and errors array
 */
export const validateEstimateData = (estimateData) => {
  const errors = [];
  
  // Required fields
  if (!estimateData.customer_id) {
    errors.push('Customer is required');
  }
  
  if (!estimateData.site_id) {
    errors.push('Site is required');
  }
  
  if (!estimateData.title || estimateData.title.trim().length === 0) {
    errors.push('Estimate title is required');
  }
  
  // Validate scheduling data if present
  if (estimateData.scheduled_date) {
    const scheduledDate = new Date(estimateData.scheduled_date);
    const now = new Date();
    
    if (isNaN(scheduledDate.getTime())) {
      errors.push('Invalid scheduled date format');
    } else if (scheduledDate < now) {
      errors.push('Scheduled date cannot be in the past');
    }
  }
  
  // Validate numeric fields if present
  if (estimateData.estimated_hours && isNaN(parseFloat(estimateData.estimated_hours))) {
    errors.push('Estimated hours must be a valid number');
  }
  
  if (estimateData.estimated_cost && isNaN(parseFloat(estimateData.estimated_cost))) {
    errors.push('Estimated cost must be a valid number');
  }
  
  console.log('[VALIDATE ESTIMATE] Validation result:', {
    isValid: errors.length === 0,
    errors: errors
  });
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
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
 * Enhanced updateEstimateWithDoors function with comprehensive ngrok tunnel support,
 * intelligent retry strategies, and advanced error recovery mechanisms
 * @param {number} estimateId - The ID of the estimate to update
 * @param {Array} doors - Array of door objects to save
 * @param {number} retryCount - Current retry attempt number (internal use)
 * @returns {Promise<Object>} Promise resolving to the update result
 */
export const updateEstimateWithDoors = async (estimateId, doors, retryCount = 0) => {
  const MAX_RETRIES = 6; // Increased for better ngrok support
  const BASE_RETRY_DELAY = 1200; // Slightly increased base delay
  
  // Enhanced request tracking and diagnostics
  const requestMetadata = {
    estimateId,
    doorCount: doors?.length || 0,
    attempt: retryCount + 1,
    maxAttempts: MAX_RETRIES + 1,
    startTime: Date.now(),
    isNgrok: api.defaults.baseURL.includes('ngrok'),
    userAgent: navigator.userAgent,
    connectionType: navigator.connection?.effectiveType || 'unknown',
    onlineStatus: navigator.onLine
  };
  
  try {
    // Enhanced logging with comprehensive request context
    console.log(`[UPDATE ESTIMATE DOORS ${estimateId}] Starting attempt ${requestMetadata.attempt}/${requestMetadata.maxAttempts}:`, {
      doorCount: requestMetadata.doorCount,
      baseURL: api.defaults.baseURL,
      isNgrok: requestMetadata.isNgrok,
      onlineStatus: requestMetadata.onlineStatus,
      connectionType: requestMetadata.connectionType,
      retryAttempt: retryCount,
      doors: doors?.map(door => ({
        id: door.id,
        description: door.description,
        detailCount: door.details?.length || 0
      })) || []
    });
    
    // Enhanced pre-flight validation with comprehensive checks
    if (!estimateId || isNaN(parseInt(estimateId)) || parseInt(estimateId) <= 0) {
      throw new Error(`Invalid estimate ID: ${estimateId}`);
    }
    
    if (!Array.isArray(doors)) {
      throw new Error(`Doors must be an array, received: ${typeof doors}`);
    }
    
    if (doors.length === 0) {
      console.warn(`[UPDATE ESTIMATE DOORS ${estimateId}] No doors to save`);
      return { 
        success: true, 
        doors: [], 
        message: 'No doors to save',
        metadata: requestMetadata 
      };
    }
    
    // Enhanced data validation and normalization with comprehensive sanitization
    const cleanedDoors = doors.map((door, index) => {
      if (!door || typeof door !== 'object') {
        throw new Error(`Door at index ${index} must be an object, got: ${typeof door}`);
      }
      
      const cleanedDoor = { ...door };
      
      // Ensure required fields exist with robust fallbacks
      if (!cleanedDoor.id) {
        cleanedDoor.id = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`;
        console.warn(`[UPDATE ESTIMATE DOORS ${estimateId}] Generated ID for door ${index}: ${cleanedDoor.id}`);
      }
      
      if (!cleanedDoor.door_number || isNaN(parseInt(cleanedDoor.door_number))) {
        cleanedDoor.door_number = index + 1;
        console.warn(`[UPDATE ESTIMATE DOORS ${estimateId}] Assigned door_number ${cleanedDoor.door_number} to door ${index}`);
      } else {
        cleanedDoor.door_number = parseInt(cleanedDoor.door_number);
      }
      
      if (!cleanedDoor.description || typeof cleanedDoor.description !== 'string' || cleanedDoor.description.trim() === '') {
        cleanedDoor.description = `Door #${cleanedDoor.door_number}`;
        console.warn(`[UPDATE ESTIMATE DOORS ${estimateId}] Generated description for door ${index}: ${cleanedDoor.description}`);
      } else {
        cleanedDoor.description = cleanedDoor.description.trim();
      }
      
      if (!Array.isArray(cleanedDoor.details)) {
        cleanedDoor.details = cleanedDoor.details ? [String(cleanedDoor.details)] : [];
        console.warn(`[UPDATE ESTIMATE DOORS ${estimateId}] Converted details to array for door ${index}`);
      }
      
      // Filter out empty or invalid details
      cleanedDoor.details = cleanedDoor.details
        .filter(detail => detail != null && String(detail).trim() !== '')
        .map(detail => String(detail).trim());
      
      // Remove undefined values that might cause serialization issues
      Object.keys(cleanedDoor).forEach(key => {
        if (cleanedDoor[key] === undefined) {
          delete cleanedDoor[key];
        }
      });
      
      return cleanedDoor;
    });
    
    // Enhanced request payload with comprehensive metadata
    const requestData = { 
      doors: cleanedDoors,
      metadata: {
        timestamp: new Date().toISOString(),
        retryAttempt: retryCount,
        clientVersion: '1.0.0',
        requestId: `doors-${estimateId}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        clientMetadata: {
          userAgent: navigator.userAgent.slice(0, 100), // Truncate for size
          screen: `${window.screen.width}x${window.screen.height}`,
          language: navigator.language,
          platform: navigator.platform
        }
      }
    };
    
    // Calculate request size and optimize for ngrok
    const requestSize = JSON.stringify(requestData).length;
    console.log(`[UPDATE ESTIMATE DOORS ${estimateId}] Request payload size: ${(requestSize / 1024).toFixed(2)}KB`);
    
    // Warn about large requests that might have issues with ngrok
    if (requestSize > 100000) { // 100KB threshold
      console.warn(`[UPDATE ESTIMATE DOORS ${estimateId}] Large request detected (${(requestSize / 1024).toFixed(2)}KB), may experience delays with ngrok`);
    }
    
    // Enhanced timeout calculation with intelligent scaling
    let timeout = 25000; // Base 25 seconds
    
    // Adjust timeout based on various factors
    if (retryCount > 0) {
      // Shorter timeouts for retries to fail faster
      timeout = Math.max(12000, 25000 - (retryCount * 3000));
    }
    
    if (requestSize > 50000) {
      // Longer timeout for large requests
      timeout = Math.max(timeout, 35000);
    }
    
    if (requestMetadata.isNgrok) {
      // Extra time for ngrok tunnels, especially on first attempt
      timeout = Math.max(timeout, retryCount === 0 ? 30000 : 20000);
    }
    
    // Reduce timeout for slow connections to fail faster
    if (requestMetadata.connectionType === 'slow-2g' || requestMetadata.connectionType === '2g') {
      timeout = Math.min(timeout, 15000);
    }
    
    console.log(`[UPDATE ESTIMATE DOORS ${estimateId}] Using timeout: ${timeout}ms (attempt ${retryCount + 1})`);
    
    // Pre-request connectivity validation for critical requests
    if (retryCount === 0 && requestMetadata.isNgrok) {
      console.log(`[UPDATE ESTIMATE DOORS ${estimateId}] Performing pre-request ngrok connectivity validation...`);
      
      try {
        // Quick connectivity test with shorter timeout
        const connectivityResponse = await api.get(`/estimates/${estimateId}/doors/test`, {
          timeout: 5000,
          headers: {
            'X-Connectivity-Test': 'pre-request',
            'X-Test-Type': 'quick-validation'
          }
        });
        
        if (connectivityResponse.status === 200) {
          console.log(`[UPDATE ESTIMATE DOORS ${estimateId}] Pre-request connectivity validation passed`);
        }
      } catch (testError) {
        console.warn(`[UPDATE ESTIMATE DOORS ${estimateId}] Pre-request connectivity test failed:`, testError.message);
        
        // Don't fail the main request, but log for diagnostics
        if (testError.code === 'ECONNABORTED') {
          console.warn(`[UPDATE ESTIMATE DOORS ${estimateId}] Ngrok tunnel appears slow, proceeding with longer timeout`);
          timeout = Math.max(timeout, 40000);
        }
      }
    }
    
    // Enhanced request configuration with ngrok optimizations
    const requestConfig = {
      timeout: timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Retry-Attempt': retryCount.toString(),
        'X-Request-ID': requestData.metadata.requestId,
        'X-Client-Timestamp': requestData.metadata.timestamp,
        'X-Door-Count': cleanedDoors.length.toString()
      },
      withCredentials: true,
      // Enhanced validation for response status codes
      validateStatus: function (status) {
        return status >= 200 && status < 300;
      }
    };
    
    // Add ngrok-specific optimizations
    if (requestMetadata.isNgrok) {
      requestConfig.headers['X-Ngrok-Request'] = 'true';
      requestConfig.headers['X-Ngrok-Attempt'] = (retryCount + 1).toString();
      requestConfig.headers['User-Agent'] = 'Scott-Overhead-Doors-App/1.0';
      
      // Enable keep-alive for ngrok stability
      requestConfig.headers['Connection'] = 'keep-alive';
    }
    
    // Execute the request with comprehensive timing
    console.log(`[UPDATE ESTIMATE DOORS ${estimateId}] Executing API request...`);
    const requestStartTime = Date.now();
    
    const response = await api.put(
      `/estimates/${estimateId}/doors`,
      requestData,
      requestConfig
    );
    
    const requestDuration = Date.now() - requestStartTime;
    const totalDuration = Date.now() - requestMetadata.startTime;
    
    console.log(`[UPDATE ESTIMATE DOORS ${estimateId}] Request completed in ${requestDuration}ms (total: ${totalDuration}ms)`);
    
    // Enhanced response validation with comprehensive checks
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response object received from server');
    }
    
    if (!response.data) {
      throw new Error('Empty response data from server');
    }
    
    // Check for explicit server-side failure indicators
    if (response.data.success === false) {
      const serverError = response.data.error || response.data.message || 'Server indicated operation failed';
      throw new Error(`Server error: ${serverError}`);
    }
    
    // Validate response structure for expected fields
    const responseData = response.data;
    if (!responseData || typeof responseData !== 'object') {
      throw new Error('Invalid response data structure');
    }
    
    // Enhanced success logging with comprehensive metrics
    console.log(`[UPDATE ESTIMATE DOORS ${estimateId}] SUCCESS! Response details:`, {
      status: response.status,
      statusText: response.statusText,
      doorsCount: responseData.doors_count || responseData.doors?.length || cleanedDoors.length,
      requestDuration: requestDuration,
      totalDuration: totalDuration,
      responseSize: JSON.stringify(responseData).length,
      attempt: retryCount + 1,
      isNgrok: requestMetadata.isNgrok
    });
    
    // Return enhanced success response with comprehensive metadata
    return {
      ...responseData,
      success: true,
      doors: responseData.doors || cleanedDoors,
      doorsCount: responseData.doors_count || cleanedDoors.length,
      metadata: {
        ...requestMetadata,
        requestDuration,
        totalDuration,
        responseSize: JSON.stringify(responseData).length,
        attemptsUsed: retryCount + 1,
        finalTimeout: timeout
      }
    };
    
  } catch (err) {
    // Enhanced error analysis and logging
    const errorDetails = {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      statusText: err.response?.statusText,
      online: navigator.onLine,
      baseURL: api.defaults.baseURL,
      isNgrok: requestMetadata.isNgrok,
      connectionType: requestMetadata.connectionType,
      retryAttempt: retryCount + 1,
      totalRetries: MAX_RETRIES + 1,
      requestDuration: Date.now() - requestMetadata.startTime
    };
    
    console.error(`[UPDATE ESTIMATE DOORS ${estimateId}] Error on attempt ${retryCount + 1}:`, errorDetails);
    
    // Enhanced retryability analysis with ngrok-specific considerations
    const isRetryableError = (
      // Network-level errors
      err.code === 'ERR_NETWORK' ||
      err.code === 'ECONNABORTED' ||
      err.code === 'ECONNRESET' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'ENETDOWN' ||
      err.code === 'ENETUNREACH' ||
      err.code === 'EHOSTDOWN' ||
      err.code === 'EHOSTUNREACH' ||
      err.message === 'Network Error' ||
      err.message.includes('timeout') ||
      err.message.includes('connection') ||
      
      // Server-level errors that should be retried
      (err.response && err.response.status >= 500) ||
      (err.response && err.response.status === 502) || // Bad Gateway - common with ngrok
      (err.response && err.response.status === 503) || // Service Unavailable
      (err.response && err.response.status === 504) || // Gateway Timeout
      (err.response && err.response.status === 408) || // Request Timeout
      (err.response && err.response.status === 429) || // Too Many Requests
      (err.response && err.response.status === 0) ||   // Network error
      
      // No response received at all
      !err.response
    );
    
    // Special handling for ngrok-specific errors
    if (requestMetadata.isNgrok && (
      err.message.includes('tunnel') ||
      err.message.includes('ngrok') ||
      (err.response && err.response.status === 502) ||
      (err.code === 'ECONNABORTED' && retryCount < 3) // Be more forgiving with timeouts on ngrok
    )) {
      console.warn(`[UPDATE ESTIMATE DOORS ${estimateId}] Ngrok-specific error detected, treating as retryable`);
    }
    
    // Log detailed error information for diagnostics
    if (err.response) {
      console.error(`[UPDATE ESTIMATE DOORS ${estimateId}] Server response error:`, {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data,
        headers: Object.fromEntries(
          Object.entries(err.response.headers || {}).slice(0, 10) // Limit header logging
        ),
        url: err.response.config?.url,
        method: err.response.config?.method
      });
    } else if (err.request) {
      console.error(`[UPDATE ESTIMATE DOORS ${estimateId}] No response received:`, {
        readyState: err.request.readyState,
        status: err.request.status,
        statusText: err.request.statusText,
        responseURL: err.request.responseURL,
        timeout: err.request.timeout,
        method: err.config?.method,
        url: err.config?.url
      });
    } else {
      console.error(`[UPDATE ESTIMATE DOORS ${estimateId}] Request setup error:`, err.message);
    }
    
    // Enhanced retry logic with intelligent backoff
    if (isRetryableError && retryCount < MAX_RETRIES) {
      // Calculate delay with exponential backoff and jitter
      const baseDelay = BASE_RETRY_DELAY * Math.pow(1.8, retryCount); // Gentler exponential growth
      const jitter = Math.random() * 1000; // Add up to 1 second of jitter
      const maxDelay = requestMetadata.isNgrok ? 12000 : 8000; // Cap delays, longer for ngrok
      const delay = Math.min(baseDelay + jitter, maxDelay);
      
      // Additional considerations for specific error types
      let finalDelay = delay;
      
      if (requestMetadata.isNgrok) {
        // Longer delays for ngrok due to tunnel instability
        finalDelay = delay * 1.3;
      }
      
      if (err.code === 'ECONNABORTED') {
        // Shorter delays for timeouts to fail faster
        finalDelay = Math.min(delay * 0.8, 5000);
      }
      
      if (err.response && err.response.status === 429) {
        // Respect rate limiting with longer delays
        const retryAfter = err.response.headers['retry-after'];
        if (retryAfter) {
          finalDelay = Math.max(finalDelay, parseInt(retryAfter) * 1000);
        } else {
          finalDelay = delay * 2; // Double delay for rate limiting
        }
      }
      
      console.log(`[UPDATE ESTIMATE DOORS ${estimateId}] Retrying in ${Math.round(finalDelay)}ms... (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
      
      // Additional checks before retry
      if (!navigator.onLine) {
        console.error(`[UPDATE ESTIMATE DOORS ${estimateId}] Browser is offline, extending retry delay`);
        finalDelay = Math.max(finalDelay, 5000);
        
        // Wait for online status to return
        await new Promise((resolve) => {
          const checkOnline = () => {
            if (navigator.onLine) {
              resolve();
            } else {
              setTimeout(checkOnline, 1000);
            }
          };
          setTimeout(checkOnline, finalDelay);
        });
      } else {
        await new Promise(resolve => setTimeout(resolve, finalDelay));
      }
      
      // Recursive retry with incremented count
      return updateEstimateWithDoors(estimateId, doors, retryCount + 1);
    }
    
    // Generate comprehensive error messages for end users
    let userFriendlyError;
    let errorCode = 'UNKNOWN_ERROR';
    let troubleshootingTips = [];
    
    if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
      if (requestMetadata.isNgrok) {
        userFriendlyError = `Ngrok tunnel connection failed after ${MAX_RETRIES + 1} attempts. The tunnel may be expired or unstable.`;
        errorCode = 'NGROK_TUNNEL_FAILED';
        troubleshootingTips = [
          'Check if your ngrok tunnel is still active in the terminal',
          'Try restarting the ngrok tunnel with: ngrok http 5000',
          'Consider switching to local development mode',
          'Ngrok free accounts have session limits',
          `Failed after ${retryCount + 1} attempts over ${Math.round((Date.now() - requestMetadata.startTime) / 1000)}+ seconds`
        ];
      } else {
        userFriendlyError = `Network connection failed after ${MAX_RETRIES + 1} attempts. Please check your internet connection and server status.`;
        errorCode = 'NETWORK_CONNECTION_FAILED';
        troubleshootingTips = [
          'Verify your internet connection is stable',
          'Check if the backend server is running',
          'Try refreshing the page',
          `Attempted ${retryCount + 1} times`
        ];
      }
    } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
      if (requestMetadata.isNgrok) {
        userFriendlyError = `Request timed out after ${retryCount + 1} attempts. Ngrok tunnels can be slow, especially with large requests.`;
        errorCode = 'NGROK_TIMEOUT';
        troubleshootingTips = [
          'Ngrok free tunnels have bandwidth limitations',
          'Try reducing the number of doors being saved at once',
          'Consider using a paid ngrok plan for better performance',
          'Switch to local development for better speed'
        ];
      } else {
        userFriendlyError = `Request timed out after ${retryCount + 1} attempts. The server may be overloaded.`;
        errorCode = 'REQUEST_TIMEOUT';
        troubleshootingTips = [
          'The server may be temporarily overloaded',
          'Try again in a few moments',
          'Consider saving fewer doors at once'
        ];
      }
    } else if (err.response && err.response.status === 400) {
      userFriendlyError = err.response.data?.error || err.response.data?.message || 'Invalid door data format. Please check the door information and try again.';
      errorCode = 'INVALID_DATA';
      troubleshootingTips = [
        'Check that all doors have valid descriptions',
        'Ensure door numbers are numeric',
        'Try refreshing the page and re-entering data'
      ];
    } else if (err.response && err.response.status === 401) {
      userFriendlyError = 'Authentication expired. Please log in again.';
      errorCode = 'AUTH_EXPIRED';
      troubleshootingTips = ['Refresh the page and log in again'];
    } else if (err.response && err.response.status === 403) {
      userFriendlyError = 'Permission denied. You do not have access to update estimate doors.';
      errorCode = 'PERMISSION_DENIED';
      troubleshootingTips = ['Contact your administrator for access'];
    } else if (err.response && err.response.status === 404) {
      userFriendlyError = `Estimate ${estimateId} not found. It may have been deleted.`;
      errorCode = 'ESTIMATE_NOT_FOUND';
      troubleshootingTips = [
        'Verify the estimate still exists',
        'Try refreshing the page',
        'Navigate back to the estimates list'
      ];
    } else if (err.response && err.response.status === 409) {
      userFriendlyError = 'Data conflict detected. Another user may have modified this estimate.';
      errorCode = 'DATA_CONFLICT';
      troubleshootingTips = [
        'Refresh the page to get the latest data',
        'Try saving again after refresh'
      ];
    } else if (err.response && err.response.status === 422) {
      userFriendlyError = 'Data validation failed on server. Please check your door information.';
      errorCode = 'VALIDATION_FAILED';
      troubleshootingTips = [
        'Ensure all required fields are filled',
        'Check for special characters in descriptions',
        'Verify door numbers are unique'
      ];
    } else if (err.response && err.response.status === 502) {
      userFriendlyError = requestMetadata.isNgrok 
        ? 'Bad Gateway error - this often indicates ngrok tunnel issues. Please check your tunnel connection.'
        : 'Bad Gateway error - the server is temporarily unavailable.';
      errorCode = 'BAD_GATEWAY';
      troubleshootingTips = requestMetadata.isNgrok 
        ? ['Check ngrok tunnel status', 'Restart ngrok if necessary', 'Try local development mode']
        : ['Server may be restarting', 'Try again in a few moments'];
    } else if (err.response && err.response.status === 503) {
      userFriendlyError = 'Service temporarily unavailable. The server may be overloaded or under maintenance.';
      errorCode = 'SERVICE_UNAVAILABLE';
      troubleshootingTips = [
        'Wait a few minutes and try again',
        'Check server status if available'
      ];
    } else if (err.response && err.response.status === 504) {
      userFriendlyError = requestMetadata.isNgrok
        ? 'Gateway timeout - the ngrok tunnel took too long to respond. This is common with ngrok free accounts.'
        : 'Gateway timeout - the server took too long to respond.';
      errorCode = 'GATEWAY_TIMEOUT';
      troubleshootingTips = requestMetadata.isNgrok
        ? ['Ngrok free accounts have timeouts', 'Try a paid ngrok plan', 'Use local development']
        : ['Server may be overloaded', 'Try again later'];
    } else if (err.response && err.response.status >= 500) {
      userFriendlyError = `Server error (${err.response.status}). Please try again later or contact support.`;
      errorCode = 'SERVER_ERROR';
      troubleshootingTips = [
        'This is a temporary server issue',
        'Try again in a few minutes',
        'Contact support if the problem persists'
      ];
    } else if (err.response && err.response.data && err.response.data.error) {
      userFriendlyError = err.response.data.error;
      errorCode = 'API_ERROR';
      troubleshootingTips = ['Check the error message for specific guidance'];
    } else {
      userFriendlyError = `Failed to update estimate doors: ${err.message || 'Unknown error occurred'}`;
      errorCode = 'UNKNOWN_ERROR';
      troubleshootingTips = [
        'Try refreshing the page',
        'Check your internet connection',
        'Contact support if the problem persists'
      ];
    }
    
    console.error(`[UPDATE ESTIMATE DOORS ${estimateId}] Final error after all retries:`, {
      message: userFriendlyError,
      code: errorCode,
      originalError: err.message,
      retryCount: retryCount,
      isNgrok: requestMetadata.isNgrok,
      troubleshootingTips: troubleshootingTips
    });
    
    // Create enhanced error object with comprehensive debugging information
    const enhancedError = new Error(userFriendlyError);
    enhancedError.originalError = err;
    enhancedError.retryCount = retryCount;
    enhancedError.estimateId = estimateId;
    enhancedError.errorCode = errorCode;
    enhancedError.isNgrokError = requestMetadata.isNgrok;
    enhancedError.troubleshootingTips = troubleshootingTips;
    enhancedError.diagnostics = errorDetails;
    enhancedError.metadata = requestMetadata;
    
    throw enhancedError;
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