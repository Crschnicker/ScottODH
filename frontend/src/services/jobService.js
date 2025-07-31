import api from './api';

/**
 * Enhanced logging system for debugging job service operations
 * Provides comprehensive debugging information for authentication and API issues
 */

// Logger configuration for different operation types
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

// Enhanced authentication error logging with comprehensive debugging
const logAuthError = (operation, errorDetails) => {
  console.error(`[AUTH ERROR - ${operation}]`, {
    ...errorDetails,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    origin: window.location.origin,
    currentPath: window.location.pathname,
    apiBaseURL: api.defaults?.baseURL,
    withCredentials: api.defaults?.withCredentials
  });
  
  // Provide actionable debugging information based on status codes
  if (errorDetails.status === 401) {
    console.warn('[AUTH DEBUG] 401 Unauthorized - Authentication failed:', {
      possibleCauses: [
        'Session cookie expired or missing',
        'User not logged in',
        'Authentication credentials invalid',
        'CORS credentials not being sent properly'
      ],
      recommendations: [
        'Check browser dev tools for authentication cookies',
        'Verify user login status in authService',
        'Ensure withCredentials is set to true for API calls',
        'Try logging out and back in to refresh session'
      ]
    });
  } else if (errorDetails.status === 403) {
    console.warn('[AUTH DEBUG] 403 Forbidden - Access denied:', {
      possibleCauses: [
        'User authenticated but lacks required permissions',
        'Insufficient user role for this operation',
        'Account may be deactivated or restricted'
      ],
      recommendations: [
        'Check user role and permissions',
        'Contact administrator for access rights',
        'Verify account status is active'
      ]
    });
  } else if (errorDetails.status === 404) {
    console.warn('[AUTH DEBUG] 404 Not Found - Endpoint missing:', {
      possibleCauses: [
        'API endpoint does not exist on server',
        'Backend routing configuration issue',
        'Blueprint not registered properly',
        'Server not running or unreachable'
      ],
      recommendations: [
        'Verify backend server is running',
        'Check API endpoint exists in backend routes',
        'Ensure all blueprints are registered',
        'Test endpoint directly with API testing tool'
      ]
    });
  } else if (errorDetails.status === 405) {
    console.warn('[AUTH DEBUG] 405 Method Not Allowed - HTTP method issue:', {
      possibleCauses: [
        'Wrong HTTP method for endpoint (GET vs POST)',
        'Backend authentication redirecting incorrectly',
        'Route handler not configured for this method'
      ],
      recommendations: [
        'Check if correct HTTP method is being used',
        'Verify backend route accepts the request method',
        'Check for authentication redirects causing method changes'
      ]
    });
  } else if (errorDetails.status >= 500) {
    console.error('[AUTH DEBUG] Server Error - Backend issue:', {
      possibleCauses: [
        'Internal server error',
        'Database connection issue',
        'Backend application crash or misconfiguration'
      ],
      recommendations: [
        'Check backend server logs',
        'Verify database connectivity',
        'Restart backend service if necessary',
        'Contact system administrator'
      ]
    });
  } else if (!errorDetails.status) {
    console.error('[AUTH DEBUG] Network Error - Connection issue:', {
      possibleCauses: [
        'Backend server not accessible',
        'Network connectivity problems',
        'CORS preflight request blocked',
        'DNS resolution failure'
      ],
      recommendations: [
        'Check network connection',
        'Verify backend server URL is correct',
        'Test backend accessibility directly',
        'Check CORS configuration on backend'
      ]
    });
  }
};

/**
 * Enhanced authentication testing with multiple fallback strategies
 * Tests user authentication without relying on potentially missing endpoints
 * 
 * @returns {Promise<Object>} Comprehensive authentication status and connectivity info
 */
