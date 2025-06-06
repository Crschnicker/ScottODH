import api from './api'; // Adjust path if your api.js is elsewhere

class MobileWorkerService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.setupOfflineDetection();
    console.log(`MobileWorkerService initialized, will use shared axios instance.`);
  }

  setupOfflineDetection() {
    const handleOnline = () => {
      if (!this.isOnline) {
        this.isOnline = true;
        console.log('MobileWorkerService: Connection restored - syncing pending changes');
        this.syncPendingChanges().then(() => {
            window.dispatchEvent(new CustomEvent('connectionRestored'));
        });
      }
    };

    const handleOffline = () => {
      if (this.isOnline) {
        this.isOnline = false;
        console.log('MobileWorkerService: Connection lost - enabling offline mode');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    this.isOnline = navigator.onLine;
  }

  async apiRequest(method, endpoint, data = null, params = null, extraAxiosConfig = {}) {
    console.log(`MobileWorkerService (axios): Making API request: ${method.toUpperCase()} ${endpoint}`);

    if (!this.isOnline && method.toUpperCase() !== 'GET') {
      // For non-GET requests when offline, the specific methods (startJob, etc.)
      // already handle storing pending changes.
      // This check here is more of a safeguard.
      console.warn(`MobileWorkerService: Attempting non-GET request (${method} ${endpoint}) while offline. Queuing should handle this.`);
      // The actual queuing is handled by individual methods like startJob, completeJob etc.
      // This generic apiRequest will primarily be used when online for those methods.
      // If a method doesn't explicitly handle offline, it will throw here.
       throw new Error('No internet connection available for this operation (non-GET offline).');
    }

    try {
      const config = {
        method: method.toLowerCase(),
        url: endpoint,
        ...extraAxiosConfig
      };

      if (data) {
        config.data = data;
      }
      if (params) {
        config.params = params;
      }

      const response = await api(config); // Use the shared axios instance
      return response.data;
    } catch (error) {
      console.error(`MobileWorkerService (axios): API request for ${method.toUpperCase()} ${endpoint} failed:`, error.message);
      
      if (error.response) {
        const { status, data: errorData } = error.response;
        let errorMessage = `Server error ${status}`;
        if (errorData && (errorData.error || errorData.message)) {
            errorMessage += `: ${errorData.error || errorData.message}`;
        } else if (typeof errorData === 'string' && errorData.length > 0 && errorData.length < 100) {
            errorMessage += `: ${errorData}`;
        }
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your network connection.');
      } else {
        throw new Error(`Request setup error: ${error.message}`);
      }
    }
  }

  dataURLToBlob(dataURL) {
    try {
      const arr = dataURL.split(',');
      if (arr.length < 2) throw new Error('Invalid Data URL format');
      const mimeMatch = arr[0].match(/:(.*?);/);
      if (!mimeMatch || !mimeMatch[1]) throw new Error('Could not extract MIME type from Data URL');
      const mime = mimeMatch[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (error) {
      console.error('Error converting data URL to blob:', error);
      throw new Error(`Invalid data URL format: ${error.message}`);
    }
  }

  async getJob(jobId) {
    const endpoint = `/mobile/jobs/${jobId}`;
    try {
      // When online, always fetch. Axios interceptors in api.js might handle caching if configured.
      // If offline, try localStorage.
      if (!this.isOnline) {
          const offlineData = this.getCachedJobFromLocalStorage(jobId);
          if (offlineData) {
            console.log('MobileWorkerService: Using offline localStorage cached job data for getJob.');
            return offlineData;
          }
          // If offline and no cache, let it try to fetch and fail (which apiRequest will handle)
      }
      const data = await this.apiRequest('GET', endpoint);
      return data;
    } catch (error) {
      console.error(`MobileWorkerService: Error fetching job ${jobId}:`, error.message);
      // If it's a network error and we're offline, re-check cache as a last resort.
      if (!this.isOnline && (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('no internet connection'))) {
        const offlineData = this.getCachedJobFromLocalStorage(jobId);
        if (offlineData) {
          console.log('MobileWorkerService: Using offline localStorage cached job data after fetch failed.');
          return offlineData;
        }
      }
      throw error;
    }
  }

  async startJob(jobId, signatureData, signerName = '', signerTitle = 'Site Contact') {
    const requestPayload = {
      signature: signatureData,
      signer_name: signerName,
      signer_title: signerTitle
    };
    const endpoint = `/mobile/jobs/${jobId}/start`;

    if (!this.isOnline) {
      this.storePendingChange('job_start', { jobId, ...requestPayload });
      return { success: true, offline: true, message: 'Job start queued for offline sync.', job_id: jobId };
    }

    try {
      const data = await this.apiRequest('POST', endpoint, requestPayload);
      return data;
    } catch (error) {
      console.error(`MobileWorkerService: Error starting job ${jobId}:`, error.message);
      // If error during online attempt, do not automatically queue for offline
      // unless it's explicitly a network-type error.
      // The component should handle other types of server errors.
      if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('no internet connection')) {
         this.storePendingChange('job_start', { jobId, ...requestPayload });
         return { success: true, offline: true, message: 'Job start queued due to network error.', job_id: jobId };
      }
      throw error;
    }
  }

  // NEW METHOD: Pause Job
  async pauseJob(jobId) {
    const endpoint = `/mobile/jobs/${jobId}/pause`;

    if (!this.isOnline) {
      this.storePendingChange('job_pause', { jobId });
      return { success: true, offline: true, message: 'Job pause queued for offline sync.', job_id: jobId };
    }

    try {
      const data = await this.apiRequest('POST', endpoint);
      return data;
    } catch (error) {
      console.error(`MobileWorkerService: Error pausing job ${jobId}:`, error.message);
      if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('no internet connection')) {
        this.storePendingChange('job_pause', { jobId });
        return { success: true, offline: true, message: 'Job pause queued due to network error.', job_id: jobId };
      }
      throw error;
    }
  }

  // NEW METHOD: Resume Job
  async resumeJob(jobId) {
    const endpoint = `/mobile/jobs/${jobId}/resume`;

    if (!this.isOnline) {
      this.storePendingChange('job_resume', { jobId });
      return { success: true, offline: true, message: 'Job resume queued for offline sync.', job_id: jobId };
    }

    try {
      const data = await this.apiRequest('POST', endpoint);
      return data;
    } catch (error) {
      console.error(`MobileWorkerService: Error resuming job ${jobId}:`, error.message);
      if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('no internet connection')) {
        this.storePendingChange('job_resume', { jobId });
        return { success: true, offline: true, message: 'Job resume queued due to network error.', job_id: jobId };
      }
      throw error;
    }
  }

  // NEW METHOD: Get Time Tracking Data
  async getTimeTracking(jobId) {
    const endpoint = `/mobile/jobs/${jobId}/time-tracking`;
    
    try {
      // Time tracking data should always be fresh, so try to fetch even if offline
      if (!this.isOnline) {
        throw new Error('Time tracking data requires an active internet connection.');
      }
      
      const data = await this.apiRequest('GET', endpoint);
      return data;
    } catch (error) {
      console.error(`MobileWorkerService: Error fetching time tracking for job ${jobId}:`, error.message);
      throw error;
    }
  }

  async completeJob(jobId, signatureData, signerName = '', signerTitle = 'Site Contact') {
    const requestPayload = {
      signature: signatureData,
      signer_name: signerName,
      signer_title: signerTitle
    };
    const endpoint = `/mobile/jobs/${jobId}/complete`;

    if (!this.isOnline) {
      this.storePendingChange('job_complete', { jobId, ...requestPayload });
      return { success: true, offline: true, message: 'Job completion queued for offline sync.', job_id: jobId };
    }
    try {
      const data = await this.apiRequest('POST', endpoint, requestPayload);
      return data;
    } catch (error) {
      console.error(`MobileWorkerService: Error completing job ${jobId}:`, error.message);
      if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('no internet connection')) {
        this.storePendingChange('job_complete', { jobId, ...requestPayload });
        return { success: true, offline: true, message: 'Job completion queued due to network error.', job_id: jobId };
      }
      throw error;
    }
  }

  async toggleLineItem(jobId, lineItemId) {
    const endpoint = `/mobile/jobs/${jobId}/line-items/${lineItemId}/toggle`;
    if (!this.isOnline) {
      this.storePendingChange('line_item_toggle', { jobId, lineItemId });
      return { success: true, offline: true, message: 'Line item toggle queued for offline sync.', line_item_id: lineItemId };
    }
    try {
      const data = await this.apiRequest('PUT', endpoint);
      return data;
    } catch (error) {
      console.error(`MobileWorkerService: Error toggling line item ${lineItemId} for job ${jobId}:`, error.message);
       if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('no internet connection')) {
        this.storePendingChange('line_item_toggle', { jobId, lineItemId });
        return { success: true, offline: true, message: 'Line item toggle queued due to network error.', line_item_id: lineItemId };
      }
      throw error;
    }
  }

  async uploadDoorPhoto(doorId, jobId, photoData) {
    const endpoint = `/mobile/doors/${doorId}/media/upload`;
    const formData = new FormData();
    formData.append('job_id', jobId.toString());
    formData.append('door_id', doorId.toString());
    formData.append('media_type', 'photo');

    let blobToUpload;
    if (typeof photoData === 'string' && photoData.startsWith('data:')) {
      blobToUpload = this.dataURLToBlob(photoData);
    } else if (photoData instanceof Blob) {
      blobToUpload = photoData;
    } else {
      throw new Error('Invalid photo data format provided for upload.');
    }
    formData.append('file', blobToUpload, `door_${doorId}_photo.jpg`);

    if (!this.isOnline) {
      const dataURLForStorage = (blobToUpload === photoData) ? await this.blobToDataURL(blobToUpload) : photoData;
      const storageKey = `offline_media_photo_${doorId}_${jobId}_${Date.now()}`;
      localStorage.setItem(storageKey, dataURLForStorage);
      this.storePendingChange('door_photo', { doorId, jobId, storageKey, fileName: `door_${doorId}_photo.jpg` });
      return { success: true, offline: true, message: 'Photo upload queued for offline sync.', door_id: doorId };
    }

    try {
      const data = await this.apiRequest('POST', endpoint, formData, null, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    } catch (error) {
      console.error(`MobileWorkerService: Error uploading photo for door ${doorId}:`, error.message);
      if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('no internet connection')) {
        const dataURLForStorage = (blobToUpload === photoData) ? await this.blobToDataURL(blobToUpload) : photoData;
        const storageKey = `offline_media_photo_${doorId}_${jobId}_${Date.now()}`;
        localStorage.setItem(storageKey, dataURLForStorage); // Store it if network error during online attempt
        this.storePendingChange('door_photo', { doorId, jobId, storageKey, fileName: `door_${doorId}_photo.jpg` });
        return { success: true, offline: true, message: 'Photo upload queued due to network error.', door_id: doorId };
      }
      throw error;
    }
  }

  async uploadDoorVideo(doorId, jobId, videoBlob) {
    const endpoint = `/mobile/doors/${doorId}/media/upload`;
    if (!this.isOnline) {
      // As per original logic, video uploads are not queued offline.
      throw new Error('Video upload requires an active internet connection.');
    }

    const formData = new FormData();
    formData.append('job_id', jobId.toString());
    formData.append('door_id', doorId.toString());
    formData.append('media_type', 'video');
    formData.append('file', videoBlob, `door_${doorId}_video.webm`);

    try {
      const data = await this.apiRequest('POST', endpoint, formData, null, {
         headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    } catch (error) {
      console.error(`MobileWorkerService: Error uploading video for door ${doorId}:`, error.message);
      throw error;
    }
  }

  async completeDoor(doorId, jobId, signatureData, signerName = '', signerTitle = 'Site Contact') {
    const requestPayload = {
      job_id: jobId,
      signature: signatureData,
      signer_name: signerName,
      signer_title: signerTitle
    };
    const endpoint = `/mobile/doors/${doorId}/complete`;

    if (!this.isOnline) {
      this.storePendingChange('door_complete', { doorId, jobId, ...requestPayload });
      return { success: true, offline: true, message: 'Door completion queued for offline sync.', door_id: doorId };
    }
    try {
      const data = await this.apiRequest('POST', endpoint, requestPayload);
      return data;
    } catch (error) {
      console.error(`MobileWorkerService: Error completing door ${doorId}:`, error.message);
      if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('no internet connection')) {
        this.storePendingChange('door_complete', { doorId, jobId, ...requestPayload });
        return { success: true, offline: true, message: 'Door completion queued due to network error.', door_id: doorId };
      }
      throw error;
    }
  }

  async cacheFetchedJobDataForOffline(jobDataToCache) {
    if (!jobDataToCache || !jobDataToCache.id) {
      console.error('MobileWorkerService: Error caching job to localStorage: Invalid jobData provided.');
      return;
    }
    try {
      const offlineKey = `offline_job_${jobDataToCache.id}`;
      localStorage.setItem(offlineKey, JSON.stringify({
        data: jobDataToCache,
        timestamp: Date.now(),
        version: '1.2' // Increment version if structure changes
      }));
      console.log(`MobileWorkerService: Job ${jobDataToCache.id} cached to localStorage.`);
    } catch (error) {
      console.error('MobileWorkerService: Error caching job to localStorage:', error);
    }
  }
  
  getCachedJobFromLocalStorage(jobId) {
    try {
      const offlineKey = `offline_job_${jobId}`;
      const cached = localStorage.getItem(offlineKey);
      if (!cached) return null;
      
      const { data, timestamp, version } = JSON.parse(cached);
      // Simple version check, could be more complex
      if (version !== '1.2') {
          console.warn(`MobileWorkerService: localStorage cache for job ${jobId} has outdated version. Discarding.`);
          localStorage.removeItem(offlineKey);
          return null;
      }
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days for offline data
      if (Date.now() - timestamp > maxAge) {
        localStorage.removeItem(offlineKey);
        console.log(`MobileWorkerService: localStorage cache for job ${jobId} expired.`);
        return null;
      }
      console.log(`MobileWorkerService: Returning job ${jobId} from localStorage.`);
      return data;
    } catch (error) {
      console.error(`MobileWorkerService: Error getting cached job ${jobId} from localStorage:`, error);
      localStorage.removeItem(`offline_job_${jobId}`);
      return null;
    }
  }

  storePendingChange(type, data) {
    try {
      const pendingKey = 'pending_changes';
      let pendingChanges = JSON.parse(localStorage.getItem(pendingKey) || '[]');
      pendingChanges.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        payload: data,
        timestamp: new Date().toISOString(),
        attemptCount: 0
      });
      localStorage.setItem(pendingKey, JSON.stringify(pendingChanges));
      console.log(`MobileWorkerService: Stored pending change: ${type}`, data);
      window.dispatchEvent(new CustomEvent('pendingChangesUpdated'));
    } catch (error) {
      console.error('MobileWorkerService: Error storing pending change:', error);
    }
  }

  async syncPendingChanges() {
    if (!this.isOnline) {
      console.log("MobileWorkerService: Sync skipped, offline.");
      return { success: true, synced: 0, errors: [], message: "Offline, sync skipped." };
    }

    const pendingKey = 'pending_changes';
    let pendingChanges;
    try {
      pendingChanges = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    } catch (e) {
      console.error("MobileWorkerService: Error parsing pending changes from localStorage.", e);
      localStorage.removeItem(pendingKey);
      return { success: false, synced: 0, errors: [{ type: 'parsing', message: e.message }] };
    }
    
    if (pendingChanges.length === 0) {
      window.dispatchEvent(new CustomEvent('pendingChangesUpdated')); // Ensure UI updates if queue becomes empty
      return { success: true, synced: 0, errors: [], message: "No pending changes to sync." };
    }

    console.log(`MobileWorkerService: Syncing ${pendingChanges.length} pending changes`);
    const results = { success: true, synced: 0, errors: [] };
    const remainingChanges = [];

    for (const change of pendingChanges) {
      try {
        console.log(`MobileWorkerService: Syncing ${change.type}:`, change.payload);
        change.attemptCount = (change.attemptCount || 0) + 1;
        let syncSuccessful = false;

        switch (change.type) {
          case 'job_start':
            await this.startJob(change.payload.jobId, change.payload.signature, change.payload.signer_name, change.payload.signer_title);
            syncSuccessful = true;
            break;
          case 'job_pause':
            await this.pauseJob(change.payload.jobId);
            syncSuccessful = true;
            break;
          case 'job_resume':
            await this.resumeJob(change.payload.jobId);
            syncSuccessful = true;
            break;
          case 'line_item_toggle':
            await this.toggleLineItem(change.payload.jobId, change.payload.lineItemId);
            syncSuccessful = true;
            break;
          case 'door_photo':
            const photoDataURL = localStorage.getItem(change.payload.storageKey);
            if (photoDataURL) {
              const photoBlob = this.dataURLToBlob(photoDataURL);
              await this.uploadDoorPhoto(change.payload.doorId, change.payload.jobId, photoBlob);
              localStorage.removeItem(change.payload.storageKey);
              syncSuccessful = true;
            } else {
              throw new Error(`Offline photo data not found for key ${change.payload.storageKey}`);
            }
            break;
          case 'door_complete':
            await this.completeDoor(change.payload.doorId, change.payload.jobId, change.payload.signature, change.payload.signer_name, change.payload.signer_title);
            syncSuccessful = true;
            break;
          case 'job_complete':
            await this.completeJob(change.payload.jobId, change.payload.signature, change.payload.signer_name, change.payload.signer_title);
            syncSuccessful = true;
            break;
          default:
            console.warn('MobileWorkerService: Unknown pending change type during sync:', change.type);
            results.errors.push({ changeId: change.id, type: change.type, error: 'Unknown change type' });
            remainingChanges.push(change);
        }
        if (syncSuccessful) {
            results.synced++;
        }
      } catch (error) {
        console.error(`MobileWorkerService: Error syncing change ${change.id} (type ${change.type}):`, error.message);
        results.errors.push({ changeId: change.id, type: change.type, attempt: change.attemptCount, error: error.message });
        if (change.attemptCount < 5 && !(error.message.includes('400') || error.message.includes('403') || error.message.includes('404'))) { // Don't retry client/auth errors
            remainingChanges.push(change);
        } else {
            console.error(`MobileWorkerService: Change ${change.id} (type ${change.type}) failed after ${change.attemptCount} attempts or due to unrecoverable error. Discarding. Error: ${error.message}`);
        }
        results.success = false;
      }
    }

    localStorage.setItem(pendingKey, JSON.stringify(remainingChanges));
    console.log(`MobileWorkerService: Sync complete. ${results.synced} changes synced. ${remainingChanges.length} remaining. ${results.errors.length} errors.`);
    window.dispatchEvent(new CustomEvent('pendingChangesUpdated'));
    return results;
  }

  blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(new Error(`FileReader error: ${error.message || error}`));
      reader.readAsDataURL(blob);
    });
  }
  
  getConnectionStatus() {
    return this.isOnline;
  }

  getPendingChangesCount() {
    try {
      const pendingChanges = JSON.parse(localStorage.getItem('pending_changes') || '[]');
      return pendingChanges.length;
    } catch (error) {
      console.error('MobileWorkerService: Error getting pending changes count:', error);
      return 0;
    }
  }

  // NEW METHOD: Cache job for offline (public interface)
  async cacheJobForOffline(jobData) {
    await this.cacheFetchedJobDataForOffline(jobData);
  }

  // NEW METHOD: Get cached job (public interface) 
  getCachedJob() {
    // For backwards compatibility, we need to determine the job ID
    // This method is used in the component but we don't know the job ID
    // We'll return null and let the component handle it
    console.warn('getCachedJob called without job ID - use getCachedJobFromLocalStorage with specific job ID instead');
    return null;
  }

  // NEW METHOD: Setup offline handlers (public interface)
  setupOfflineHandlers() {
    // This is already done in constructor via setupOfflineDetection
    console.log('Offline handlers already set up during initialization');
  }

  // NEW METHOD: Sync pending changes (public interface)
  // Already exists, but making sure it's properly exposed

  // NEW METHOD: Store pending change (public interface) 
  // Already exists, but making sure it's properly exposed
}

const mobileWorkerServiceInstance = new MobileWorkerService();
export default mobileWorkerServiceInstance;