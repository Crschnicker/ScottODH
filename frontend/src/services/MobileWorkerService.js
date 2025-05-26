/**
 * Mobile Worker Service
 * Complete service for handling all mobile job worker functionality
 * Includes job management, calendar operations, time tracking, media upload, and offline support
 */

class MobileWorkerService {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
    this.cache = new Map();
    this.retryCount = 3;
    this.retryDelay = 1000; // 1 second
    this.isOnline = navigator.onLine;
    this.setupOfflineDetection();
  }

  /**
   * Set up automatic online/offline detection
   */
  setupOfflineDetection() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('Connection restored - syncing pending changes');
      this.syncPendingChanges();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('Connection lost - enabling offline mode');
    });
  }

  /**
   * Generic API request handler with retry logic and comprehensive error handling
   * @param {string} endpoint - API endpoint 
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Response data
   */
  async apiRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    };

    const requestOptions = { ...defaultOptions, ...options };

    // Handle FormData requests (for file uploads)
    if (options.body instanceof FormData) {
      delete requestOptions.headers['Content-Type'];
    }

    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(errorMessage);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error(`API request failed (attempt ${attempt}/${this.retryCount}):`, error);
        
        if (attempt === this.retryCount) {
          // If we're offline, check for cached data
          if (!this.isOnline && options.method === 'GET') {
            const cachedData = this.getCachedResponse(endpoint);
            if (cachedData) {
              console.log('Returning cached data due to offline status');
              return cachedData;
            }
          }
          throw error;
        }
        
        // Exponential backoff for retries
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
  }

  /**
   * Convert data URL to Blob for file uploads
   * @param {string} dataURL - Base64 data URL
   * @returns {Blob} - Blob object
   */
  dataURLToBlob(dataURL) {
    try {
      const arr = dataURL.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (error) {
      console.error('Error converting data URL to blob:', error);
      throw new Error('Invalid data URL format');
    }
  }

  /**
   * Create a cache key for requests
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Request parameters
   * @returns {string} - Cache key
   */
  createCacheKey(method, endpoint, params = {}) {
    return `${method}:${endpoint}:${JSON.stringify(params)}`;
  }

  /**
   * Cache API response
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Response data
   * @param {number} ttl - Time to live in milliseconds
   */
  cacheResponse(endpoint, data, ttl = 5 * 60 * 1000) {
    const cacheKey = this.createCacheKey('GET', endpoint);
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      ttl
    };
    this.cache.set(cacheKey, cacheEntry);
    
    // Auto-cleanup expired cache
    setTimeout(() => this.cache.delete(cacheKey), ttl);
  }

  /**
   * Get cached API response
   * @param {string} endpoint - API endpoint
   * @returns {Object|null} - Cached data or null
   */
  getCachedResponse(endpoint) {
    const cacheKey = this.createCacheKey('GET', endpoint);
    const cacheEntry = this.cache.get(cacheKey);
    
    if (!cacheEntry) return null;
    
    const { data, timestamp, ttl } = cacheEntry;
    if (Date.now() - timestamp > ttl) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return data;
  }

  // ============================================================================
  // JOB MANAGEMENT
  // ============================================================================

  /**
   * Get complete job details for mobile worker
   * @param {number} jobId - Job ID
   * @param {boolean} useCache - Whether to use cached data
   * @returns {Promise<Object>} - Job details with doors and line items
   */
  async getJob(jobId, useCache = true) {
    const endpoint = `/mobile/jobs/${jobId}`;
    
    if (useCache) {
      const cached = this.getCachedResponse(endpoint);
      if (cached) return cached;
    }

    try {
      const data = await this.apiRequest(endpoint);
      
      // Cache the result
      if (useCache) {
        this.cacheResponse(endpoint, data, 5 * 60 * 1000); // 5 minutes
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching job:', error);
      
      // Try offline cache as fallback
      if (!this.isOnline) {
        const offlineData = this.getCachedJob(jobId);
        if (offlineData) {
          console.log('Using offline cached job data');
          return offlineData;
        }
      }
      
      throw new Error(`Failed to load job details: ${error.message}`);
    }
  }

  /**
   * Start a job with signature
   * @param {number} jobId - Job ID
   * @param {string} signatureData - Base64 signature data
   * @param {string} signerName - Name of person signing
   * @param {string} signerTitle - Title of person signing
   * @returns {Promise<Object>} - Start confirmation
   */
  async startJob(jobId, signatureData, signerName = '', signerTitle = 'Site Contact') {
    const requestData = {
      signature: signatureData,
      signer_name: signerName,
      signer_title: signerTitle
    };

    try {
      if (!this.isOnline) {
        // Store for offline sync
        this.storePendingChange('job_start', {
          jobId,
          ...requestData
        });
        return { success: true, offline: true, job_id: jobId };
      }

      const data = await this.apiRequest(`/mobile/jobs/${jobId}/start`, {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      // Clear job cache since data has changed
      this.clearJobCache(jobId);
      
      return data;
    } catch (error) {
      console.error('Error starting job:', error);
      
      // Store for offline sync if network error
      if (error.message.includes('fetch') || error.message.includes('Network')) {
        this.storePendingChange('job_start', {
          jobId,
          ...requestData
        });
        return { success: true, offline: true, job_id: jobId };
      }
      
      throw new Error(`Failed to start job: ${error.message}`);
    }
  }

  /**
   * Complete entire job with final signature
   * @param {number} jobId - Job ID
   * @param {string} signatureData - Base64 signature data
   * @param {string} signerName - Name of person signing
   * @param {string} signerTitle - Title of person signing
   * @returns {Promise<Object>} - Completion confirmation
   */
  async completeJob(jobId, signatureData, signerName = '', signerTitle = 'Site Contact') {
    const requestData = {
      signature: signatureData,
      signer_name: signerName,
      signer_title: signerTitle
    };

    try {
      if (!this.isOnline) {
        this.storePendingChange('job_complete', {
          jobId,
          ...requestData
        });
        return { success: true, offline: true, job_id: jobId };
      }

      const data = await this.apiRequest(`/mobile/jobs/${jobId}/complete`, {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      // Clear job cache since data has changed
      this.clearJobCache(jobId);
      
      return data;
    } catch (error) {
      console.error('Error completing job:', error);
      
      if (error.message.includes('fetch') || error.message.includes('Network')) {
        this.storePendingChange('job_complete', {
          jobId,
          ...requestData
        });
        return { success: true, offline: true, job_id: jobId };
      }
      
      throw new Error(`Failed to complete job: ${error.message}`);
    }
  }

  // ============================================================================
  // LINE ITEM MANAGEMENT
  // ============================================================================

  /**
   * Toggle completion status of a line item
   * @param {number} jobId - Job ID
   * @param {number} lineItemId - Line item ID
   * @returns {Promise<Object>} - Updated line item status
   */
  async toggleLineItem(jobId, lineItemId) {
    try {
      if (!this.isOnline) {
        this.storePendingChange('line_item_toggle', {
          jobId,
          lineItemId
        });
        return { success: true, offline: true, line_item_id: lineItemId };
      }

      const data = await this.apiRequest(`/mobile/jobs/${jobId}/line-items/${lineItemId}/toggle`, {
        method: 'PUT'
      });

      // Clear job cache since data has changed
      this.clearJobCache(jobId);
      
      return data;
    } catch (error) {
      console.error('Error toggling line item:', error);
      
      if (error.message.includes('fetch') || error.message.includes('Network')) {
        this.storePendingChange('line_item_toggle', {
          jobId,
          lineItemId
        });
        return { success: true, offline: true, line_item_id: lineItemId };
      }
      
      throw new Error(`Failed to update line item: ${error.message}`);
    }
  }

  // ============================================================================
  // DOOR MANAGEMENT
  // ============================================================================

  /**
   * Upload photo for door completion
   * @param {number} doorId - Door ID
   * @param {number} jobId - Job ID
   * @param {string|Blob} photoData - Photo data (data URL or Blob)
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Upload confirmation
   */
  async uploadDoorPhoto(doorId, jobId, photoData, onProgress = null) {
    try {
      if (!this.isOnline) {
        // Store photo locally for offline sync
        const storageKey = `offline_photo_${doorId}_${jobId}`;
        if (typeof photoData === 'string') {
          localStorage.setItem(storageKey, photoData);
        } else {
          // For Blob, convert to data URL
          const dataURL = await this.blobToDataURL(photoData);
          localStorage.setItem(storageKey, dataURL);
        }
        
        this.storePendingChange('door_photo', {
          doorId,
          jobId,
          storageKey
        });
        
        return { success: true, offline: true, door_id: doorId };
      }

      const formData = new FormData();
      formData.append('job_id', jobId.toString());
      formData.append('media_type', 'photo');
      
      // Convert data URL to blob if necessary
      if (typeof photoData === 'string') {
        const blob = this.dataURLToBlob(photoData);
        formData.append('file', blob, `door_${doorId}_photo.jpg`);
      } else {
        formData.append('file', photoData, `door_${doorId}_photo.jpg`);
      }

      const data = await this.apiRequest(`/mobile/doors/${doorId}/media/upload`, {
        method: 'POST',
        body: formData
      });

      // Clear job cache since data has changed
      this.clearJobCache(jobId);
      
      return data;
    } catch (error) {
      console.error('Error uploading door photo:', error);
      throw new Error(`Failed to upload photo: ${error.message}`);
    }
  }

  /**
   * Upload video for door completion
   * @param {number} doorId - Door ID
   * @param {number} jobId - Job ID
   * @param {Blob} videoBlob - Video blob data
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Upload confirmation
   */
  async uploadDoorVideo(doorId, jobId, videoBlob, onProgress = null) {
    try {
      if (!this.isOnline) {
        // Video upload requires internet connection
        throw new Error('Video upload requires internet connection');
      }

      const formData = new FormData();
      formData.append('job_id', jobId.toString());
      formData.append('media_type', 'video');
      formData.append('file', videoBlob, `door_${doorId}_video.webm`);

      const data = await this.apiRequest(`/mobile/doors/${doorId}/media/upload`, {
        method: 'POST',
        body: formData
      });

      // Clear job cache since data has changed
      this.clearJobCache(jobId);
      
      return data;
    } catch (error) {
      console.error('Error uploading door video:', error);
      throw new Error(`Failed to upload video: ${error.message}`);
    }
  }

  /**
   * Complete a door with signature
   * @param {number} doorId - Door ID
   * @param {number} jobId - Job ID
   * @param {string} signatureData - Base64 signature data
   * @param {string} signerName - Name of person signing
   * @param {string} signerTitle - Title of person signing
   * @returns {Promise<Object>} - Completion confirmation
   */
  async completeDoor(doorId, jobId, signatureData, signerName = '', signerTitle = 'Site Contact') {
    const requestData = {
      job_id: jobId,
      signature: signatureData,
      signer_name: signerName,
      signer_title: signerTitle
    };

    try {
      if (!this.isOnline) {
        this.storePendingChange('door_complete', {
          doorId,
          ...requestData
        });
        return { success: true, offline: true, door_id: doorId };
      }

      const data = await this.apiRequest(`/mobile/doors/${doorId}/complete`, {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      // Clear job cache since data has changed
      this.clearJobCache(jobId);
      
      return data;
    } catch (error) {
      console.error('Error completing door:', error);
      
      if (error.message.includes('fetch') || error.message.includes('Network')) {
        this.storePendingChange('door_complete', {
          doorId,
          ...requestData
        });
        return { success: true, offline: true, door_id: doorId };
      }
      
      throw new Error(`Failed to complete door: ${error.message}`);
    }
  }

  // ============================================================================
  // CALENDAR OPERATIONS
  // ============================================================================

  /**
   * Get jobs for calendar view with date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {boolean} includeUnscheduled - Whether to include unscheduled jobs
   * @returns {Promise<Array>} - Array of jobs
   */
  async getJobsForCalendar(startDate, endDate, includeUnscheduled = false) {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        include_unscheduled: includeUnscheduled.toString()
      });

      const endpoint = `/jobs?${params}`;
      
      // Check cache first
      const cached = this.getCachedResponse(endpoint);
      if (cached) return cached;

      const data = await this.apiRequest(endpoint);
      
      // Cache the result
      this.cacheResponse(endpoint, data, 10 * 60 * 1000); // 10 minutes
      
      return data;
    } catch (error) {
      console.error('Error fetching calendar jobs:', error);
      
      // Try offline cache
      if (!this.isOnline) {
        const offlineData = this.getCachedCalendarData(startDate, endDate);
        if (offlineData && offlineData.jobs) {
          return offlineData.jobs;
        }
      }
      
      throw new Error(`Failed to load calendar jobs: ${error.message}`);
    }
  }

  /**
   * Get calendar summary data for visualization
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} - Calendar summary data
   */
  async getCalendarSummary(startDate, endDate) {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      });

      const endpoint = `/mobile/calendar/summary?${params}`;
      
      // Check cache first
      const cached = this.getCachedResponse(endpoint);
      if (cached) return cached;

      const data = await this.apiRequest(endpoint);
      
      // Cache the result
      this.cacheResponse(endpoint, data, 10 * 60 * 1000); // 10 minutes
      
      return data;
    } catch (error) {
      console.error('Error fetching calendar summary:', error);
      
      // Try offline cache
      if (!this.isOnline) {
        const offlineData = this.getCachedCalendarData(startDate, endDate);
        if (offlineData && offlineData.summary) {
          return offlineData.summary;
        }
      }
      
      throw new Error(`Failed to load calendar summary: ${error.message}`);
    }
  }

  /**
   * Get jobs available for mobile workers (today's jobs + in progress)
   * @returns {Promise<Array>} - Array of available jobs
   */
  async getAvailableJobs() {
    try {
      const endpoint = '/mobile/jobs/available';
      
      // Check cache first
      const cached = this.getCachedResponse(endpoint);
      if (cached) return cached;

      const data = await this.apiRequest(endpoint);
      
      // Cache for shorter time since this changes frequently
      this.cacheResponse(endpoint, data, 2 * 60 * 1000); // 2 minutes
      
      return data;
    } catch (error) {
      console.error('Error fetching available jobs:', error);
      throw new Error(`Failed to load available jobs: ${error.message}`);
    }
  }

  /**
   * Get jobs for a specific date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Promise<Array>} - Array of jobs for the date
   */
  async getJobsForDate(date) {
    try {
      const params = new URLSearchParams({
        scheduled_date: date
      });

      const endpoint = `/jobs?${params}`;
      
      // Check cache first
      const cached = this.getCachedResponse(endpoint);
      if (cached) return cached;

      const data = await this.apiRequest(endpoint);
      
      // Cache the result
      this.cacheResponse(endpoint, data, 5 * 60 * 1000); // 5 minutes
      
      return data;
    } catch (error) {
      console.error('Error fetching jobs for date:', error);
      throw new Error(`Failed to load jobs for ${date}: ${error.message}`);
    }
  }

  // ============================================================================
  // TIME TRACKING
  // ============================================================================

  /**
   * Get current time tracking information for a job
   * @param {number} jobId - Job ID
   * @returns {Promise<Object>} - Time tracking data
   */
  async getTimeTracking(jobId) {
    try {
      const data = await this.apiRequest(`/mobile/jobs/${jobId}/time`);
      return data;
    } catch (error) {
      console.error('Error getting time tracking:', error);
      throw new Error(`Failed to get time tracking: ${error.message}`);
    }
  }

  // ============================================================================
  // SIGNATURE MANAGEMENT
  // ============================================================================

  /**
   * Get signature data by ID
   * @param {number} signatureId - Signature ID
   * @returns {Promise<Object>} - Signature data
   */
  async getSignature(signatureId) {
    try {
      const data = await this.apiRequest(`/mobile/signatures/${signatureId}`);
      return data;
    } catch (error) {
      console.error('Error getting signature:', error);
      throw new Error(`Failed to get signature: ${error.message}`);
    }
  }

  // ============================================================================
  // MEDIA SERVING
  // ============================================================================

  /**
   * Get URL for serving door media
   * @param {number} mediaId - Media ID
   * @returns {string} - Media URL
   */
  getMediaUrl(mediaId) {
    return `${this.baseURL}/mobile/media/${mediaId}/serve`;
  }

  // ============================================================================
  // OFFLINE SUPPORT
  // ============================================================================

  /**
   * Cache job data for offline access
   * @param {number} jobId - Job ID
   * @returns {Promise<void>}
   */
  async cacheJobForOffline(jobId) {
    try {
      const jobData = await this.getJob(jobId, false);
      
      // Store in localStorage for offline access
      const offlineKey = `offline_job_${jobId}`;
      localStorage.setItem(offlineKey, JSON.stringify({
        data: jobData,
        timestamp: Date.now(),
        version: '1.0'
      }));

      console.log(`Job ${jobId} cached for offline access`);
    } catch (error) {
      console.error('Error caching job for offline:', error);
    }
  }

  /**
   * Get cached job data for offline access
   * @param {number} jobId - Job ID
   * @returns {Object|null} - Cached job data or null
   */
  getCachedJob(jobId) {
    try {
      const offlineKey = `offline_job_${jobId}`;
      const cached = localStorage.getItem(offlineKey);
      
      if (!cached) return null;
      
      const { data, timestamp, version } = JSON.parse(cached);
      
      // Check if cache is too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - timestamp > maxAge) {
        localStorage.removeItem(offlineKey);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error getting cached job:', error);
      return null;
    }
  }

  /**
   * Cache calendar data for offline access
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Promise<void>}
   */
  async cacheCalendarData(startDate, endDate) {
    try {
      const jobs = await this.getJobsForCalendar(startDate, endDate, true);
      const summary = await this.getCalendarSummary(startDate, endDate);
      
      // Store in localStorage for offline access
      const cacheKey = `offline_calendar_${startDate}_${endDate}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        jobs,
        summary,
        timestamp: Date.now(),
        version: '1.0'
      }));

      console.log(`Calendar data cached for ${startDate} to ${endDate}`);
    } catch (error) {
      console.error('Error caching calendar data:', error);
    }
  }

  /**
   * Get cached calendar data for offline access
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Object|null} - Cached calendar data or null
   */
  getCachedCalendarData(startDate, endDate) {
    try {
      const cacheKey = `offline_calendar_${startDate}_${endDate}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return null;
      
      const { jobs, summary, timestamp, version } = JSON.parse(cached);
      
      // Check if cache is too old (6 hours for calendar data)
      const maxAge = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
      if (Date.now() - timestamp > maxAge) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      return { jobs, summary };
    } catch (error) {
      console.error('Error getting cached calendar data:', error);
      return null;
    }
  }

  /**
   * Store pending changes for sync when online
   * @param {string} type - Type of change
   * @param {Object} data - Change data
   */
  storePendingChange(type, data) {
    try {
      const pendingKey = 'pending_changes';
      let pendingChanges = JSON.parse(localStorage.getItem(pendingKey) || '[]');
      
      pendingChanges.push({
        id: Date.now() + Math.random(), // Unique ID
        type,
        data,
        timestamp: Date.now()
      });
      
      localStorage.setItem(pendingKey, JSON.stringify(pendingChanges));
      console.log(`Stored pending change: ${type}`, data);
    } catch (error) {
      console.error('Error storing pending change:', error);
    }
  }

  /**
   * Sync pending changes when back online
   * @returns {Promise<Object>} - Sync results
   */
  async syncPendingChanges() {
    try {
      const pendingKey = 'pending_changes';
      const pendingChanges = JSON.parse(localStorage.getItem(pendingKey) || '[]');
      
      if (pendingChanges.length === 0) {
        return { success: true, synced: 0, errors: [] };
      }

      console.log(`Syncing ${pendingChanges.length} pending changes`);

      const results = {
        success: true,
        synced: 0,
        errors: []
      };

      for (const change of pendingChanges) {
        try {
          console.log(`Syncing ${change.type}:`, change.data);
          
          switch (change.type) {
            case 'job_start':
              await this.startJob(
                change.data.jobId,
                change.data.signature,
                change.data.signer_name,
                change.data.signer_title
              );
              break;
              
            case 'line_item_toggle':
              await this.toggleLineItem(change.data.jobId, change.data.lineItemId);
              break;
              
            case 'door_photo':
              // Retrieve photo from local storage and upload
              const photoData = localStorage.getItem(change.data.storageKey);
              if (photoData) {
                await this.uploadDoorPhoto(change.data.doorId, change.data.jobId, photoData);
                localStorage.removeItem(change.data.storageKey);
              }
              break;
              
            case 'door_complete':
              await this.completeDoor(
                change.data.doorId,
                change.data.job_id,
                change.data.signature,
                change.data.signer_name,
                change.data.signer_title
              );
              break;
              
            case 'job_complete':
              await this.completeJob(
                change.data.jobId,
                change.data.signature,
                change.data.signer_name,
                change.data.signer_title
              );
              break;
              
            default:
              console.warn('Unknown pending change type:', change.type);
          }
          
          results.synced++;
        } catch (error) {
          console.error('Error syncing change:', error);
          results.errors.push({
            change: change,
            error: error.message
          });
          results.success = false;
        }
      }

      // Clear successfully synced changes
      if (results.synced > 0) {
        const remainingChanges = pendingChanges.slice(results.synced);
        localStorage.setItem(pendingKey, JSON.stringify(remainingChanges));
        console.log(`Successfully synced ${results.synced} changes`);
      }

      return results;
    } catch (error) {
      console.error('Error syncing pending changes:', error);
      return { success: false, synced: 0, errors: [error.message] };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Convert Blob to data URL
   * @param {Blob} blob - Blob object
   * @returns {Promise<string>} - Data URL
   */
  blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Format date for API calls
   * @param {Date} date - Date object
   * @returns {string} - Formatted date string (YYYY-MM-DD)
   */
  formatDateForAPI(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get date range for calendar view
   * @param {Date} date - Base date
   * @param {string} view - View type ('month' or 'week')
   * @returns {Object} - Start and end dates
   */
  getCalendarDateRange(date, view = 'month') {
    let startDate, endDate;
    
    if (view === 'month') {
      // Start of month, going back to Sunday
      startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      
      // End of month, going forward to Saturday
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    } else {
      // Week view - Sunday to Saturday
      startDate = new Date(date);
      startDate.setDate(date.getDate() - date.getDay());
      
      endDate = new Date(date);
      endDate.setDate(date.getDate() + (6 - date.getDay()));
    }
    
    return {
      startDate: this.formatDateForAPI(startDate),
      endDate: this.formatDateForAPI(endDate)
    };
  }

  /**
   * Clear cached data for a specific job
   * @param {number} jobId - Job ID
   */
  clearJobCache(jobId) {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.includes(`/mobile/jobs/${jobId}`) || key.includes(`/jobs`)) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Clear all cached data
   */
  clearAllCache() {
    this.cache.clear();
    console.log('All cache cleared');
  }

  /**
   * Set up offline/online event listeners
   * @param {Function} onOnline - Callback when coming online
   * @param {Function} onOffline - Callback when going offline
   */
  setupOfflineHandlers(onOnline = null, onOffline = null) {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('Browser is back online');
      if (onOnline) onOnline();
      
      // Auto-sync pending changes when back online
      this.syncPendingChanges().then(results => {
        if (results.synced > 0) {
          console.log(`Synced ${results.synced} pending changes`);
        }
        if (results.errors.length > 0) {
          console.error('Sync errors:', results.errors);
        }
      });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('Browser is offline');
      if (onOffline) onOffline();
    });
  }

  /**
   * Validate job selection for mobile worker
   * @param {Object} job - Job object
   * @returns {Object} - Validation result
   */
  validateJobSelection(job) {
    const errors = [];
    const warnings = [];
    
    // Check if job is scheduled for today or in progress
    const today = new Date().toISOString().split('T')[0];
    const jobDate = job.scheduled_date;
    
    if (jobDate && jobDate !== today && job.status !== 'in_progress') {
      warnings.push('This job is not scheduled for today');
    }
    
    // Check job status
    if (job.status === 'completed') {
      errors.push('This job has already been completed');
    }
    
    if (job.status === 'cancelled') {
      errors.push('This job has been cancelled');
    }
    
    // Check if job can be started
    if (job.mobile_status === 'completed') {
      errors.push('This job is already complete');
    }
    
    return {
      canSelect: errors.length === 0,
      canStart: errors.length === 0 && job.mobile_status === 'not_started',
      canContinue: errors.length === 0 && job.mobile_status === 'started',
      errors,
      warnings
    };
  }

  /**
   * Validate required job completion data
   * @param {Object} jobData - Job data object
   * @returns {Object} - Validation result
   */
  validateJobCompletion(jobData) {
    const errors = [];
    const warnings = [];

    // Check if job is started
    if (!jobData.has_start_signature) {
      errors.push('Job must be started before completion');
    }

    // Check each door completion
    jobData.doors.forEach(door => {
      const doorErrors = [];
      
      // Check line items
      const incompleteItems = door.line_items.filter(item => !item.completed);
      if (incompleteItems.length > 0) {
        doorErrors.push(`${incompleteItems.length} incomplete work items`);
      }

      // Check media
      if (!door.has_photo) {
        doorErrors.push('Missing completion photo');
      }
      if (!door.has_video) {
        doorErrors.push('Missing operation video');
      }

      // Check signature
      if (!door.has_signature) {
        doorErrors.push('Missing completion signature');
      }

      if (doorErrors.length > 0) {
        errors.push(`Door #${door.door_number}: ${doorErrors.join(', ')}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get connection status
   * @returns {boolean} - Online status
   */
  getConnectionStatus() {
    return this.isOnline;
  }

  /**
   * Get pending changes count
   * @returns {number} - Number of pending changes
   */
  getPendingChangesCount() {
    try {
      const pendingChanges = JSON.parse(localStorage.getItem('pending_changes') || '[]');
      return pendingChanges.length;
    } catch (error) {
      console.error('Error getting pending changes count:', error);
      return 0;
    }
  }

  /**
   * Clear all offline data
   */
  clearOfflineData() {
    try {
      // Clear pending changes
      localStorage.removeItem('pending_changes');
      
      // Clear cached jobs
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('offline_job_') || 
            key.startsWith('offline_calendar_') || 
            key.startsWith('offline_photo_')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('All offline data cleared');
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }
}

// Create and export singleton instance
const mobileWorkerService = new MobileWorkerService();

export default mobileWorkerService;