export const testAuthentication = async () => {
  console.log('[AUTH TEST] Starting comprehensive authentication test...');
  
  try {
    // Primary authentication test - check current user status
    console.log('[AUTH TEST] Testing user authentication with /auth/me...');
    const userResponse = await api.get('/auth/me');
    console.log('[AUTH TEST] User authentication successful:', userResponse.data);
    
    // Authentication confirmed - now test API connectivity with existing endpoint
    console.log('[AUTH TEST] Testing API connectivity with known working endpoint...');
    
    // Instead of testing /health (which may not exist), test a lightweight existing endpoint
    // Use a simple endpoint that we know exists from the logs - like /auth/users
    try {
      await api.get('/auth/users');
      console.log('[AUTH TEST] API connectivity confirmed via /auth/users');
      
      return {
        authenticated: true,
        user: userResponse.data,
        apiConnected: true,
        connectivityTest: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (connectivityError) {
      console.log('[AUTH TEST] Secondary connectivity test failed, but user is authenticated');
      console.debug('[AUTH TEST] Connectivity error details:', {
        status: connectivityError.response?.status,
        statusText: connectivityError.response?.statusText,
        url: connectivityError.config?.url
      });
      
      // User is authenticated but there might be API connectivity issues
      // This is still a success for authentication purposes
      return {
        authenticated: true,
        user: userResponse.data,
        apiConnected: false,
        connectivityTest: 'failed',
        connectivityError: connectivityError.message,
        timestamp: new Date().toISOString()
      };
    }
    
  } catch (authError) {
    console.error('[AUTH TEST] Authentication test failed:', authError);
    
    // Log comprehensive error details for debugging
    logAuthError('AUTH_TEST', {
      status: authError.response?.status,
      statusText: authError.response?.statusText,
      errorData: authError.response?.data,
      requestUrl: authError.config?.url,
      requestMethod: authError.config?.method,
      message: authError.message
    });
    
    return {
      authenticated: false,
      user: null,
      apiConnected: false,
      error: authError.message,
      status: authError.response?.status,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Enhanced retry mechanism with intelligent error handling
 * Provides sophisticated retry logic with authentication recovery
 * 
 * @param {Function} requestFunction - The API request function to retry
 * @param {Array} args - Arguments to pass to the request function
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<any>} Result of the successful request
 */
const retryWithAuth = async (requestFunction, args, maxRetries = 1) => {
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[RETRY AUTH] Attempt ${attempt + 1}/${maxRetries + 1}`);
      return await requestFunction(...args);
      
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      
      console.log(`[RETRY AUTH] Attempt ${attempt + 1} failed with status ${status}`);
      
      // Handle 401 Unauthorized with authentication retry
      if (status === 401 && attempt < maxRetries) {
        console.warn('[RETRY AUTH] 401 detected, testing authentication for retry...');
        
        const authStatus = await testAuthentication();
        if (authStatus.authenticated) {
          console.log('[RETRY AUTH] Authentication confirmed, retrying request...');
          continue; // Retry the request
        } else {
          console.error('[RETRY AUTH] Authentication invalid, cannot retry');
          throw new Error('Authentication required. Please log in again.');
        }
      }
      
      // For other errors or final attempt, don't retry
      if (attempt >= maxRetries) {
        console.error(`[RETRY AUTH] All ${maxRetries + 1} attempts failed`);
        break;
      }
    }
  }
  
  // Handle final error with user-friendly messages
  const status = lastError.response?.status;
  
  if (status === 401) {
    throw new Error('Authentication required. Please log in again.');
  } else if (status === 403) {
    throw new Error('Access denied. You do not have permission for this operation.');
  } else if (status === 404) {
    throw new Error('Service endpoint not found. This may be a backend configuration issue.');
  } else if (status === 405) {
    throw new Error('Request method not allowed. This indicates a backend routing issue.');
  } else if (status >= 500) {
    throw new Error('Server error. Please try again later or contact support.');
  } else if (!lastError.response) {
    throw new Error('Network error. Please check your connection and ensure the backend server is accessible.');
  } else {
    throw lastError; // Re-throw original error if no specific handling applies
  }
};

/**
 * Date formatting utility for consistent YYYY-MM-DD format
 * Handles timezone issues by working with local dates only
 * 
 * @param {Date} date - The date to format
 * @returns {string|null} Formatted date string or null if invalid
 */
function formatDateToYYYYMMDD(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Enhanced date parsing that preserves the intended day
 * Prevents timezone-related day shifting issues
 * 
 * @param {string} dateStr - Date string in various formats
 * @returns {Date|null} Date object set to noon local time or null if invalid
 */
function parseDatePreservingDay(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  // Handle ISO date strings with time component like 2025-05-30T00:00:00.000Z
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }
  
  // Handle date strings like "Fri, 30 May 2025 00:00:00 GMT"
  if (dateStr.includes(',')) {
    try {
      const tempDate = new Date(dateStr);
      const year = tempDate.getUTCFullYear();
      const month = tempDate.getUTCMonth();
      const day = tempDate.getUTCDate();
      return new Date(year, month, day, 12, 0, 0);
    } catch (e) {
      console.error('[DATE PARSE] Error parsing date with comma:', e);
      return null;
    }
  }
  
  // Handle simple YYYY-MM-DD format
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  
  // Fallback to standard parsing with noon time set
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    date.setHours(12, 0, 0, 0);
    return date;
  } catch (e) {
    console.error('[DATE PARSE] Error in fallback date parsing:', e);
    return null;
  }
}

/**
 * Display-friendly date formatting in MM/DD/YYYY format
 * 
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string or empty string if invalid
 */
function formatDateForDisplay(date) {
  if (!date) return '';
  
  let dateObj = date;
  if (typeof date === 'string') {
    dateObj = parseDatePreservingDay(date);
  }
  
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }
  
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return `${month}/${day}/${year}`;
}

/**
 * Enhanced job retrieval with comprehensive error handling and authentication management
 * Implements robust retry logic and detailed error reporting
 * 
 * @param {Object} params - Optional query parameters for filtering jobs
 * @returns {Promise<Array>} Promise resolving to an array of processed jobs
 */
export const getJobs = async (params = {}) => {
  console.log('[GET JOBS] Starting job retrieval with params:', params);
  
  try {
    // Pre-flight authentication check to identify issues early
    console.log('[GET JOBS] Performing pre-flight authentication check...');
    const authStatus = await testAuthentication();
    
    if (!authStatus.authenticated) {
      console.error('[GET JOBS] Pre-flight authentication failed:', authStatus);
      
      // Log the authentication error for debugging
      logAuthError('GET_JOBS_PRECHECK', {
        status: authStatus.status,
        statusText: undefined,
        errorData: undefined,
        requestUrl: '/auth/me',
        requestMethod: 'GET',
        message: authStatus.error
      });
      
      throw new Error('Not authenticated. Please log in again.');
    }
    
    console.log('[GET JOBS] Authentication confirmed, proceeding with API request...');
    
    // Make the actual API request with enhanced error handling
    const response = await retryWithAuth(
      async () => {
        console.log('[GET JOBS] Making API request to /jobs...');
        
        // Log detailed request information for debugging
        console.log('[GET JOBS] Request configuration:', {
          endpoint: '/jobs',
          method: 'GET',
          params: params,
          baseURL: api.defaults?.baseURL,
          withCredentials: api.defaults?.withCredentials,
          headers: api.defaults?.headers
        });
        
        try {
          const result = await api.get('/jobs', { params });
          console.log('[GET JOBS] API request successful:', {
            status: result.status,
            statusText: result.statusText,
            dataLength: Array.isArray(result.data) ? result.data.length : 'non-array response',
            responseHeaders: result.headers
          });
          
          return result;
          
        } catch (requestError) {
          console.error('[GET JOBS] Direct API request failed:', {
            status: requestError.response?.status,
            statusText: requestError.response?.statusText,
            errorData: requestError.response?.data,
            message: requestError.message,
            requestUrl: requestError.config?.url,
            requestMethod: requestError.config?.method
          });
          
          // Re-throw with the original error for retry mechanism to handle
          throw requestError;
        }
      },
      [], // No additional arguments for the request function
      2   // Allow up to 2 retry attempts
    );
    
    // Process the response data to handle date formatting issues
    console.log('[GET JOBS] Processing response data for date handling...');
    
    if (!Array.isArray(response.data)) {
      console.warn('[GET JOBS] Response data is not an array:', typeof response.data);
      return [];
    }
    
    const processedJobs = response.data.map((job, index) => {
      try {
        // Create a copy to avoid modifying original data
        const processedJob = { ...job };
        
        // Handle scheduled_date formatting
        if (processedJob.scheduled_date) {
          const originalDate = processedJob.scheduled_date;
          const parsedDate = parseDatePreservingDay(originalDate);
          
          // Add debugging properties
          processedJob._original_scheduled_date = originalDate;
          processedJob._parsed_date_obj = parsedDate;
          processedJob.formatted_date = formatDateForDisplay(parsedDate);
          
          // Log date processing for first few jobs
          if (index < 3) {
            logDateOperation('PROCESS JOB DATE', originalDate, parsedDate, 
              `Job #${processedJob.job_number || processedJob.id}`);
          }
        }
        
        return processedJob;
        
      } catch (processingError) {
        console.error(`[GET JOBS] Error processing job at index ${index}:`, processingError);
        // Return original job if processing fails
        return job;
      }
    });
    
    // Log summary of processed jobs
    console.log('[GET JOBS] Successfully processed jobs:', {
      totalJobs: processedJobs.length,
      jobsWithDates: processedJobs.filter(job => job.scheduled_date).length,
      sampleJobs: processedJobs.slice(0, 3).map(job => ({
        id: job.id,
        jobNumber: job.job_number,
        status: job.status,
        originalDate: job._original_scheduled_date,
        formattedDate: job.formatted_date
      }))
    });
    
    return processedJobs;
    
  } catch (error) {
    console.error('[GET JOBS] Job retrieval failed:', error);
    
    // Log comprehensive error information
    logAuthError('GET_JOBS', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorData: error.response?.data,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
      message: error.message
    });
    
    // Provide user-friendly error messages based on error characteristics
    if (error.message === 'Not authenticated. Please log in again.') {
      throw error; // Re-throw authentication errors as-is
    } else if (error.message.includes('Authentication required')) {
      throw new Error('Your session has expired. Please log out and log back in.');
    } else if (error.response?.status === 403) {
      throw new Error('You do not have permission to access jobs. Please contact your administrator.');
    } else if (error.response?.status === 404) {
      throw new Error('Jobs service not found. Please ensure the backend server is running and properly configured.');
    } else if (error.response?.status === 405) {
      throw new Error('The jobs service is temporarily unavailable due to a server configuration issue. Please try again later or contact support.');
    } else if (error.response?.status >= 500) {
      throw new Error('Server error occurred while retrieving jobs. Please try again later.');
    } else if (!error.response) {
      throw new Error('Unable to connect to the jobs service. Please check your network connection and try again.');
    } else {
      throw new Error(`Failed to load jobs: ${error.message}`);
    }
  }
};

