import api from './api';

/**
 * Logger for date operations to help debug timezone issues
 * @param {string} operation - The operation being performed
 * @param {any} input - The input data
 * @param {any} output - The output data
 * @param {string} message - Optional additional context message
 */
const logDateOperation = (operation, input, output, message = '') => {
  console.log(`[JOB DATE DEBUG - ${operation}]${message ? ' ' + message : ''}`, {
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
 * Formats a date to YYYY-MM-DD format for job scheduling
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDateToYYYYMMDD(date) {
  if (!(date instanceof Date)) return null;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Parse a date string in YYYY-MM-DD format without timezone conversion
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} Date object with the same date in local timezone, set to noon
 */
function parseDatePreservingDay(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  // For ISO date strings with time component like 2025-05-30T00:00:00.000Z
  if (dateStr.includes('T')) {
    // Extract just the date part
    dateStr = dateStr.split('T')[0];
  }
  
  // For date strings like "Fri, 30 May 2025 00:00:00 GMT"
  if (dateStr.includes(',')) {
    try {
      // Parse the date and force local noon time to prevent day shifting
      const tempDate = new Date(dateStr);
      const year = tempDate.getUTCFullYear();
      const month = tempDate.getUTCMonth();
      const day = tempDate.getUTCDate();
      
      // Create a new date with local noon time to prevent any timezone issues
      return new Date(year, month, day, 12, 0, 0);
    } catch (e) {
      console.error('Error parsing date with comma:', e);
      return null;
    }
  }
  
  // For simple YYYY-MM-DD format
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Set to noon local time to avoid any timezone issues
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  
  // Fallback to standard parsing with noon time set
  try {
    const date = new Date(dateStr);
    date.setHours(12, 0, 0, 0);
    return date;
  } catch (e) {
    console.error('Error in fallback date parsing:', e);
    return null;
  }
}

/**
 * Format a date for display in MM/DD/YYYY format
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateForDisplay(date) {
  if (!date) return '';
  
  // Parse string to Date if needed, preserving the day
  let dateObj = date;
  if (typeof date === 'string') {
    dateObj = parseDatePreservingDay(date);
  }
  
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }
  
  // Format as MM/DD/YYYY
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return `${month}/${day}/${year}`;
}

/**
 * Get all jobs with optional filters
 * @param {Object} params - Optional query parameters
 * @returns {Promise<Array>} Promise resolving to an array of jobs
 */
export const getJobs = async (params = {}) => {
  try {
    console.log('[GET JOBS] Requesting with params:', params);
    
    const response = await api.get('/jobs', { params });
    
    // Process dates to prevent timezone issues when displaying
    const processedJobs = response.data.map(job => {
      if (job.scheduled_date) {
        // Parse the date preserving the day
        const parsedDate = parseDatePreservingDay(job.scheduled_date);
        
        // Add additional date properties for debugging
        job._original_scheduled_date = job.scheduled_date;
        job._parsed_date_obj = parsedDate;
        job.formatted_date = formatDateForDisplay(parsedDate);
      }
      return job;
    });
    
    // Log the jobs data focusing on dates
    if (processedJobs.length > 0) {
      console.log('[GET JOBS] Received jobs with fixed date handling:', 
        processedJobs.map(job => ({
          id: job.id,
          jobNumber: job.job_number,
          status: job.status,
          originalDate: job._original_scheduled_date,
          parsedDate: job._parsed_date_obj,
          formattedDate: job.formatted_date
        }))
      );
    } else {
      console.log('[GET JOBS] No jobs returned matching criteria');
    }
    
    return processedJobs;
  } catch (error) {
    console.error('Error getting jobs:', error);
    throw error;
  }
};

/**
 * Get job by ID
 * @param {number|string} id - The job ID
 * @returns {Promise<Object>} Promise resolving to the job data
 */
export const getJob = async (id) => {
  try {
    console.log(`[GET JOB] Requesting job #${id}`);
    
    const response = await api.get(`/jobs/${id}`);
    
    // Fix date handling in the response
    const job = response.data;
    
    // Log the job data with date details
    if (job.scheduled_date) {
      logDateOperation('GET JOB', id, job.scheduled_date, 
        `Job #${id} has a scheduled date`);
      
      // Parse the date preserving the day
      const parsedDate = parseDatePreservingDay(job.scheduled_date);
      
      // Store original date and add parsed version
      job._original_scheduled_date = job.scheduled_date;
      job._parsed_date_obj = parsedDate;
      job.formatted_date = formatDateForDisplay(parsedDate);
      
      // Detailed date logging
      console.log(`[JOB ${id}] Fixed date handling:`, {
        originalFromServer: job._original_scheduled_date,
        parsedDate: job._parsed_date_obj,
        formattedForDisplay: job.formatted_date,
        dateComponents: {
          year: parsedDate.getFullYear(),
          month: parsedDate.getMonth() + 1,
          day: parsedDate.getDate()
        }
      });
    }
    
    return job;
  } catch (error) {
    console.error(`Error getting job ${id}:`, error);
    throw error;
  }
};

/**
 * Schedule a job
 * @param {number|string} jobId - The job ID
 * @param {Object} scheduleData - The scheduling information
 * @returns {Promise<Object>} Promise resolving to the scheduled job
 */
export const scheduleJob = async (jobId, scheduleData) => {
  try {
    // Log original data before any modifications
    console.log(`[SCHEDULE JOB ${jobId}] Original scheduling data:`, 
      JSON.parse(JSON.stringify(scheduleData)));
    
    // Log timezone information
    console.log('[SCHEDULE JOB] Browser timezone information:', {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: new Date().getTimezoneOffset(),
      currentDate: new Date().toISOString(),
      currentDateLocal: new Date().toLocaleString()
    });
    
    // Create a copy for processing
    const processedData = { ...scheduleData };
    
    // For jobs, we want to standardize on just the date (without time component)
    // to prevent timezone issues across days
    if (processedData.scheduled_date) {
      // Handle different types of date inputs
      if (processedData.scheduled_date instanceof Date) {
        // Format date as YYYY-MM-DD to prevent timezone issues
        const formattedDate = formatDateToYYYYMMDD(processedData.scheduled_date);
        
        console.log(`[SCHEDULE JOB ${jobId}] Formatted Date object to YYYY-MM-DD:`, {
          original: processedData.scheduled_date,
          formatted: formattedDate
        });
        
        processedData.scheduled_date = formattedDate;
      } 
      // If it's a string with timezone info (ISO format)
      else if (typeof processedData.scheduled_date === 'string' && 
              (processedData.scheduled_date.includes('T') || 
               processedData.scheduled_date.includes('Z') || 
               processedData.scheduled_date.includes('+') || 
               processedData.scheduled_date.includes('-', 10))) {
               
        // Parse the date and extract just the date part
        const parsedDate = new Date(processedData.scheduled_date);
        const formattedDate = formatDateToYYYYMMDD(parsedDate);
        
        console.log(`[SCHEDULE JOB ${jobId}] Extracted date from ISO string:`, {
          original: processedData.scheduled_date,
          parsed: parsedDate,
          formatted: formattedDate
        });
        
        processedData.scheduled_date = formattedDate;
      }
      // If it's already in YYYY-MM-DD format, leave it as is
      else if (typeof processedData.scheduled_date === 'string' && 
               !processedData.scheduled_date.includes('T') &&
               processedData.scheduled_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                 
        console.log(`[SCHEDULE JOB ${jobId}] Date already in YYYY-MM-DD format:`, 
          processedData.scheduled_date);
      }
      // Any other format, try to parse and convert to YYYY-MM-DD
      else {
        try {
          const parsedDate = new Date(processedData.scheduled_date);
          const formattedDate = formatDateToYYYYMMDD(parsedDate);
          
          console.log(`[SCHEDULE JOB ${jobId}] Parsed and formatted unknown date format:`, {
            original: processedData.scheduled_date,
            parsed: parsedDate,
            formatted: formattedDate
          });
          
          processedData.scheduled_date = formattedDate;
        } catch (error) {
          console.error(`[SCHEDULE JOB ${jobId}] Error parsing date:`, error);
          // Leave the date as is if parsing fails
        }
      }
    }
    
    // If there's a separate date field (schedule_date), use that instead
    if (processedData.schedule_date) {
      console.log(`[SCHEDULE JOB ${jobId}] Using schedule_date field:`, processedData.schedule_date);
      processedData.scheduled_date = processedData.schedule_date;
    }
    
    // Log the final processed data being sent to the server
    console.log(`[SCHEDULE JOB ${jobId}] Sending to server:`, 
      JSON.parse(JSON.stringify(processedData)));
    
    const response = await api.post(`/jobs/${jobId}/schedule`, processedData);
    
    // Log the response
    console.log(`[SCHEDULE JOB ${jobId}] Server response:`, response.data);
    
    // Process the returned job to fix date handling
    const job = response.data;
    
    if (job.scheduled_date) {
      // Parse the date preserving the day
      const parsedDate = parseDatePreservingDay(job.scheduled_date);
      
      // Store original date and add parsed version
      job._original_scheduled_date = job.scheduled_date;
      job._parsed_date_obj = parsedDate;
      job.formatted_date = formatDateForDisplay(parsedDate);
      
      console.log(`[SCHEDULE JOB ${jobId}] Fixed response date:`, {
        originalFromServer: job._original_scheduled_date,
        parsedDate: job._parsed_date_obj,
        formattedForDisplay: job.formatted_date
      });
    }
    
    return job;
  } catch (error) {
    console.error(`Error scheduling job ${jobId}:`, error);
    
    // Enhanced error logging
    if (error.response) {
      console.error(`[SCHEDULE JOB ${jobId}] Server response error:`, {
        status: error.response.status,
        data: error.response.data
      });
    }
    
    throw error;
  }
};

/**
 * Update job status
 * @param {number|string} jobId - The job ID
 * @param {Object} statusData - The status data to update
 * @returns {Promise<Object>} Promise resolving to the updated job
 */
export const updateJobStatus = async (jobId, statusData) => {
  try {
    console.log(`[UPDATE JOB STATUS] Changing job #${jobId} status:`, statusData);
    
    const response = await api.put(`/jobs/${jobId}/status`, statusData);
    
    // Fix date handling in the response
    const job = response.data;
    
    if (job.scheduled_date) {
      // Parse the date preserving the day
      const parsedDate = parseDatePreservingDay(job.scheduled_date);
      
      // Store original date and add parsed version
      job._original_scheduled_date = job.scheduled_date;
      job._parsed_date_obj = parsedDate;
      job.formatted_date = formatDateForDisplay(parsedDate);
    }
    
    console.log(`[UPDATE JOB STATUS] Server response with fixed dates:`, job);
    
    return job;
  } catch (error) {
    console.error(`Error updating job ${jobId} status:`, error);
    throw error;
  }
};

/**
 * Complete a door for a job
 * @param {number|string} jobId - The job ID
 * @param {number|string} doorId - The door ID
 * @param {Object} completionData - The door completion data
 * @returns {Promise<Object>} Promise resolving to the completion data
 */
export const completeDoor = async (jobId, doorId, completionData) => {
  try {
    console.log(`[COMPLETE DOOR] Completing door #${doorId} for job #${jobId}:`, completionData);
    
    const response = await api.post(`/jobs/${jobId}/doors/${doorId}/complete`, completionData);
    
    console.log(`[COMPLETE DOOR] Server response:`, response.data);
    
    return response.data;
  } catch (error) {
    console.error(`Error completing door ${doorId} for job ${jobId}:`, error);
    throw error;
  }
};

/**
 * Get scheduled jobs for a date range
 * @param {string|Date} startDate - Start date for range
 * @param {string|Date} endDate - End date for range
 * @param {string|null} region - Optional region filter
 * @returns {Promise<Array>} Promise resolving to array of scheduled jobs
 */
export const getScheduledJobs = async (startDate, endDate, region = null) => {
  try {
    // Format dates consistently
    let formattedStartDate, formattedEndDate;
    
    if (startDate instanceof Date) {
      formattedStartDate = formatDateToYYYYMMDD(startDate);
    } else {
      formattedStartDate = startDate;
    }
    
    if (endDate instanceof Date) {
      formattedEndDate = formatDateToYYYYMMDD(endDate);
    } else {
      formattedEndDate = endDate;
    }
    
    console.log('[GET SCHEDULED JOBS] Fetching for date range:', {
      original: { startDate, endDate },
      formatted: { formattedStartDate, formattedEndDate }
    });
    
    const params = {
      start_date: formattedStartDate,
      end_date: formattedEndDate,
      status: 'scheduled'
    };
    
    if (region) {
      params.region = region;
    }
    
    const response = await api.get('/jobs', { params });
    
    // Process the dates in each job to fix timezone issues
    const processedJobs = response.data.map(job => {
      if (job.scheduled_date) {
        // Parse the date preserving the day
        const parsedDate = parseDatePreservingDay(job.scheduled_date);
        
        // Store original date and add parsed version
        job._original_scheduled_date = job.scheduled_date;
        job._parsed_date_obj = parsedDate;
        job.formatted_date = formatDateForDisplay(parsedDate);
      }
      return job;
    });
    
    // Log the results
    console.log('[GET SCHEDULED JOBS] Results with fixed dates:', 
      processedJobs.map(job => ({
        id: job.id,
        jobNumber: job.job_number,
        originalDate: job._original_scheduled_date,
        parsedDate: job._parsed_date_obj,
        formattedDate: job.formatted_date
      }))
    );
    
    return processedJobs;
  } catch (error) {
    console.error('Error getting scheduled jobs:', error);
    throw error;
  }
};

/**
 * Get jobs scheduled for a specific date
 * @param {string|Date} date - The date to get jobs for
 * @param {string|null} region - Optional region filter
 * @returns {Promise<Array>} Promise resolving to array of jobs for that date
 */
export const getJobsForDate = async (date, region = null) => {
  try {
    // Format date consistently
    let formattedDate;
    
    if (date instanceof Date) {
      formattedDate = formatDateToYYYYMMDD(date);
    } else {
      formattedDate = date;
    }
    
    console.log('[GET JOBS FOR DATE] Fetching for date:', {
      original: date,
      formatted: formattedDate
    });
    
    const params = {
      scheduled_date: formattedDate,
      status: 'scheduled'
    };
    
    if (region) {
      params.region = region;
    }
    
    const response = await api.get('/jobs', { params });
    
    // Process the dates in each job to fix timezone issues
    const processedJobs = response.data.map(job => {
      if (job.scheduled_date) {
        // Parse the date preserving the day
        const parsedDate = parseDatePreservingDay(job.scheduled_date);
        
        // Store original date and add parsed version
        job._original_scheduled_date = job.scheduled_date;
        job._parsed_date_obj = parsedDate;
        job.formatted_date = formatDateForDisplay(parsedDate);
      }
      return job;
    });
    
    // Log the results
    console.log('[GET JOBS FOR DATE] Results with fixed dates:', 
      processedJobs.map(job => ({
        id: job.id,
        jobNumber: job.job_number,
        originalDate: job._original_scheduled_date,
        parsedDate: job._parsed_date_obj,
        formattedDate: job.formatted_date
      }))
    );
    
    return processedJobs;
  } catch (error) {
    console.error(`Error getting jobs for date ${date}:`, error);
    throw error;
  }
};

// Add this function to your jobService.js file

/**
 * Cancel a job by calling the dedicated cancel endpoint
 * 
 * @param {number} jobId - The ID of the job to cancel
 * @param {Object} cancelData - Optional data containing cancellation details
 * @param {string} cancelData.reason - Optional reason for cancellation
 * @returns {Promise<Object>} - The API response with cancelled job data
 */
export const cancelJob = async (jobId, cancelData = {}) => {
  try {
    const response = await fetch(`/api/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cancelData),
    });

    if (!response.ok) {
      // Get error details if available
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // If error response is not valid JSON
        throw new Error(`Failed to cancel job: ${response.status} ${response.statusText}`);
      }
      
      // Throw detailed error
      throw new Error(errorData.error || `Failed to cancel job: ${response.status}`);
    }

    // Return the successful response data
    return await response.json();
  } catch (error) {
    console.error('Error in cancelJob service:', error);
    throw error;
  }
};