/**
 * Enhanced individual job retrieval with comprehensive error handling
 * 
 * @param {number|string} id - The job ID to retrieve
 * @returns {Promise<Object>} Promise resolving to the processed job data
 */
export const getJob = async (id) => {
  console.log(`[GET JOB] Retrieving job #${id}...`);
  
  try {
    const response = await retryWithAuth(
      async () => {
        console.log(`[GET JOB] Making API request for job #${id}...`);
        return await api.get(`/jobs/${id}`);
      },
      [],
      2 // Allow 2 retry attempts
    );
    
    const job = response.data;
    console.log(`[GET JOB] Successfully retrieved job #${id}`);
    
    // Process date fields if present
    if (job.scheduled_date) {
      const originalDate = job.scheduled_date;
      const parsedDate = parseDatePreservingDay(originalDate);
      
      job._original_scheduled_date = originalDate;
      job._parsed_date_obj = parsedDate;
      job.formatted_date = formatDateForDisplay(parsedDate);
      
      logDateOperation('GET SINGLE JOB', id, originalDate, `Job #${id} date processing`);
      
      console.log(`[GET JOB] Date processing complete for job #${id}:`, {
        originalFromServer: originalDate,
        parsedDate: parsedDate,
        formattedForDisplay: job.formatted_date
      });
    }
    
    return job;
    
  } catch (error) {
    console.error(`[GET JOB] Failed to retrieve job #${id}:`, error);
    
    logAuthError('GET_JOB', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorData: error.response?.data,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
      message: error.message
    });
    
    // Provide specific error messages for different scenarios
    if (error.response?.status === 404) {
      throw new Error(`Job #${id} not found. It may have been deleted or you may not have access to it.`);
    } else if (error.response?.status === 403) {
      throw new Error(`Access denied for job #${id}. You may not have permission to view this job.`);
    } else {
      throw error;
    }
  }
};

/**
 * Enhanced job scheduling with comprehensive date handling and error management
 * 
 * @param {number|string} jobId - The job ID to schedule
 * @param {Object} scheduleData - The scheduling information
 * @returns {Promise<Object>} Promise resolving to the scheduled job
 */
export const scheduleJob = async (jobId, scheduleData) => {
  console.log(`[SCHEDULE JOB] Starting scheduling process for job #${jobId}...`);
  console.log('[SCHEDULE JOB] Original scheduling data:', JSON.parse(JSON.stringify(scheduleData)));
  
  try {
    // Create a deep copy for processing to avoid modifying original data
    const processedData = JSON.parse(JSON.stringify(scheduleData));
    
    // Enhanced date processing with multiple format support
    if (processedData.scheduled_date) {
      const originalDate = processedData.scheduled_date;
      
      console.log(`[SCHEDULE JOB] Processing date for job #${jobId}:`, {
        originalValue: originalDate,
        originalType: typeof originalDate,
        isDateObject: originalDate instanceof Date
      });
      
      // Handle different date input formats
      if (originalDate instanceof Date) {
        processedData.scheduled_date = formatDateToYYYYMMDD(originalDate);
        console.log(`[SCHEDULE JOB] Converted Date object to YYYY-MM-DD format:`, processedData.scheduled_date);
        
      } else if (typeof originalDate === 'string') {
        // Handle ISO format strings
        if (originalDate.includes('T') || originalDate.includes('Z') || originalDate.includes('+')) {
          const parsedDate = new Date(originalDate);
          processedData.scheduled_date = formatDateToYYYYMMDD(parsedDate);
          console.log(`[SCHEDULE JOB] Converted ISO string to YYYY-MM-DD format:`, processedData.scheduled_date);
          
        } else if (originalDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Already in YYYY-MM-DD format
          console.log(`[SCHEDULE JOB] Date already in correct YYYY-MM-DD format:`, originalDate);
          
        } else {
          // Try to parse other string formats
          try {
            const parsedDate = new Date(originalDate);
            if (!isNaN(parsedDate.getTime())) {
              processedData.scheduled_date = formatDateToYYYYMMDD(parsedDate);
              console.log(`[SCHEDULE JOB] Parsed and converted string date:`, processedData.scheduled_date);
            } else {
              console.warn(`[SCHEDULE JOB] Could not parse date string: ${originalDate}`);
            }
          } catch (dateError) {
            console.error(`[SCHEDULE JOB] Date parsing error:`, dateError);
          }
        }
      }
    }
    
    // Handle alternative date field names
    if (processedData.schedule_date && !processedData.scheduled_date) {
      processedData.scheduled_date = processedData.schedule_date;
      console.log(`[SCHEDULE JOB] Using schedule_date field:`, processedData.scheduled_date);
    }
    
    console.log(`[SCHEDULE JOB] Final processed data for job #${jobId}:`, processedData);
    
    // Make the scheduling request with retry logic
    const response = await retryWithAuth(
      async () => {
        console.log(`[SCHEDULE JOB] Making API request to schedule job #${jobId}...`);
        return await api.post(`/jobs/${jobId}/schedule`, processedData);
      },
      [],
      2 // Allow 2 retry attempts
    );
    
    console.log(`[SCHEDULE JOB] Successfully scheduled job #${jobId}:`, response.data);
    
    // Process the response to fix date handling
    const scheduledJob = response.data;
    
    if (scheduledJob.scheduled_date) {
      const parsedDate = parseDatePreservingDay(scheduledJob.scheduled_date);
      scheduledJob._original_scheduled_date = scheduledJob.scheduled_date;
      scheduledJob._parsed_date_obj = parsedDate;
      scheduledJob.formatted_date = formatDateForDisplay(parsedDate);
      
      console.log(`[SCHEDULE JOB] Processed response date for job #${jobId}:`, {
        originalFromServer: scheduledJob._original_scheduled_date,
        parsedDate: scheduledJob._parsed_date_obj,
        formattedForDisplay: scheduledJob.formatted_date
      });
    }
    
    return scheduledJob;
    
  } catch (error) {
    console.error(`[SCHEDULE JOB] Failed to schedule job #${jobId}:`, error);
    
    logAuthError('SCHEDULE_JOB', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorData: error.response?.data,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
      message: error.message
    });
    
    // Enhanced error logging for debugging
    if (error.response) {
      console.error(`[SCHEDULE JOB] Server responded with error:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
    }
    
    throw error;
  }
};

/**
 * Enhanced job status update with comprehensive authentication and error handling
 * 
 * @param {number|string} jobId - The job ID to update
 * @param {Object} statusData - The status data to update
 * @returns {Promise<Object>} Promise resolving to the updated job
 */
export const updateJobStatus = async (jobId, statusData) => {
  console.log(`[UPDATE JOB STATUS] Starting status update for job #${jobId}...`);
  console.log('[UPDATE JOB STATUS] Status data:', statusData);
  
  try {
    // Pre-authentication check for status updates
    console.log('[UPDATE JOB STATUS] Verifying authentication before status update...');
    const authTest = await testAuthentication();
    
    if (!authTest.authenticated) {
      console.error('[UPDATE JOB STATUS] Authentication check failed:', authTest);
      throw new Error('Not authenticated. Please log in again.');
    }
    
    console.log('[UPDATE JOB STATUS] Authentication verified, proceeding with status update...');
    
    // Make the status update request with retry logic
    const response = await retryWithAuth(
      async () => {
        console.log(`[UPDATE JOB STATUS] Making API request to update job #${jobId} status...`);
        
        // Log API configuration for debugging
        console.log('[UPDATE JOB STATUS] API request configuration:', {
          endpoint: `/jobs/${jobId}/status`,
          method: 'PUT',
          data: statusData,
          baseURL: api.defaults?.baseURL,
          withCredentials: api.defaults?.withCredentials
        });
        
        const result = await api.put(`/jobs/${jobId}/status`, statusData);
        
        console.log(`[UPDATE JOB STATUS] Status update successful for job #${jobId}:`, {
          status: result.status,
          statusText: result.statusText,
          newJobStatus: result.data?.status
        });
        
        return result;
      },
      [],
      2 // Allow 2 retry attempts
    );
    
    // Process the response to handle dates
    const updatedJob = response.data;
    
    if (updatedJob.scheduled_date) {
      const parsedDate = parseDatePreservingDay(updatedJob.scheduled_date);
      updatedJob._original_scheduled_date = updatedJob.scheduled_date;
      updatedJob._parsed_date_obj = parsedDate;
      updatedJob.formatted_date = formatDateForDisplay(parsedDate);
    }
    
    console.log(`[UPDATE JOB STATUS] Job #${jobId} status updated successfully:`, {
      jobId: updatedJob.id,
      newStatus: updatedJob.status,
      formattedDate: updatedJob.formatted_date
    });
    
    return updatedJob;
    
  } catch (error) {
    console.error(`[UPDATE JOB STATUS] Failed to update job #${jobId} status:`, error);
    
    logAuthError('UPDATE_JOB_STATUS', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorData: error.response?.data,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
      message: error.message
    });
    
    // Provide specific error messages based on error type
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Your session may have expired. Please log out and log back in.');
    } else if (error.response?.status === 403) {
      throw new Error('Access denied. You may not have permission to update job status.');
    } else if (error.response?.status === 404) {
      throw new Error(`Job #${jobId} not found or may have been deleted.`);
    } else if (!error.response) {
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      throw error;
    }
  }
};

/**
 * Enhanced door completion with comprehensive error handling
 * 
 * @param {number|string} jobId - The job ID
 * @param {number|string} doorId - The door ID to complete
 * @param {Object} completionData - The door completion data
 * @returns {Promise<Object>} Promise resolving to the completion data
 */
export const completeDoor = async (jobId, doorId, completionData) => {
  console.log(`[COMPLETE DOOR] Starting door completion for door #${doorId} on job #${jobId}...`);
  console.log('[COMPLETE DOOR] Completion data:', completionData);
  
  try {
    const response = await retryWithAuth(
      async () => {
        console.log(`[COMPLETE DOOR] Making API request for door #${doorId} completion...`);
        return await api.post(`/jobs/${jobId}/doors/${doorId}/complete`, completionData);
      },
      [],
      2 // Allow 2 retry attempts
    );
    
    console.log(`[COMPLETE DOOR] Door #${doorId} completed successfully for job #${jobId}:`, response.data);
    return response.data;
    
  } catch (error) {
    console.error(`[COMPLETE DOOR] Failed to complete door #${doorId} for job #${jobId}:`, error);
    
    logAuthError('COMPLETE_DOOR', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorData: error.response?.data,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
      message: error.message
    });
    
    throw error;
  }
};

/**
 * Enhanced scheduled jobs retrieval with comprehensive date range handling
 * 
 * @param {string|Date} startDate - Start date for range
 * @param {string|Date} endDate - End date for range
 * @param {string|null} region - Optional region filter
 * @returns {Promise<Array>} Promise resolving to array of scheduled jobs
 */
export const getScheduledJobs = async (startDate, endDate, region = null) => {
  console.log('[GET SCHEDULED JOBS] Starting scheduled jobs retrieval...');
  
  try {
    // Format dates consistently for API request
    const formattedStartDate = startDate instanceof Date ? formatDateToYYYYMMDD(startDate) : startDate;
    const formattedEndDate = endDate instanceof Date ? formatDateToYYYYMMDD(endDate) : endDate;
    
    console.log('[GET SCHEDULED JOBS] Date range processing:', {
      originalRange: { startDate, endDate },
      formattedRange: { formattedStartDate, formattedEndDate },
      region: region
    });
    
    // Build query parameters
    const params = {
      start_date: formattedStartDate,
      end_date: formattedEndDate,
      status: 'scheduled'
    };
    
    if (region) {
      params.region = region;
    }
    
    const response = await retryWithAuth(
      async () => {
        console.log('[GET SCHEDULED JOBS] Making API request with params:', params);
        return await api.get('/jobs', { params });
      },
      [],
      2 // Allow 2 retry attempts
    );
    
    // Process the jobs to handle date formatting
    const scheduledJobs = response.data.map(job => {
      if (job.scheduled_date) {
        const parsedDate = parseDatePreservingDay(job.scheduled_date);
        job._original_scheduled_date = job.scheduled_date;
        job._parsed_date_obj = parsedDate;
        job.formatted_date = formatDateForDisplay(parsedDate);
      }
      return job;
    });
    
    console.log('[GET SCHEDULED JOBS] Successfully retrieved and processed scheduled jobs:', {
      totalJobs: scheduledJobs.length,
      dateRange: `${formattedStartDate} to ${formattedEndDate}`,
      region: region || 'all regions'
    });
    
    return scheduledJobs;
    
  } catch (error) {
    console.error('[GET SCHEDULED JOBS] Failed to retrieve scheduled jobs:', error);
    
    logAuthError('GET_SCHEDULED_JOBS', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorData: error.response?.data,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
      message: error.message
    });
    
    throw error;
  }
};

/**
 * Enhanced jobs retrieval for specific date with comprehensive filtering
 * 
 * @param {string|Date} date - The date to get jobs for
 * @param {string|null} region - Optional region filter
 * @returns {Promise<Array>} Promise resolving to array of jobs for that date
 */
export const getJobsForDate = async (date, region = null) => {
  console.log('[GET JOBS FOR DATE] Starting date-specific job retrieval...');
  
  try {
    // Format date consistently
    const formattedDate = date instanceof Date ? formatDateToYYYYMMDD(date) : date;
    
    console.log('[GET JOBS FOR DATE] Processing request for date:', {
      originalDate: date,
      formattedDate: formattedDate,
      region: region
    });
    
    // Build query parameters
    const params = {
      scheduled_date: formattedDate,
      status: 'scheduled'
    };
    
    if (region) {
      params.region = region;
    }
    
    const response = await retryWithAuth(
      async () => {
        console.log('[GET JOBS FOR DATE] Making API request with params:', params);
        return await api.get('/jobs', { params });
      },
      [],
      2 // Allow 2 retry attempts
    );
    
    // Process the jobs to handle date formatting
    const dateJobs = response.data.map(job => {
      if (job.scheduled_date) {
        const parsedDate = parseDatePreservingDay(job.scheduled_date);
        job._original_scheduled_date = job.scheduled_date;
        job._parsed_date_obj = parsedDate;
        job.formatted_date = formatDateForDisplay(parsedDate);
      }
      return job;
    });
    
    console.log('[GET JOBS FOR DATE] Successfully retrieved jobs for date:', {
      date: formattedDate,
      totalJobs: dateJobs.length,
      region: region || 'all regions'
    });
    
    return dateJobs;
    
  } catch (error) {
    console.error(`[GET JOBS FOR DATE] Failed to retrieve jobs for date ${date}:`, error);
    
    logAuthError('GET_JOBS_FOR_DATE', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorData: error.response?.data,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
      message: error.message
    });
    
    throw error;
  }
};

/**
 * Enhanced job cancellation with comprehensive error handling and authentication
 * 
 * @param {number} jobId - The ID of the job to cancel
 * @param {Object} cancelData - Optional data containing cancellation details
 * @param {string} cancelData.reason - Optional reason for cancellation
 * @returns {Promise<Object>} - The API response with cancelled job data
 */
export const cancelJob = async (jobId, cancelData = {}) => {
  console.log(`[CANCEL JOB] Starting cancellation process for job #${jobId}...`);
  console.log('[CANCEL JOB] Cancellation data:', cancelData);
  
  try {
    // Pre-authentication check for job cancellation
    console.log('[CANCEL JOB] Verifying authentication before cancellation...');
    const authTest = await testAuthentication();
    
    if (!authTest.authenticated) {
      console.error('[CANCEL JOB] Authentication check failed:', authTest);
      throw new Error('Not authenticated. Please log in again.');
    }
    
    console.log('[CANCEL JOB] Authentication verified, proceeding with cancellation...');
    
    // Make the cancellation request with retry logic
    const response = await retryWithAuth(
      async () => {
        console.log(`[CANCEL JOB] Making API request to cancel job #${jobId}...`);
        const result = await api.post(`/jobs/${jobId}/cancel`, cancelData);
        return result.data;
      },
      [],
      2 // Allow 2 retry attempts
    );
    
    console.log(`[CANCEL JOB] Job #${jobId} cancelled successfully:`, response);
    return response;
    
  } catch (error) {
    console.error(`[CANCEL JOB] Failed to cancel job #${jobId}:`, error);
    
    logAuthError('CANCEL_JOB', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorData: error.response?.data,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
      message: error.message
    });
    
    // Provide specific error messages for cancellation scenarios
    if (error.response?.status === 404) {
      throw new Error(`Job #${jobId} not found or may have already been cancelled.`);
    } else if (error.response?.status === 403) {
      throw new Error(`Access denied. You may not have permission to cancel job #${jobId}.`);
    } else if (error.response?.status === 409) {
      throw new Error(`Job #${jobId} cannot be cancelled in its current state.`);
    } else {
      throw error;
    }
  }
};