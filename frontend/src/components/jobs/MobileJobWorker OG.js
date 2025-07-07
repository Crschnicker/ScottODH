import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Play,
  CheckCircle,
  Clock,
  MapPin,
  User,
  Phone,
  Camera,
  Video,
  FileText,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  CheckSquare,
  Square,
  AlertTriangle,
  PenTool,
  Save,
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader,
  Pause,
} from "lucide-react";
import "./MobileJobWorker.css"; // Import the CSS file

// Complete Dynamic Mobile API service with all required methods
const createMobileWorkerService = () => {
  // Dynamic API base URL detection based on current environment
  const getApiBaseUrl = () => {
    const currentUrl = window.location.href;
    const currentHost = window.location.host;
    const currentProtocol = window.location.protocol;

    console.log("Current environment detection:", {
      url: currentUrl,
      host: currentHost,
      protocol: currentProtocol,
    });

    // If we're on ngrok (contains ngrok.io or ngrok.app in hostname)
    if (currentHost.includes("ngrok.io") || currentHost.includes("ngrok.app")) {
      // Use the same ngrok host but target the API endpoint
      const apiUrl = `${currentProtocol}//${currentHost}/api`;
      console.log("Detected ngrok environment, using API URL:", apiUrl);
      return apiUrl;
    }

    // If we're on localhost but on a different port (like 3000), assume Flask is on 5000
    if (
      currentHost.includes("localhost") ||
      currentHost.includes("127.0.0.1")
    ) {
      const apiUrl = "http://localhost:5000/api";
      console.log(
        "Detected local development environment, using API URL:",
        apiUrl
      );
      return apiUrl;
    }

    // For production or other environments, use relative URLs
    const apiUrl = "/api";
    console.log("Using relative API URL for production:", apiUrl);
    return apiUrl;
  };

  const API_BASE_URL = getApiBaseUrl();

  // Enhanced API request function with better error handling and debugging
  const apiRequest = async (url, options = {}) => {
    const fullUrl = `${API_BASE_URL}${url}`;

    const defaultOptions = {
      credentials: "include", // Include cookies for authentication
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    };

    // Merge options
    const requestOptions = {
      ...defaultOptions,
      ...options,
    };

    console.log("Making API request:", {
      url: fullUrl,
      method: requestOptions.method || "GET",
      headers: requestOptions.headers,
      hasBody: !!requestOptions.body,
    });

    try {
      const response = await fetch(fullUrl, requestOptions);

      console.log("API response received:", {
        url: fullUrl,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      // Handle different response types
      if (!response.ok) {
        let errorData;
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          try {
            errorData = await response.json();
          } catch (parseError) {
            console.error(
              "Failed to parse error response as JSON:",
              parseError
            );
            errorData = {
              error: `HTTP ${response.status}: ${response.statusText}`,
              details: "Unable to parse error response",
            };
          }
        } else {
          // Try to get text response for non-JSON errors
          try {
            const textResponse = await response.text();
            errorData = {
              error: `HTTP ${response.status}: ${response.statusText}`,
              details: textResponse || "No additional error details",
            };
          } catch (textError) {
            errorData = {
              error: `HTTP ${response.status}: ${response.statusText}`,
              details: "Unable to read error response",
            };
          }
        }

        console.error("API request failed:", errorData);
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      // Parse successful response
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        console.log("API request successful:", {
          url: fullUrl,
          dataKeys: Object.keys(data),
        });
        return data;
      } else {
        console.log("API request successful (non-JSON response):", {
          url: fullUrl,
        });
        return response;
      }
    } catch (fetchError) {
      console.error("Network error during API request:", {
        url: fullUrl,
        error: fetchError.message,
        type: fetchError.name,
        stack: fetchError.stack,
      });

      // Provide more specific error messages based on error type
      if (
        fetchError.name === "TypeError" &&
        fetchError.message.includes("Failed to fetch")
      ) {
        throw new Error(
          `Network error: Unable to connect to ${fullUrl}. Please check your connection and ensure the server is running.`
        );
      } else if (fetchError.name === "AbortError") {
        throw new Error("Request was cancelled or timed out");
      } else if (fetchError.message.includes("CORS")) {
        throw new Error(
          "CORS error: The server is not configured to accept requests from this origin"
        );
      } else {
        throw new Error(`Network error: ${fetchError.message}`);
      }
    }
  };

  return {
    // Get current API configuration for debugging
    getApiConfig: () => {
      return {
        baseUrl: API_BASE_URL,
        currentHost: window.location.host,
        currentProtocol: window.location.protocol,
        isNgrok: window.location.host.includes("ngrok"),
        isLocalhost:
          window.location.host.includes("localhost") ||
          window.location.host.includes("127.0.0.1"),
      };
    },

    // Get job data from the Flask API with enhanced error handling
    getJob: async (jobId) => {
      if (!jobId || isNaN(jobId) || jobId <= 0) {
        throw new Error("Invalid job ID provided");
      }

      try {
        console.log(`Loading job data for job ID: ${jobId}`);
        const jobData = await apiRequest(`/mobile/jobs/${jobId}`);

        // Validate response structure
        if (!jobData || typeof jobData !== "object") {
          throw new Error("Invalid job data received from server");
        }

        // Check for required fields
        const requiredFields = ["id", "job_number", "customer_name"];
        const missingFields = requiredFields.filter(
          (field) => !jobData.hasOwnProperty(field)
        );

        if (missingFields.length > 0) {
          console.warn("Job data missing required fields:", missingFields);
        }

        console.log("Loaded job data from API:", {
          jobId: jobData.id,
          jobNumber: jobData.job_number,
          customer: jobData.customer_name,
          doorsCount: jobData.doors?.length || 0,
          status: jobData.mobile_status,
        });

        return jobData;
      } catch (error) {
        console.error("Error loading job from API:", error);

        // Add context to the error
        const enhancedError = new Error(
          `Failed to load job ${jobId}: ${error.message}`
        );
        enhancedError.originalError = error;
        enhancedError.jobId = jobId;
        enhancedError.apiConfig = this.getApiConfig();

        throw enhancedError;
      }
    },

    // Start a job with enhanced error handling and logging
    startJob: async (jobId, signature, contactName, title) => {
      if (!jobId || isNaN(jobId) || jobId <= 0) {
        throw new Error("Invalid job ID provided");
      }

      try {
        console.log(`Starting job ${jobId} with signature:`, {
          hasSignature: !!signature,
          contactName: contactName || "Not provided",
          title: title || "Not provided",
        });

        const response = await apiRequest(`/mobile/jobs/${jobId}/start`, {
          method: "POST",
          body: JSON.stringify({
            signature: signature || "",
            signer_name: contactName || "",
            signer_title: title || "",
          }),
        });

        console.log("Job started successfully via API:", response);
        return response;
      } catch (error) {
        console.error("Error starting job via API:", error);

        const enhancedError = new Error(
          `Failed to start job ${jobId}: ${error.message}`
        );
        enhancedError.originalError = error;
        enhancedError.jobId = jobId;
        enhancedError.action = "start_job";

        throw enhancedError;
      }
    },

    // Pause a job with enhanced error handling and logging  
    pauseJob: async (jobId, signature, contactName, title) => {
      if (!jobId || isNaN(jobId) || jobId <= 0) {
        throw new Error("Invalid job ID provided");
      }

      try {
        console.log(`Pausing job ${jobId} with signature:`, {
          hasSignature: !!signature,
          contactName: contactName || "Not provided",
          title: title || "Not provided",
        });

        const response = await apiRequest(`/mobile/jobs/${jobId}/pause`, {
          method: "POST",
          body: JSON.stringify({
            signature: signature || "",
            signer_name: contactName || "",
            signer_title: title || "",
          }),
        });

        console.log("Job paused successfully via API:", response);
        return response;
      } catch (error) {
        console.error("Error pausing job via API:", error);

        const enhancedError = new Error(
          `Failed to pause job ${jobId}: ${error.message}`
        );
        enhancedError.originalError = error;
        enhancedError.jobId = jobId;
        enhancedError.action = "pause_job";

        throw enhancedError;
      }
    },

    // Resume a job with enhanced error handling and logging
    resumeJob: async (jobId, signature, contactName, title) => {
      if (!jobId || isNaN(jobId) || jobId <= 0) {
        throw new Error("Invalid job ID provided");
      }

      try {
        console.log(`Resuming job ${jobId} with signature:`, {
          hasSignature: !!signature,
          contactName: contactName || "Not provided",
          title: title || "Not provided",
        });

        const response = await apiRequest(`/mobile/jobs/${jobId}/resume`, {
          method: "POST",
          body: JSON.stringify({
            signature: signature || "",
            signer_name: contactName || "",
            signer_title: title || "",
          }),
        });

        console.log("Job resumed successfully via API:", response);
        return response;
      } catch (error) {
        console.error("Error resuming job via API:", error);

        const enhancedError = new Error(
          `Failed to resume job ${jobId}: ${error.message}`
        );
        enhancedError.originalError = error;
        enhancedError.jobId = jobId;
        enhancedError.action = "resume_job";

        throw enhancedError;
      }
    },

    // Get time tracking data for a job with enhanced error handling
    getTimeTracking: async (jobId) => {
      if (!jobId || isNaN(jobId) || jobId <= 0) {
        throw new Error("Invalid job ID provided");
      }

      try {
        console.log(`Loading time tracking data for job ID: ${jobId}`);

        const timeTrackingData = await apiRequest(`/mobile/jobs/${jobId}/time-tracking`);

        // Validate response structure
        if (!timeTrackingData || typeof timeTrackingData !== "object") {
          throw new Error("Invalid time tracking data received from server");
        }

        console.log("Loaded time tracking data from API:", {
          jobId: jobId,
          totalMinutes: timeTrackingData.total_minutes || 0,
          hasActiveSession: timeTrackingData.has_active_session || false,
          jobTimingStatus: timeTrackingData.job_timing_status || 'not_started',
          sessionCount: timeTrackingData.session_count || 0,
        });

        return timeTrackingData;
      } catch (error) {
        console.error("Error loading time tracking data from API:", error);

        const enhancedError = new Error(
          `Failed to load time tracking for job ${jobId}: ${error.message}`
        );
        enhancedError.originalError = error;
        enhancedError.jobId = jobId;
        enhancedError.action = "get_time_tracking";

        throw enhancedError;
      }
    },

    // Complete a door with enhanced validation and error handling
    completeDoor: async (doorId, jobId, signature, contactName, title) => {
      if (!doorId || isNaN(doorId) || doorId <= 0) {
        throw new Error("Invalid door ID provided");
      }

      if (!jobId || isNaN(jobId) || jobId <= 0) {
        throw new Error("Invalid job ID provided");
      }

      try {
        console.log(`Completing door ${doorId} for job ${jobId}:`, {
          hasSignature: !!signature,
          contactName: contactName || "Not provided",
          title: title || "Not provided",
        });

        const response = await apiRequest(`/mobile/doors/${doorId}/complete`, {
          method: "POST",
          body: JSON.stringify({
            job_id: jobId,
            signature: signature || "",
            signer_name: contactName || "",
            signer_title: title || "",
          }),
        });

        console.log("Door completed successfully via API:", response);
        return response;
      } catch (error) {
        console.error("Error completing door via API:", error);

        const enhancedError = new Error(
          `Failed to complete door ${doorId}: ${error.message}`
        );
        enhancedError.originalError = error;
        enhancedError.doorId = doorId;
        enhancedError.jobId = jobId;
        enhancedError.action = "complete_door";

        throw enhancedError;
      }
    },

    // Complete entire job with enhanced validation and error handling
    completeJob: async (jobId, signature, contactName, title) => {
      if (!jobId || isNaN(jobId) || jobId <= 0) {
        throw new Error("Invalid job ID provided");
      }

      try {
        console.log(`Completing job ${jobId}:`, {
          hasSignature: !!signature,
          contactName: contactName || "Not provided",
          title: title || "Not provided",
        });

        const response = await apiRequest(`/mobile/jobs/${jobId}/complete`, {
          method: "POST",
          body: JSON.stringify({
            signature: signature || "",
            signer_name: contactName || "",
            signer_title: title || "",
          }),
        });

        console.log("Job completed successfully via API:", response);
        return response;
      } catch (error) {
        console.error("Error completing job via API:", error);

        const enhancedError = new Error(
          `Failed to complete job ${jobId}: ${error.message}`
        );
        enhancedError.originalError = error;
        enhancedError.jobId = jobId;
        enhancedError.action = "complete_job";

        throw enhancedError;
      }
    },

    // Upload door photo with enhanced validation and progress tracking
    uploadDoorPhoto: async (doorId, jobId, photoData) => {
      if (!doorId || isNaN(doorId) || doorId <= 0) {
        throw new Error("Invalid door ID provided");
      }

      if (!jobId || isNaN(jobId) || jobId <= 0) {
        throw new Error("Invalid job ID provided");
      }

      if (
        !photoData ||
        typeof photoData !== "string" ||
        !photoData.startsWith("data:image/")
      ) {
        throw new Error("Invalid photo data provided");
      }

      try {
        console.log(`Uploading photo for door ${doorId} in job ${jobId}`);

        // Convert base64 data to blob
        const base64Response = await fetch(photoData);
        const blob = await base64Response.blob();

        console.log("Photo blob created:", {
          size: blob.size,
          type: blob.type,
          sizeKB: Math.round(blob.size / 1024),
        });

        // Create form data for file upload
        const formData = new FormData();
        formData.append("file", blob, `door_${doorId}_photo.jpg`);
        formData.append("job_id", jobId.toString());
        formData.append("media_type", "photo");

        const response = await fetch(
          `${API_BASE_URL}/mobile/doors/${doorId}/media/upload`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: `Upload failed: HTTP ${response.status}`,
          }));
          throw new Error(
            errorData.error || `Upload failed: ${response.statusText}`
          );
        }

        const result = await response.json();
        console.log("Photo uploaded successfully via API:", result);
        return result;
      } catch (error) {
        console.error("Error uploading photo via API:", error);

        const enhancedError = new Error(
          `Failed to upload photo for door ${doorId}: ${error.message}`
        );
        enhancedError.originalError = error;
        enhancedError.doorId = doorId;
        enhancedError.jobId = jobId;
        enhancedError.action = "upload_photo";

        throw enhancedError;
      }
    },

    // Upload door video with enhanced validation and progress tracking
    uploadDoorVideo: async (doorId, jobId, videoData) => {
      if (!doorId || isNaN(doorId) || doorId <= 0) {
        throw new Error("Invalid door ID provided");
      }

      if (!jobId || isNaN(jobId) || jobId <= 0) {
        throw new Error("Invalid job ID provided");
      }

      if (!videoData || !(videoData instanceof Blob)) {
        throw new Error("Invalid video data provided - expected Blob object");
      }

      try {
        console.log(`Uploading video for door ${doorId} in job ${jobId}:`, {
          size: videoData.size,
          type: videoData.type,
          sizeMB: Math.round((videoData.size / (1024 * 1024)) * 100) / 100,
        });

        // Create form data for file upload
        const formData = new FormData();
        formData.append("file", videoData, `door_${doorId}_video.webm`);
        formData.append("job_id", jobId.toString());
        formData.append("media_type", "video");

        const response = await fetch(
          `${API_BASE_URL}/mobile/doors/${doorId}/media/upload`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: `Upload failed: HTTP ${response.status}`,
          }));
          throw new Error(
            errorData.error || `Upload failed: ${response.statusText}`
          );
        }

        const result = await response.json();
        console.log("Video uploaded successfully via API:", result);
        return result;
      } catch (error) {
        console.error("Error uploading video via API:", error);

        const enhancedError = new Error(
          `Failed to upload video for door ${doorId}: ${error.message}`
        );
        enhancedError.originalError = error;
        enhancedError.doorId = doorId;
        enhancedError.jobId = jobId;
        enhancedError.action = "upload_video";

        throw enhancedError;
      }
    },

    // Toggle line item completion with enhanced validation
    toggleLineItem: async (jobId, lineItemId) => {
      if (!jobId || isNaN(jobId) || jobId <= 0) {
        throw new Error("Invalid job ID provided");
      }

      if (!lineItemId || isNaN(lineItemId) || lineItemId <= 0) {
        throw new Error("Invalid line item ID provided");
      }

      try {
        console.log(`Toggling line item ${lineItemId} for job ${jobId}`);

        const response = await apiRequest(
          `/mobile/jobs/${jobId}/line-items/${lineItemId}/toggle`,
          {
            method: "PUT",
          }
        );

        console.log("Line item toggled successfully via API:", response);
        return response;
      } catch (error) {
        console.error("Error toggling line item via API:", error);

        const enhancedError = new Error(
          `Failed to toggle line item ${lineItemId}: ${error.message}`
        );
        enhancedError.originalError = error;
        enhancedError.jobId = jobId;
        enhancedError.lineItemId = lineItemId;
        enhancedError.action = "toggle_line_item";

        throw enhancedError;
      }
    },

    // Test API connectivity
    testConnection: async () => {
      try {
        console.log("Testing API connectivity...");
        const response = await apiRequest("/mobile/test");
        console.log("API connectivity test successful:", response);
        return { success: true, data: response };
      } catch (error) {
        console.error("API connectivity test failed:", error);
        return {
          success: false,
          error: error.message,
          config: this.getApiConfig(),
        };
      }
    },

    // Cache and offline functionality with better logging
    getCachedJob: () => {
      try {
        const cached = localStorage.getItem("cached_job_data");
        const data = cached ? JSON.parse(cached) : null;
        console.log(
          "Retrieved cached job data:",
          data ? `Job ${data.id}` : "No cached data"
        );
        return data;
      } catch (error) {
        console.error("Error retrieving cached job:", error);
        return null;
      }
    },

    cacheJobForOffline: async (data) => {
      try {
        localStorage.setItem("cached_job_data", JSON.stringify(data));
        console.log("Cached job data for offline use:", `Job ${data.id}`);
        return Promise.resolve();
      } catch (error) {
        console.error("Error caching job data:", error);
        throw error;
      }
    },

    setupOfflineHandlers: () => {
      console.log(
        "Setting up offline handlers for environment:",
        this.getApiConfig()
      );

      window.addEventListener("online", () => {
        console.log("App is online - syncing pending changes");
      });

      window.addEventListener("offline", () => {
        console.log("App is offline - queuing changes locally");
      });
    },

    syncPendingChanges: async () => {
      try {
        const pending = JSON.parse(
          localStorage.getItem("pending_changes") || "[]"
        );
        console.log(`Syncing ${pending.length} pending changes`);

        let syncedCount = 0;
        for (const change of pending) {
          try {
            console.log("Syncing change:", change.action);
            syncedCount++;
          } catch (syncError) {
            console.error("Failed to sync change:", change, syncError);
          }
        }

        if (syncedCount > 0) {
          localStorage.removeItem("pending_changes");
        }

        return Promise.resolve({ synced: syncedCount });
      } catch (error) {
        console.error("Error syncing changes:", error);
        throw error;
      }
    },

    storePendingChange: (change) => {
      try {
        const pending = JSON.parse(
          localStorage.getItem("pending_changes") || "[]"
        );
        const changeWithId = {
          id: Date.now() + Math.random(),
          ...change,
          timestamp: new Date().toISOString(),
          status: "pending",
          apiConfig: this.getApiConfig(),
        };
        pending.push(changeWithId);
        localStorage.setItem("pending_changes", JSON.stringify(pending));
        console.log("Stored pending change:", changeWithId);
        return changeWithId;
      } catch (error) {
        console.error("Error storing pending change:", error);
        throw error;
      }
    },

    // Additional utility methods
    getPendingChangesCount: () => {
      try {
        const pending = JSON.parse(
          localStorage.getItem("pending_changes") || "[]"
        );
        return pending.length;
      } catch (error) {
        console.error("Error getting pending changes count:", error);
        return 0;
      }
    },

    clearCache: () => {
      try {
        localStorage.removeItem("cached_job_data");
        localStorage.removeItem("pending_changes");
        console.log("Cache cleared successfully");
      } catch (error) {
        console.error("Error clearing cache:", error);
      }
    },

    getNetworkStatus: () => {
      return {
        online: navigator.onLine,
        effectiveType: navigator.connection?.effectiveType || "unknown",
        downlink: navigator.connection?.downlink || 0,
        apiConfig: this.getApiConfig(),
      };
    },
  };
};

// Create the service instance
const mobileWorkerService = createMobileWorkerService();

/**
 * Enhanced Pause Job Options Modal Component
 * Allows selection between requiring signature or marking as vacant, plus shows work summary
 */
const PauseJobOptionsModal = ({ onSelect, onCancel, workSummary }) => {
  return (
    <div className="mobile-modal-overlay">
      <div className="mobile-modal-content">
        <h3 className="mobile-text-lg mobile-font-semibold mb-4">Pause Job</h3>
        <p className="mobile-text-gray-600 mb-6">
          How would you like to pause this job?
        </p>

        {/* Work Summary Section */}
        {workSummary && (
          <div className="mobile-card mobile-bg-blue-50 mobile-border-blue-200 mb-6">
            <h4 className="mobile-font-semibold mobile-text-blue-800 mb-3">
              Today's Work Summary
            </h4>
            <div className="mobile-text-sm mobile-text-blue-700 space-y-2">
              <div className="flex justify-between">
                <span>Time Worked:</span>
                <span className="mobile-font-semibold">{workSummary.timeWorked}</span>
              </div>
              <div className="flex justify-between">
                <span>Doors Worked On:</span>
                <span className="mobile-font-semibold">{workSummary.doorsWorkedOn}</span>
              </div>
              <div className="flex justify-between">
                <span>Line Items Completed:</span>
                <span className="mobile-font-semibold">{workSummary.lineItemsCompleted}</span>
              </div>
              {workSummary.doorsCompleted > 0 && (
                <div className="flex justify-between">
                  <span>Doors Completed:</span>
                  <span className="mobile-font-semibold">{workSummary.doorsCompleted}</span>
                </div>
              )}
              {workSummary.mediaUploaded && workSummary.mediaUploaded.length > 0 && (
                <div>
                  <span>Media Captured:</span>
                  <ul className="ml-4 mt-1">
                    {workSummary.mediaUploaded.map((media, index) => (
                      <li key={index} className="mobile-text-xs">
                        • {media}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="start-job-options-container">
          <button
            onClick={() => onSelect("signature")}
            className="start-job-option-button"
          >
            <PenTool className="icon-md mobile-text-blue-600" />
            <div>
              <div className="mobile-font-medium">With Signature</div>
              <div className="mobile-text-sm mobile-text-gray-600">
                Customer/Site contact is present
              </div>
            </div>
          </button>

          <button
            onClick={() => onSelect("vacant")}
            className="start-job-option-button"
          >
            <User className="icon-md mobile-text-gray-600" />
            <div>
              <div className="mobile-font-medium">Vacant Site</div>
              <div className="mobile-text-sm mobile-text-gray-600">
                No one available to sign
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="mobile-button mobile-button-gray mt-4"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

/**
 * Reusable Options Modal Component for Start/Resume
 * Allows selection between requiring signature or marking as vacant
 */
const StartJobOptionsModal = ({ onSelect, onCancel, title = "Start Job" }) => {
  return (
    <div className="mobile-modal-overlay">
      <div className="mobile-modal-content">
        <h3 className="mobile-text-lg mobile-font-semibold mb-4">{title}</h3>
        <p className="mobile-text-gray-600 mb-6">
          How would you like to {title.toLowerCase()}?
        </p>

        <div className="start-job-options-container">
          <button
            onClick={() => onSelect("signature")}
            className="start-job-option-button"
          >
            <PenTool className="icon-md mobile-text-blue-600" />
            <div>
              <div className="mobile-font-medium">With Signature</div>
              <div className="mobile-text-sm mobile-text-gray-600">
                Customer/Site contact is present
              </div>
            </div>
          </button>

          <button
            onClick={() => onSelect("vacant")}
            className="start-job-option-button"
          >
            <User className="icon-md mobile-text-gray-600" />
            <div>
              <div className="mobile-font-medium">Vacant Site</div>
              <div className="mobile-text-sm mobile-text-gray-600">
                No one available to sign
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="mobile-button mobile-button-gray mt-4"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

/**
 * Enhanced Custom Signature Pad Component
 * Provides touch and mouse support for signature capture with work summary for pause operations
 */
const SignaturePad = ({ onSave, onCancel, title = "Signature", workSummary = null }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000000";

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }, []);

  const getEventPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX =
      e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY =
      e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getEventPos(e);
    setLastPosition(pos);

    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();

    const pos = getEventPos(e);
    const ctx = canvasRef.current.getContext("2d");

    ctx.beginPath();
    ctx.moveTo(lastPosition.x, lastPosition.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    setLastPosition(pos);
    setIsEmpty(false);
  };

  const stopDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const saveSignature = () => {
    if (isEmpty) {
      alert("Please provide a signature before saving.");
      return;
    }
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL("image/png");
    onSave(dataURL);
  };

  return (
    <div className="mobile-modal-overlay">
      <div className="mobile-modal-content">
        <h3 className="mobile-text-lg mobile-font-semibold mb-4">{title}</h3>
        
        {/* Work Summary Section for pause signatures */}
        {workSummary && (
          <div className="mobile-card mobile-bg-blue-50 mobile-border-blue-200 mb-4">
            <h4 className="mobile-font-semibold mobile-text-blue-800 mb-3">
              Work Summary
            </h4>
            <div className="mobile-text-sm mobile-text-blue-700 space-y-2">
              <div className="flex justify-between">
                <span>Time Worked:</span>
                <span className="mobile-font-semibold">{workSummary.timeWorked}</span>
              </div>
              <div className="flex justify-between">
                <span>Doors Worked On:</span>
                <span className="mobile-font-semibold">{workSummary.doorsWorkedOn}</span>
              </div>
              <div className="flex justify-between">
                <span>Line Items Completed:</span>
                <span className="mobile-font-semibold">{workSummary.lineItemsCompleted}</span>
              </div>
              {workSummary.doorsCompleted > 0 && (
                <div className="flex justify-between">
                  <span>Doors Completed:</span>
                  <span className="mobile-font-semibold">{workSummary.doorsCompleted}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="signature-canvas-container">
          <canvas
            ref={canvasRef}
            className="signature-canvas-element"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ touchAction: "none" }}
          />
        </div>
        <p className="mobile-text-sm mobile-text-gray-600 mb-4">
          Please sign above
        </p>
        <div className="signature-actions-container">
          <button onClick={clearSignature} className="mobile-button-gray">
            Clear
          </button>
          <button onClick={onCancel} className="mobile-button-gray">
            Cancel
          </button>
          <button onClick={saveSignature} className="mobile-button-blue">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Camera Capture Component
 * Handles both photo and video capture using device camera
 */
const CameraCapture = ({ onCapture, onCancel, type = "photo" }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment",
        },
        audio: type === "video",
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(
        constraints
      );
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError(
        "Unable to access camera. Please check permissions and try again."
      );
    }
  };

  const capturePhoto = () => {
    const canvas = document.createElement("canvas");
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const dataURL = canvas.toDataURL("image/jpeg", 0.8);
    onCapture(dataURL, "photo");
  };

  const startVideoRecording = () => {
    if (!stream) return;

    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9,opus",
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      onCapture(blob, "video");
    };

    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
  };

  const stopVideoRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  if (error) {
    return (
      <div className="mobile-modal-overlay">
        <div className="mobile-modal-content">
          <div className="text-center">
            <AlertTriangle className="icon-xxl mobile-text-red-500 mx-auto mb-4" />
            <h3 className="mobile-text-lg mobile-font-semibold mb-2">
              Camera Error
            </h3>
            <p className="mobile-text-gray-600 mb-4">{error}</p>
            <button onClick={onCancel} className="mobile-button-gray">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-modal-overlay">
      <div className="mobile-modal-content camera-capture">
        <div className="camera-video-container">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-video-element"
            style={{ aspectRatio: "16/9" }}
          />
        </div>

        {isRecording && (
          <div className="camera-recording-indicator">
            <div className="camera-recording-badge">
              <div className="camera-recording-pulse-dot" />
              <span>Recording...</span>
            </div>
          </div>
        )}

        <div className="camera-actions-container">
          <button onClick={onCancel} className="mobile-button-gray">
            Cancel
          </button>

          {type === "photo" ? (
            <button onClick={capturePhoto} className="mobile-button-blue">
              <Camera className="icon-sm" />
              Capture Photo
            </button>
          ) : (
            <button
              onClick={isRecording ? stopVideoRecording : startVideoRecording}
              className={
                isRecording ? "mobile-button-red" : "mobile-button-blue"
              }
            >
              <Video className="icon-sm" />
              {isRecording ? "Stop Recording" : "Start Recording"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const MobileJobWorker = ({ jobId }) => {
  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobStatus, setJobStatus] = useState("not_started"); // From jobData.mobile_status
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState(null); // From jobData.start_time

  const [currentView, setCurrentView] = useState("overview"); // 'overview', 'door_detail', 'summary'
  const [selectedDoor, setSelectedDoor] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showStartOptions, setShowStartOptions] = useState(false);
  const [showPauseOptions, setShowPauseOptions] = useState(false);
  const [showResumeOptions, setShowResumeOptions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState("photo"); // 'photo' or 'video'
  const [signatureType, setSignatureType] = useState("start"); // 'start', 'pause', 'resume', 'door_complete', 'final'
  const [isVacantStart, setIsVacantStart] = useState(false); // For vacant site start
  const [isVacantPause, setIsVacantPause] = useState(false); // For vacant site pause
  const [currentWorkSummary, setCurrentWorkSummary] = useState(null); // Work summary for pause operations

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false); // For UI indication of sync activity
  const [uploading, setUploading] = useState(false); // For media/signature upload indication

  const [totalJobTime, setTotalJobTime] = useState(0); // Total time across all sessions
  const [currentSessionTime, setCurrentSessionTime] = useState(0); // Current session time
  const [timeTrackingData, setTimeTrackingData] = useState(null);
  const [jobTimingStatus, setJobTimingStatus] = useState('not_started'); // 'not_started', 'active', 'paused', 'completed'


  const apiConfig = mobileWorkerService.getApiConfig();
  const apiServerRoot = apiConfig.baseUrl.startsWith("http")
    ? apiConfig.baseUrl.replace("/api", "")
    : "";

  /**
   * Generate work summary for the current session/day
   * Used for pause operations to show what was accomplished
   */
  const generateWorkSummary = () => {
    if (!jobData || !timeTrackingData) return null;

    // Calculate current session time in a readable format
    const sessionTime = formatTime(currentSessionTime);
    
    // Count doors that have been worked on (have any completed line items or media)
    const doorsWorkedOn = jobData.doors.filter(door => 
      door.line_items.some(item => item.completed) || 
      door.has_photo || 
      door.has_video
    ).length;

    // Count total line items completed across all doors
    const lineItemsCompleted = jobData.doors.reduce((total, door) => 
      total + door.line_items.filter(item => item.completed).length, 0
    );

    // Count doors completed (have signatures)
    const doorsCompleted = jobData.doors.filter(door => door.completed).length;

    // Generate media captured list
    const mediaUploaded = [];
    jobData.doors.forEach(door => {
      if (door.has_photo) {
        mediaUploaded.push(`Door #${door.door_number} - Photo`);
      }
      if (door.has_video) {
        mediaUploaded.push(`Door #${door.door_number} - Video`);
      }
    });

    return {
      timeWorked: sessionTime,
      doorsWorkedOn: `${doorsWorkedOn} of ${jobData.doors.length}`,
      lineItemsCompleted: lineItemsCompleted,
      doorsCompleted: doorsCompleted,
      mediaUploaded: mediaUploaded
    };
  };

  const loadJobData = async (useCache = true) => {
    setLoading(true);
    setError(null);
    const currentJobId = parseInt(jobId); // Ensure jobId is consistently a number

    try {
      if (useCache && !isOnline) {
        const cachedData = mobileWorkerService.getCachedJob();
        if (cachedData && cachedData.id === currentJobId) {
          console.log("Loading job data from cache (offline mode)");
          setJobData(cachedData);
          setJobStatus(cachedData.mobile_status || "not_started");
          
          // Load cached time tracking data
          if (cachedData.time_tracking) {
            setTimeTrackingData(cachedData.time_tracking);
            setJobTimingStatus(cachedData.time_tracking.job_timing_status || 'not_started');
            setTotalJobTime(cachedData.time_tracking.total_minutes * 60000); // Convert to milliseconds
            
            if (cachedData.time_tracking.current_session_start) {
              const startTimestamp = new Date(cachedData.time_tracking.current_session_start).getTime();
              if (!isNaN(startTimestamp)) setStartTime(startTimestamp);
            }
          }
          
          setLoading(false);
          return;
        }
      }

      console.log(`Loading job data for job ID: ${currentJobId}`);
      const data = await mobileWorkerService.getJob(currentJobId);

      if (!data || typeof data !== "object")
        throw new Error("Invalid job data received from server");
      const requiredFields = ["id", "job_number", "customer_name", "doors"];
      for (const field of requiredFields) {
        if (!data.hasOwnProperty(field))
          throw new Error(`Missing required field in job data: ${field}`);
      }
      if (!Array.isArray(data.doors))
        throw new Error("Invalid doors data: expected array");

      const processedDoors = data.doors.map((door, index) => {
        const doorRequiredFields = ["id", "door_number", "line_items"];
        // ... (validations for door fields and line_items as before)
        const processedLineItems = (door.line_items || []).map(
          (item, itemIndex) => ({
            id: item.id || `temp_li_${itemIndex}_${Date.now()}`,
            description: item.description || "Unnamed work item",
            part_number: item.part_number || "N/A",
            quantity: parseInt(item.quantity) || 1,
            completed: Boolean(item.completed),
            completed_at: item.completed_at || null,
          })
        );

        return {
          id: door.id || `temp_door_${index}_${Date.now()}`,
          door_number: door.door_number || index + 1,
          location: door.location || `Door #${door.door_number || index + 1}`,
          door_type: door.door_type || "Standard",
          width: door.width || null,
          height: door.height || null,
          dimension_unit: door.dimension_unit || "ft",
          labor_description: door.labor_description || "Standard door work",
          notes: door.notes || "",
          completed: Boolean(door.completed), // Door-level completion (by signature)
          has_photo: Boolean(door.has_photo),
          has_video: Boolean(door.has_video),
          has_signature: Boolean(door.has_signature),
          photo_info: door.photo_info || null, // Expecting { id, url, thumbnail_url, uploaded_at }
          video_info: door.video_info || null, // Expecting { id, url, thumbnail_url, uploaded_at }
          line_items: processedLineItems,
          completion_percentage: door.completion_percentage || 0,
          ready_for_completion: door.ready_for_completion || false,
        };
      });

      const processedJobData = {
        id: data.id,
        job_number: data.job_number,
        customer_name: data.customer_name || "Unknown Customer",
        address: data.address || "Address not specified",
        contact_name: data.contact_name || null,
        phone: data.phone || null,
        email: data.email || null,
        job_scope: data.job_scope || "Work scope not specified",
        mobile_status: data.mobile_status || "not_started",
        start_time: data.start_time || null, // ISO string or null
        doors: processedDoors,
        total_doors: data.total_doors || processedDoors.length,
        completed_doors:
          data.completed_doors ||
          processedDoors.filter((d) => d.completed).length,
        completion_percentage: data.completion_percentage || 0,
        job_readiness: data.job_readiness || {
          can_start: true,
          can_complete: false,
          all_doors_ready: false,
          missing_requirements: [],
        },
        media_summary: data.media_summary || {
          total_photos: 0,
          total_videos: 0,
        },
        // Include other relevant fields from backend like job_status, scheduled_date etc.
        job_status: data.job_status,
        scheduled_date: data.scheduled_date,
        region: data.region,
        
        // Enhanced time tracking data
        time_tracking: data.time_tracking || {
          total_minutes: 0,
          total_hours: 0,
          current_session_start: null,
          has_active_session: false,
          job_timing_status: 'not_started',
          session_count: 0,
          sessions: []
        }
      };

      console.log("Processed job data for UI:", processedJobData);
      setJobData(processedJobData);
      setJobStatus(processedJobData.mobile_status);
      
      // Enhanced time tracking state management with detailed logging
      if (processedJobData.time_tracking) {
        console.log("📊 Setting time tracking data:", processedJobData.time_tracking);
        setTimeTrackingData(processedJobData.time_tracking);
        
        console.log("📊 Setting job timing status:", processedJobData.time_tracking.job_timing_status);
        setJobTimingStatus(processedJobData.time_tracking.job_timing_status);
        
        const totalTimeMs = processedJobData.time_tracking.total_minutes * 60000;
        console.log("📊 Setting total job time:", totalTimeMs, "ms (", processedJobData.time_tracking.total_minutes, "minutes)");
        setTotalJobTime(totalTimeMs);
        
        if (processedJobData.time_tracking.current_session_start) {
          try {
            const startTimestamp = new Date(processedJobData.time_tracking.current_session_start).getTime();
            if (!isNaN(startTimestamp)) {
              console.log("📊 Setting start time from current_session_start:", new Date(startTimestamp).toISOString());
              setStartTime(startTimestamp);
            } else {
              console.warn("⚠️ Invalid current_session_start format from API:", processedJobData.time_tracking.current_session_start);
            }
          } catch (timeError) {
            console.error("❌ Error parsing current_session_start from API:", timeError);
          }
        }
      }
      
      // Legacy fallback for start_time (for backward compatibility)
      if (processedJobData.start_time && processedJobData.mobile_status === "started" && !processedJobData.time_tracking.current_session_start) {
        try {
          const startTimestamp = new Date(processedJobData.start_time).getTime();
          if (!isNaN(startTimestamp)) {
            console.log("📊 Setting start time from legacy start_time:", new Date(startTimestamp).toISOString());
            setStartTime(startTimestamp);
          } else {
            console.warn("⚠️ Invalid start_time format from API:", processedJobData.start_time);
          }
        } catch (timeError) {
          console.error("❌ Error parsing start_time from API:", timeError);
        }
      }

      if (isOnline) {
        try {
          await mobileWorkerService.cacheJobForOffline(processedJobData);
        } catch (cacheError) {
          console.warn("Failed to cache job data:", cacheError);
        }
      }
      
      console.log(`Job data loaded successfully: ${processedJobData.job_number} - ${processedJobData.mobile_status} - Timing: ${processedJobData.time_tracking.job_timing_status} - Total: ${processedJobData.time_tracking.total_minutes}min`);
      
    } catch (err) {
      console.error("Error in loadJobData:", err);
      let errorMessage = err.message || "Failed to load job data";
      if (err.message && err.message.includes("404"))
        errorMessage = `Job #${currentJobId} not found.`;
      else if (err.message && err.message.includes("Network error"))
        errorMessage = "Network error. Please check connection.";
      setError(errorMessage);

      if (useCache && isOnline) {
        // Attempt cache fallback even on API error if online
        try {
          const cachedData = mobileWorkerService.getCachedJob();
          if (cachedData && cachedData.id === currentJobId) {
            console.log("Falling back to cached data after API error");
            setJobData(cachedData);
            setJobStatus(cachedData.mobile_status || "not_started");
            
            // Load cached time tracking data in fallback
            if (cachedData.time_tracking) {
              setTimeTrackingData(cachedData.time_tracking);
              setJobTimingStatus(cachedData.time_tracking.job_timing_status || 'not_started');
              setTotalJobTime(cachedData.time_tracking.total_minutes * 60000);
              
              if (cachedData.time_tracking.current_session_start) {
                const startTimestamp = new Date(cachedData.time_tracking.current_session_start).getTime();
                if (!isNaN(startTimestamp)) setStartTime(startTimestamp);
              }
            }
            
            setError(null); // Clear API error as we have data
            setTimeout(
              () =>
                alert(
                  "Using cached data due to connection issues. Some information may be outdated."
                ),
              1000
            );
          }
        } catch (cacheError) {
          console.error("Cache fallback also failed:", cacheError);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Enhanced pause job handler - now shows options modal with work summary
   */
  const handlePauseJob = () => {
    // Generate current work summary before showing pause options
    const workSummary = generateWorkSummary();
    setCurrentWorkSummary(workSummary);
    setShowPauseOptions(true);
  };

  /**
   * Handle pause option selection (signature or vacant)
   */
  const handlePauseOptionSelect = (option) => {
    setShowPauseOptions(false);

    if (option === "signature") {
      // Require signature for pause
      setIsVacantPause(false);
      setSignatureType("pause");
      setShowSignaturePad(true);
    } else if (option === "vacant") {
      // Pause without signature (vacant site)
      setIsVacantPause(true);
      handleVacantJobPause();
    }
  };

  /**
   * Handle pausing job without signature (vacant site) with comprehensive validation and error handling
   */
  const handleVacantJobPause = async () => {
    // Validate preconditions
    if (!jobData) {
      console.error("Cannot pause job: No job data available");
      alert("Error: Job data not loaded. Please refresh and try again.");
      return;
    }

    if (jobStatus !== "started") {
      console.warn("Cannot pause job that is not started");
      alert("Job must be started before it can be paused.");
      return;
    }

    if (jobStatus === "completed") {
      console.warn("Cannot pause completed job");
      alert("This job has already been completed.");
      return;
    }

    // Validate job ID
    const jobIdNum = parseInt(jobData.id);
    if (isNaN(jobIdNum) || jobIdNum <= 0) {
      console.error("Invalid job ID for pausing job:", jobData.id);
      alert("Error: Invalid job ID. Cannot pause job.");
      return;
    }

    try {
      setUploading(true);

      console.log(`Pausing vacant job for Job ID: ${jobData.id}`);

      // Pause job with empty signature indicating vacant site
      await mobileWorkerService.pauseJob(
        jobData.id,
        "", // Empty signature for vacant site
        "VACANT SITE", // Special marker for vacant
        "No Contact Available"
      );

      // Update local state immediately for responsive UI
      setJobTimingStatus('paused');
      setStartTime(null);

      console.log("Job paused successfully as vacant site");

      // Reload job data from server to ensure consistency
      setTimeout(async () => {
        try {
          await loadJobData(false); // Force fresh data from API
          console.log("Job data refreshed after vacant pause");
        } catch (refreshError) {
          console.warn("Failed to refresh job data after pause:", refreshError);
        }
      }, 1000);

      // Show success notification
      alert("Job paused successfully at vacant site.");
    } catch (error) {
      console.error("Error pausing vacant job:", error);

      let errorMessage = "Failed to pause job";

      if (
        error.message.includes("401") ||
        error.message.includes("unauthorized")
      ) {
        errorMessage =
          "You are not authorized to pause this job. Please log in and try again.";
      } else if (
        error.message.includes("403") ||
        error.message.includes("forbidden")
      ) {
        errorMessage = "You do not have permission to pause this job.";
      } else if (
        error.message.includes("404") ||
        error.message.includes("not found")
      ) {
        errorMessage = "Job not found. It may have been deleted or modified.";
      } else if (
        error.message.includes("Network") ||
        error.message.includes("fetch")
      ) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else {
        errorMessage = `Failed to pause job: ${error.message}`;
      }

      alert(errorMessage);

      // Store the failed action for later retry if offline
      if (!isOnline) {
        try {
          mobileWorkerService.storePendingChange({
            action: "pause_job_vacant",
            jobId: jobData.id,
            timestamp: new Date().toISOString(),
            data: {
              signature: "",
              contactName: "VACANT SITE",
              title: "No Contact Available",
            },
          });

          alert(
            "You are offline. The job pause will be synced when connection is restored."
          );
        } catch (storeError) {
          console.error("Failed to store pending change:", storeError);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleResumeJob = () => {
    setShowResumeOptions(true);
  };

  const handleResumeOptionSelect = (option) => {
    setShowResumeOptions(false);

    if (option === "signature") {
      setSignatureType("resume");
      setShowSignaturePad(true);
    } else if (option === "vacant") {
      handleVacantJobResume();
    }
  };
  
  const handleVacantJobResume = async () => {
    if (!jobData || jobTimingStatus !== 'paused') {
      alert("Job must be paused before it can be resumed.");
      return;
    }

    try {
      setUploading(true);
      await mobileWorkerService.resumeJob(
        jobData.id,
        "", 
        "VACANT SITE", 
        "No Contact Available"
      );

      const currentTime = Date.now();
      setJobTimingStatus('active');
      setStartTime(currentTime);
      
      setTimeTrackingData(prev => ({
          ...prev,
          current_session_start: new Date(currentTime).toISOString(),
          has_active_session: true,
          job_timing_status: 'active',
      }));
      
      setTimeout(async () => {
        try {
          await loadJobData(false);
          console.log("Job data refreshed after vacant resume");
        } catch (refreshError) {
          console.warn("Failed to refresh job data after resume:", refreshError);
        }
      }, 1000);

      alert("Job resumed successfully at vacant site.");

    } catch (error) {
        console.error("Error resuming vacant job:", error);
        alert(`Failed to resume job: ${error.message}`);
    } finally {
        setUploading(false);
    }
  };

  // Add this new function to load time tracking data:
  const loadTimeTrackingData = async () => {
    try {
      const response = await mobileWorkerService.getTimeTracking(jobData.id);
      setTimeTrackingData(response);
      setJobTimingStatus(response.job_timing_status);
      
      if (response.has_active_session) {
        setStartTime(new Date(response.current_session_start).getTime());
      }
    } catch (error) {
      console.error('Error loading time tracking data:', error);
    }
  };


  // Enhanced timer useEffect with comprehensive logging for debugging:
  useEffect(() => {
    console.log("🕐 Timer useEffect triggered with:", {
      jobTimingStatus,
      hasTimeTrackingData: !!timeTrackingData,
      sessionStart: timeTrackingData?.current_session_start,
      jobStatus,
      hasStartTime: !!startTime,
      startTimeValue: startTime ? new Date(startTime).toISOString() : null
    });

    let interval = null;
    
    // Primary timer: Enhanced time tracking (preferred)
    if (jobTimingStatus === 'active' && timeTrackingData?.current_session_start) {
      // Fix timezone parsing issue - API returns local time but JS parses as UTC
      let sessionStartTime;
      const rawSessionStart = timeTrackingData.current_session_start;
      
      try {
        // If the timestamp doesn't end with 'Z' and doesn't have timezone info, treat as local time
        if (rawSessionStart && !rawSessionStart.endsWith('Z') && !rawSessionStart.includes('+') && !rawSessionStart.includes('-', 10)) {
          // Parse as local time by appending timezone or using a different approach
          const localDate = new Date(rawSessionStart.replace(' ', 'T'));
          sessionStartTime = localDate.getTime();
          
          // If that gives us a future time (indicating UTC parsing), try manual local parsing
          if (sessionStartTime > Date.now()) {
            // Manual parsing approach: treat the timestamp as local time
            const parts = rawSessionStart.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})\.?(\d*)/);
            if (parts) {
              const [, year, month, day, hour, minute, second, ms] = parts;
              const localDate = new Date(
                parseInt(year), 
                parseInt(month) - 1, 
                parseInt(day), 
                parseInt(hour), 
                parseInt(minute), 
                parseInt(second), 
                parseInt(ms.padEnd(3, '0').substring(0, 3))
              );
              sessionStartTime = localDate.getTime();
            } else {
              // Fallback: assume UTC offset and adjust
              const utcTime = new Date(rawSessionStart).getTime();
              const offsetMinutes = new Date().getTimezoneOffset();
              sessionStartTime = utcTime - (offsetMinutes * 60000);
            }
          }
        } else {
          // Standard parsing for properly formatted timestamps
          sessionStartTime = new Date(rawSessionStart).getTime();
        }
      } catch (parseError) {
        console.error("❌ Error parsing session start time:", parseError);
        sessionStartTime = Date.now(); // Fallback to current time
      }
      
      console.log("🟢 Starting PRIMARY timer with session start:", {
        rawSessionStart,
        sessionStartTime: new Date(sessionStartTime).toISOString(),
        isValidTime: !isNaN(sessionStartTime),
        timeDiff: Date.now() - sessionStartTime,
        currentTime: new Date().toISOString()
      });
      
      if (isNaN(sessionStartTime)) {
        console.error("❌ Invalid session start time, cannot start timer");
        return;
      }
      
      // Ensure session start time is not in the future (with 5 second tolerance)
      if (sessionStartTime > Date.now() + 5000) {
        console.warn("⚠️ Session start time is in the future, adjusting to current time");
        sessionStartTime = Date.now();
      }
      
      interval = setInterval(() => {
        const now = Date.now();
        const sessionElapsed = Math.max(0, now - sessionStartTime);
        const sessionMinutes = Math.floor(sessionElapsed / 60000);
        
        console.log("⏱️ PRIMARY timer tick:", {
          elapsed: sessionElapsed,
          formatted: formatTime(sessionElapsed),
          sessionMinutes,
          now: new Date(now).toISOString(),
          startTime: new Date(sessionStartTime).toISOString()
        });
        
        setCurrentSessionTime(sessionElapsed);
        setElapsedTime(sessionElapsed); // Also update legacy timer for display consistency
        
        // Update total time (previous sessions + current session)
        const baseTotalMinutes = timeTrackingData?.total_minutes || 0;
        const totalWithCurrent = baseTotalMinutes + sessionMinutes;
        setTotalJobTime(totalWithCurrent * 60000); // Convert to milliseconds for consistency
      }, 1000);
    } 
    // Fallback timer: Legacy timing (for backward compatibility)
    else if (jobStatus === "started" && startTime && jobTimingStatus !== 'paused') {
      console.log("🟡 Starting FALLBACK timer with start time:", {
        startTime: new Date(startTime).toISOString(),
        isValidTime: !isNaN(startTime),
        timeDiff: Date.now() - startTime,
        jobTimingStatus
      });
      
      if (isNaN(startTime)) {
        console.error("❌ Invalid start time, cannot start fallback timer");
        return;
      }
      
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.max(0, now - startTime);
        
        console.log("⏱️ FALLBACK timer tick:", {
          elapsed,
          formatted: formatTime(elapsed)
        });
        
        setElapsedTime(elapsed);
        setCurrentSessionTime(elapsed);
        setTotalJobTime(elapsed);
      }, 1000);
    } 
    // No active timer
    else {
      console.log("⏸️ No timer conditions met, setting static values:", {
        reason: jobTimingStatus === 'paused' ? 'paused' : 
               jobStatus === 'completed' ? 'completed' : 
               !jobStatus === "started" ? 'not started' :
               !startTime ? 'no start time' :
               jobTimingStatus === 'paused' ? 'timing paused' : 'unknown',
        jobTimingStatus,
        jobStatus,
        hasStartTime: !!startTime,
        hasTimeTrackingData: !!timeTrackingData
      });
      
      if (jobTimingStatus === 'paused' || jobStatus === 'completed') {
        // Keep current session time frozen when paused
        if (timeTrackingData?.total_minutes) {
          setTotalJobTime(timeTrackingData.total_minutes * 60000);
        }
      } else {
        // Reset timers when not started
        setCurrentSessionTime(0);
        setElapsedTime(0);
        if (timeTrackingData?.total_minutes) {
          setTotalJobTime(timeTrackingData.total_minutes * 60000);
        } else {
          setTotalJobTime(0);
        }
      }
    }

    return () => {
      if (interval) {
        console.log("🛑 Clearing timer interval");
        clearInterval(interval);
      }
    };
  }, [jobTimingStatus, timeTrackingData, jobStatus, startTime]);




  /**
   * Initialize component with comprehensive setup and validation
   */
  useEffect(() => {
    // Validate jobId prop
    if (!jobId) {
      setError("No job ID provided. Cannot load job data.");
      setLoading(false);
      return;
    }

    // Validate jobId format (should be a number or valid string)
    const jobIdNum = parseInt(jobId);
    if (isNaN(jobIdNum) || jobIdNum <= 0) {
      setError("Invalid job ID format. Please provide a valid job number.");
      setLoading(false);
      return;
    }

    console.log(`Initializing Mobile Job Worker for Job ID: ${jobId}`);

    // Set up network status monitoring
    const handleOnlineStatusChange = () => {
      const currentOnlineStatus = navigator.onLine;
      setIsOnline(currentOnlineStatus);

      console.log(
        `Network status changed: ${currentOnlineStatus ? "Online" : "Offline"}`
      );

      // If we just came back online, try to sync pending changes
      if (currentOnlineStatus && !isOnline) {
        console.log("Back online - attempting to sync pending changes");
        syncPendingChanges();
      }
    };

    // Add network event listeners
    window.addEventListener("online", handleOnlineStatusChange);
    window.addEventListener("offline", handleOnlineStatusChange);

    // Set initial online status
    setIsOnline(navigator.onLine);

    // Set up offline service worker handlers
    try {
      mobileWorkerService.setupOfflineHandlers();
    } catch (offlineError) {
      console.warn("Failed to setup offline handlers:", offlineError);
      // Don't fail initialization if offline setup fails
    }

    // Load job data with error handling
    const initializeJobData = async () => {
      try {
        await loadJobData(true); // Use cache initially for faster loading

        // If online, also trigger a background refresh to ensure data is current
        if (navigator.onLine) {
          setTimeout(async () => {
            try {
              console.log("Background refresh of job data");
              await loadJobData(false); // Force fresh data from API
            } catch (backgroundError) {
              console.warn("Background refresh failed:", backgroundError);
              // Don't show error to user for background refresh failures
            }
          }, 2000); // Wait 2 seconds before background refresh
        }
      } catch (initError) {
        console.error("Failed to initialize job data:", initError);
        // Error is already handled in loadJobData
      }
    };

    // Start the initialization process
    initializeJobData();

    // Cleanup function
    return () => {
      console.log("Cleaning up Mobile Job Worker");

      // Remove network event listeners
      window.removeEventListener("online", handleOnlineStatusChange);
      window.removeEventListener("offline", handleOnlineStatusChange);

      // Clear any running timers
      // (Timer cleanup is handled by the timer useEffect)
    };
  }, [jobId]); // Re-initialize if jobId changes

  /**
   * Sync pending changes when back online
   */
  const syncPendingChanges = async () => {
    if (!isOnline) return;

    setPendingSync(true);
    try {
      const results = await mobileWorkerService.syncPendingChanges();
      if (results.synced > 0) {
        await loadJobData(false); // Refresh job data
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setPendingSync(false);
    }
  };

  /**
   * Format milliseconds to HH:MM:SS format
   */
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  /**
   * Handle job start - now shows options modal first
   */
  const handleStartJob = () => {
    setShowStartOptions(true);
  };

  /**
   * Enhanced start option selection handler - now handles both start and pause scenarios
   */
  const handleStartOptionSelect = (option) => {
    setShowStartOptions(false);

    if (option === "signature") {
      // Require signature
      setIsVacantStart(false);
      setSignatureType("start");
      setShowSignaturePad(true);
    } else if (option === "vacant") {
      // Start without signature (vacant site)
      setIsVacantStart(true);
      handleVacantJobStart();
    }
  };

  /**
   * Handle starting job without signature (vacant site) with comprehensive validation and error handling
   */
  const handleVacantJobStart = async () => {
    // Validate preconditions
    if (!jobData) {
      console.error("Cannot start job: No job data available");
      alert("Error: Job data not loaded. Please refresh and try again.");
      return;
    }

    if (jobStatus === "started") {
      console.warn("Job is already started");
      alert("This job has already been started.");
      return;
    }

    if (jobStatus === "completed") {
      console.warn("Cannot start completed job");
      alert("This job has already been completed.");
      return;
    }

    // Validate job ID
    const jobIdNum = parseInt(jobData.id);
    if (isNaN(jobIdNum) || jobIdNum <= 0) {
      console.error("Invalid job ID for starting job:", jobData.id);
      alert("Error: Invalid job ID. Cannot start job.");
      return;
    }

    try {
      setUploading(true);

      console.log(`Starting vacant job for Job ID: ${jobData.id}`);

      // Start job with empty signature indicating vacant site
      await mobileWorkerService.startJob(
        jobData.id,
        "", // Empty signature for vacant site
        "VACANT SITE", // Special marker for vacant
        "No Contact Available"
      );

      // Calculate current timestamp for local state
      const currentTime = Date.now();

      // Update local state immediately for responsive UI with enhanced timing
      setJobStatus("started");
      setStartTime(currentTime);
      
      // Immediately set timing status to active for timer to start
      setJobTimingStatus('active');
      
      // Create immediate time tracking data for timer
      const immediateTimeTracking = {
        total_minutes: 0,
        total_hours: 0,
        current_session_start: new Date(currentTime).toISOString(),
        has_active_session: true,
        job_timing_status: 'active',
        session_count: 1,
        sessions: []
      };
      setTimeTrackingData(immediateTimeTracking);

      console.log("Job started successfully as vacant site - timer should start immediately");

      // Reload job data from server to ensure consistency
      // Use background refresh to avoid showing loading state
      setTimeout(async () => {
        try {
          await loadJobData(false); // Force fresh data from API
          console.log("Job data refreshed after vacant start");
        } catch (refreshError) {
          console.warn("Failed to refresh job data after start:", refreshError);
          // Don't show error to user since job was started successfully
        }
      }, 1000);

      // Show success notification
      alert("Job started successfully at vacant site.");
    } catch (error) {
      console.error("Error starting vacant job:", error);

      // Provide specific error messages based on error type
      let errorMessage = "Failed to start job";

      if (
        error.message.includes("401") ||
        error.message.includes("unauthorized")
      ) {
        errorMessage =
          "You are not authorized to start this job. Please log in and try again.";
      } else if (
        error.message.includes("403") ||
        error.message.includes("forbidden")
      ) {
        errorMessage = "You do not have permission to start this job.";
      } else if (
        error.message.includes("404") ||
        error.message.includes("not found")
      ) {
        errorMessage = "Job not found. It may have been deleted or modified.";
      } else if (
        error.message.includes("Network") ||
        error.message.includes("fetch")
      ) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else {
        errorMessage = `Failed to start job: ${error.message}`;
      }

      alert(errorMessage);

      // Store the failed action for later retry if offline
      if (!isOnline) {
        try {
          mobileWorkerService.storePendingChange({
            action: "start_job_vacant",
            jobId: jobData.id,
            timestamp: new Date().toISOString(),
            data: {
              signature: "",
              contactName: "VACANT SITE",
              title: "No Contact Available",
            },
          });

          alert(
            "You are offline. The job start will be synced when connection is restored."
          );
        } catch (storeError) {
          console.error("Failed to store pending change:", storeError);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  /**
   * Enhanced signature saving handler - now supports pause signatures with work summary
   */
  const handleSignatureSave = async (signature) => {
    // Validate signature data
    if (
      !signature ||
      typeof signature !== "string" ||
      signature.trim().length === 0
    ) {
      console.error("Invalid signature data provided");
      alert("Error: Invalid signature data. Please try signing again.");
      return;
    }

    // Validate signature is a valid base64 data URL for images
    if (!signature.startsWith("data:image/")) {
      console.error("Invalid signature format - not a valid image data URL");
      alert("Error: Invalid signature format. Please try signing again.");
      return;
    }

    // Validate job data exists
    if (!jobData) {
      console.error("Cannot save signature: No job data available");
      alert("Error: Job data not loaded. Please refresh and try again.");
      return;
    }

    // Validate job ID
    const jobIdNum = parseInt(jobData.id);
    if (isNaN(jobIdNum) || jobIdNum <= 0) {
      console.error("Invalid job ID for signature save:", jobData.id);
      alert("Error: Invalid job ID. Cannot save signature.");
      return;
    }

    // Get contact information with fallbacks - defined at function scope
    const contactName = jobData.contact_name || "Site Contact";
    const contactTitle = "Authorized Representative";

    try {
      setUploading(true);

      console.log(
        `Saving ${signatureType} signature for Job ID: ${jobData.id}`
      );

      if (signatureType === "start") {
        // Validate job is not already started
        if (jobStatus === "started") {
          console.warn("Job is already started");
          alert("This job has already been started.");
          setShowSignaturePad(false);
          return;
        }

        if (jobStatus === "completed") {
          console.warn("Cannot start completed job");
          alert("This job has already been completed.");
          setShowSignaturePad(false);
          return;
        }

        console.log("Starting job with signature");
        await mobileWorkerService.startJob(
          jobData.id,
          signature,
          contactName,
          contactTitle
        );

        // Update local state for immediate UI response with enhanced timing
        const currentTime = Date.now();
        setJobStatus("started");
        setStartTime(currentTime);
        
        // Immediately set timing status to active for timer to start
        setJobTimingStatus('active');
        
        // Create immediate time tracking data for timer
        const immediateTimeTracking = {
          total_minutes: 0,
          total_hours: 0,
          current_session_start: new Date(currentTime).toISOString(),
          has_active_session: true,
          job_timing_status: 'active',
          session_count: 1,
          sessions: []
        };
        setTimeTrackingData(immediateTimeTracking);

        console.log("Job started successfully with signature - timer should start immediately");
      } else if (signatureType === "pause") {
        // Validate job can be paused
        if (jobStatus !== "started") {
          console.warn("Cannot pause job that is not started");
          alert("Job must be started before it can be paused.");
          setShowSignaturePad(false);
          return;
        }

        if (jobStatus === "completed") {
          console.warn("Cannot pause completed job");
          alert("This job has already been completed.");
          setShowSignaturePad(false);
          return;
        }

        console.log("Pausing job with signature");
        await mobileWorkerService.pauseJob(
          jobData.id,
          signature,
          contactName,
          contactTitle
        );

        // Update local state for immediate UI response
        setJobTimingStatus('paused');
        setStartTime(null);

        console.log("Job paused successfully with signature");
      } else if (signatureType === "resume") {
        if (jobTimingStatus !== 'paused') {
            alert("Job must be paused before it can be resumed.");
            setShowSignaturePad(false);
            return;
        }

        console.log("Resuming job with signature");
        await mobileWorkerService.resumeJob(
          jobData.id,
          signature,
          contactName,
          contactTitle
        );
        
        const currentTime = Date.now();
        setJobTimingStatus('active');
        setStartTime(currentTime);
        setTimeTrackingData(prev => ({
            ...prev,
            current_session_start: new Date(currentTime).toISOString(),
            has_active_session: true,
            job_timing_status: 'active',
        }));
      } else if (signatureType === "door_complete") {
        // Validate selectedDoor exists
        if (!selectedDoor) {
          console.error("Cannot complete door: No door selected");
          alert("Error: No door selected for completion.");
          setShowSignaturePad(false);
          return;
        }

        // Validate door ID
        const doorIdNum = parseInt(selectedDoor.id);
        if (isNaN(doorIdNum) || doorIdNum <= 0) {
          console.error("Invalid door ID for completion:", selectedDoor.id);
          alert("Error: Invalid door ID. Cannot complete door.");
          setShowSignaturePad(false);
          return;
        }

        // Check if door is already completed
        if (selectedDoor.completed) {
          console.warn("Door is already completed");
          alert("This door has already been completed.");
          setShowSignaturePad(false);
          return;
        }

        // Validate door readiness for completion
        if (!isDoorReadyForCompletion(selectedDoor)) {
          console.warn("Door is not ready for completion");
          alert(
            "Please complete all line items, capture a photo, and record a video before completing this door."
          );
          setShowSignaturePad(false);
          return;
        }

        console.log(
          `Completing door ${selectedDoor.door_number} with signature`
        );
        await mobileWorkerService.completeDoor(
          selectedDoor.id,
          jobData.id,
          signature,
          contactName,
          contactTitle
        );

        // Update local state for immediate UI response
        setJobData((prev) => ({
          ...prev,
          doors: prev.doors.map((door) =>
            door.id === selectedDoor.id
              ? { ...door, completed: true, has_signature: true }
              : door
          ),
          completed_doors: (prev.completed_doors || 0) + 1,
        }));

        console.log(`Door ${selectedDoor.door_number} completed successfully`);
      } else if (signatureType === "final") {
        // Validate job can be completed
        if (jobStatus === "completed") {
          console.warn("Job is already completed");
          alert("This job has already been completed.");
          setShowSignaturePad(false);
          return;
        }

        if (jobStatus !== "started") {
          console.warn("Cannot complete job that is not started");
          alert("Job must be started before it can be completed.");
          setShowSignaturePad(false);
          return;
        }

        if (!canCompleteJob()) {
          console.warn("Job is not ready for completion");
          alert("Please complete all doors before finishing the job.");
          setShowSignaturePad(false);
          return;
        }

        console.log("Completing job with final signature");
        await mobileWorkerService.completeJob(
          jobData.id,
          signature,
          contactName,
          contactTitle
        );

        // Update local state for immediate UI response
        setJobStatus("completed");

        console.log("Job completed successfully with final signature");
      } else {
        throw new Error(`Invalid signature type: ${signatureType}`);
      }

      // Close signature pad
      setShowSignaturePad(false);

      // Clear work summary after successful save
      if (signatureType === "pause") {
        setCurrentWorkSummary(null);
      }

      // Reload job data from server to ensure consistency
      // Use background refresh to avoid showing loading state
      setTimeout(async () => {
        try {
          await loadJobData(false); // Force fresh data from API
          console.log("Job data refreshed after signature save");
        } catch (refreshError) {
          console.warn(
            "Failed to refresh job data after signature save:",
            refreshError
          );
          // Don't show error to user since signature was saved successfully
        }
      }, 1000);

      // Show success notification based on signature type
      const successMessages = {
        start: "Job started successfully!",
        pause: "Job paused successfully!",
        resume: "Job resumed successfully!",
        door_complete: `Door #${
          selectedDoor?.door_number || ""
        } completed successfully!`,
        final: "Job completed successfully!",
      };

      alert(successMessages[signatureType] || "Signature saved successfully!");
    } catch (error) {
      console.error("Error saving signature:", error);

      // Provide specific error messages based on error type and signature type
      let errorMessage = `Failed to save ${signatureType} signature`;

      if (
        error.message.includes("401") ||
        error.message.includes("unauthorized")
      ) {
        errorMessage =
          "You are not authorized to perform this action. Please log in and try again.";
      } else if (
        error.message.includes("403") ||
        error.message.includes("forbidden")
      ) {
        errorMessage = "You do not have permission to perform this action.";
      } else if (
        error.message.includes("404") ||
        error.message.includes("not found")
      ) {
        errorMessage =
          signatureType === "door_complete"
            ? "Door not found. It may have been deleted or modified."
            : "Job not found. It may have been deleted or modified.";
      } else if (
        error.message.includes("Network") ||
        error.message.includes("fetch")
      ) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else if (error.message.includes("Invalid")) {
        errorMessage = `Invalid data: ${error.message}`;
      } else {
        errorMessage = `Failed to save ${signatureType} signature: ${error.message}`;
      }

      alert(errorMessage);

      // Store the failed action for later retry if offline
      if (!isOnline) {
        try {
          const pendingChangeData = {
            action: `save_signature_${signatureType}`,
            jobId: jobData.id,
            timestamp: new Date().toISOString(),
            data: {
              signature,
              contactName,
              contactTitle,
              signatureType,
            },
          };

          // Add door-specific data for door completion signatures
          if (signatureType === "door_complete" && selectedDoor) {
            pendingChangeData.data.doorId = selectedDoor.id;
            pendingChangeData.data.doorNumber = selectedDoor.door_number;
          }

          // Add work summary for pause signatures
          if (signatureType === "pause" && currentWorkSummary) {
            pendingChangeData.data.workSummary = currentWorkSummary;
          }

          mobileWorkerService.storePendingChange(pendingChangeData);

          alert(
            "You are offline. The signature will be synced when connection is restored."
          );
        } catch (storeError) {
          console.error(
            "Failed to store pending signature change:",
            storeError
          );
        }
      }
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle media capture (photo/video) with comprehensive validation and error handling
   * Enhanced to store and display captured photos properly without flashing
   */
  const handleMediaCapture = async (media, type) => {
    // Validate media data
    if (!media) {
      console.error("No media data provided");
      alert("Error: No media data captured. Please try again.");
      return;
    }

    // Validate media type
    if (!type || !["photo", "video"].includes(type)) {
      console.error("Invalid media type:", type);
      alert("Error: Invalid media type. Please try again.");
      return;
    }

    // Validate selected door exists
    if (!selectedDoor) {
      console.error("Cannot upload media: No door selected");
      alert("Error: No door selected for media upload.");
      return;
    }

    // Validate job data exists
    if (!jobData) {
      console.error("Cannot upload media: No job data available");
      alert("Error: Job data not loaded. Please refresh and try again.");
      return;
    }

    // Validate job is started
    if (jobStatus !== "started") {
      console.warn("Cannot upload media for job that is not started");
      alert("Job must be started before uploading media.");
      return;
    }

    // Validate door and job IDs
    const doorIdNum = parseInt(selectedDoor.id);
    const jobIdNum = parseInt(jobData.id);

    if (isNaN(doorIdNum) || doorIdNum <= 0) {
      console.error("Invalid door ID for media upload:", selectedDoor.id);
      alert("Error: Invalid door ID. Cannot upload media.");
      return;
    }

    if (isNaN(jobIdNum) || jobIdNum <= 0) {
      console.error("Invalid job ID for media upload:", jobData.id);
      alert("Error: Invalid job ID. Cannot upload media.");
      return;
    }

    // Validate media data format
    let mediaSize = 0;
    let isValidFormat = false;

    try {
      if (type === "photo") {
        // Photo should be a base64 data URL string
        if (typeof media === "string" && media.startsWith("data:image/")) {
          isValidFormat = true;
          // Estimate size from base64 string (rough calculation)
          const base64Length = media.split(",")[1]?.length || 0;
          mediaSize = (base64Length * 3) / 4; // Base64 to bytes conversion
        } else {
          console.error("Invalid photo format - expected base64 data URL");
        }
      } else if (type === "video") {
        // Video should be a Blob object
        if (media instanceof Blob) {
          isValidFormat = true;
          mediaSize = media.size;
        } else {
          console.error("Invalid video format - expected Blob object");
        }
      }

      if (!isValidFormat) {
        alert(`Error: Invalid ${type} format. Please try capturing again.`);
        return;
      }

      // Validate file size constraints
      const maxSizes = {
        photo: 10 * 1024 * 1024, // 10MB for photos
        video: 100 * 1024 * 1024, // 100MB for videos
      };

      if (mediaSize > maxSizes[type]) {
        const maxSizeMB = maxSizes[type] / (1024 * 1024);
        alert(
          `Error: ${type} is too large. Maximum size allowed: ${maxSizeMB}MB`
        );
        return;
      }

      if (mediaSize === 0) {
        alert(`Error: ${type} file is empty. Please try capturing again.`);
        return;
      }
    } catch (validationError) {
      console.error("Media validation error:", validationError);
      alert(`Error: Failed to validate ${type}. Please try again.`);
      return;
    }

    try {
      setUploading(true);

      console.log(
        `Uploading ${type} for Door ${selectedDoor.door_number} in Job ${jobData.id}`
      );
      console.log(`Media size: ${(mediaSize / 1024).toFixed(1)} KB`);

      // Upload media using appropriate service method and capture the response
      let uploadResponse;
      if (type === "photo") {
        uploadResponse = await mobileWorkerService.uploadDoorPhoto(
          selectedDoor.id,
          jobData.id,
          media
        );
      } else {
        uploadResponse = await mobileWorkerService.uploadDoorVideo(
          selectedDoor.id,
          jobData.id,
          media
        );
      }

      console.log(
        `${type} uploaded successfully for Door ${selectedDoor.door_number}`,
        uploadResponse
      );

      // Extract media URL from response or use the original data for immediate display
      const mediaUrl = uploadResponse?.media_url || uploadResponse?.url;
      const thumbnailUrl =
        uploadResponse?.thumbnail_url || uploadResponse?.thumb_url || mediaUrl;
      const mediaId =
        uploadResponse?.media_id || uploadResponse?.id || Date.now();
      const uploadedAt =
        uploadResponse?.uploaded_at || new Date().toISOString();

      // Create proper media info object structure that matches what the component expects
      const mediaInfo = {
        id: mediaId,
        url: mediaUrl || (type === "photo" ? media : null), // Use original data as fallback for photos
        thumbnail_url: thumbnailUrl || (type === "photo" ? media : null),
        uploaded_at: uploadedAt,
      };

      // Update local state for immediate UI response with proper structure
      setJobData((prev) => ({
        ...prev,
        doors: prev.doors.map((door) =>
          door.id === selectedDoor.id
            ? {
                ...door,
                [`has_${type}`]: true,
                [`${type}_info`]: mediaInfo, // Set the proper _info object structure
              }
            : door
        ),
      }));

      // Update selected door state to match the current door being displayed
      // Fixed the condition that was always true
      if (selectedDoor && selectedDoor.id === doorIdNum) {
        setSelectedDoor((prev) => ({
          ...prev,
          [`has_${type}`]: true,
          [`${type}_info`]: mediaInfo, // Set the proper _info object structure
        }));
      }

      // Close camera interface
      setShowCamera(false);

      // Show success notification
      const successMessage =
        type === "photo"
          ? `Photo captured successfully for Door #${selectedDoor.door_number}!`
          : `Video recorded successfully for Door #${selectedDoor.door_number}!`;

      alert(successMessage);

      // Background refresh of job data to ensure consistency
      // Increased delay to prevent flashing and ensure upload is fully processed
      setTimeout(async () => {
        try {
          await loadJobData(false); // Force fresh data from API
          console.log(`Job data refreshed after ${type} upload`);
        } catch (refreshError) {
          console.warn(
            `Failed to refresh job data after ${type} upload:`,
            refreshError
          );
          // Don't show error to user since upload was successful
        }
      }, 3000); // Increased delay from 1500ms to 3000ms to prevent flashing
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);

      // Provide specific error messages based on error type
      let errorMessage = `Failed to upload ${type}`;

      if (
        error.message.includes("401") ||
        error.message.includes("unauthorized")
      ) {
        errorMessage =
          "You are not authorized to upload media. Please log in and try again.";
      } else if (
        error.message.includes("403") ||
        error.message.includes("forbidden")
      ) {
        errorMessage =
          "You do not have permission to upload media for this job.";
      } else if (
        error.message.includes("404") ||
        error.message.includes("not found")
      ) {
        errorMessage =
          "Door or job not found. It may have been deleted or modified.";
      } else if (
        error.message.includes("413") ||
        error.message.includes("too large")
      ) {
        errorMessage = `${type} file is too large. Please try capturing a smaller file.`;
      } else if (
        error.message.includes("415") ||
        error.message.includes("unsupported")
      ) {
        errorMessage = `${type} format is not supported. Please try again.`;
      } else if (
        error.message.includes("Network") ||
        error.message.includes("fetch")
      ) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else if (
        error.message.includes("storage") ||
        error.message.includes("space")
      ) {
        errorMessage = "Storage space exceeded. Please contact support.";
      } else {
        errorMessage = `Failed to upload ${type}: ${error.message}`;
      }

      alert(errorMessage);

      // Store the failed upload for later retry if offline
      if (!isOnline) {
        try {
          // Note: For offline storage, we'd need to implement proper media caching
          // This is a simplified approach - in production, you'd want to store media locally
          const pendingChangeData = {
            action: `upload_${type}`,
            jobId: jobData.id,
            doorId: selectedDoor.id,
            doorNumber: selectedDoor.door_number,
            timestamp: new Date().toISOString(),
            data: {
              type,
              size: mediaSize,
              // Note: We can't store large media in localStorage easily
              // In a real implementation, you'd use IndexedDB or similar
              hasMedia: true,
            },
          };

          mobileWorkerService.storePendingChange(pendingChangeData);

          alert(
            `You are offline. The ${type} will be uploaded when connection is restored.`
          );
        } catch (storeError) {
          console.error("Failed to store pending media upload:", storeError);
          alert(`Failed to upload ${type} and unable to store for later sync.`);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  /**
   * Photo Viewer Modal Component
   * Displays full-size photo with zoom and pan capabilities
   */
  const PhotoViewer = ({ photoUrl, onClose, doorNumber }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    return (
      <div
        className="mobile-modal-overlay"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.9)" }}
      >
        <div className="photo-viewer-container">
          <div className="photo-viewer-header">
            <h3 className="photo-viewer-title">Door #{doorNumber} Photo</h3>
            <button onClick={onClose} className="photo-viewer-close-button">
              <X className="icon-md" />
            </button>
          </div>

          <div className="photo-viewer-content">
            {!imageLoaded && !imageError && (
              <div className="photo-viewer-loading">
                <Loader className="icon-lg animate-spin mobile-text-white" />
                <p className="mobile-text-white">Loading photo...</p>
              </div>
            )}

            {imageError && (
              <div className="photo-viewer-error">
                <AlertTriangle className="icon-lg mobile-text-red-400" />
                <p className="mobile-text-white">Failed to load photo</p>
              </div>
            )}

            <img
              src={photoUrl}
              alt={`Door ${doorNumber} completion photo`}
              className="photo-viewer-image"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              style={{
                display: imageLoaded && !imageError ? "block" : "none",
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          </div>

          <div className="photo-viewer-footer">
            <button
              onClick={onClose}
              className="mobile-button mobile-button-gray"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const DoorDetail = () => {
    const [showPhotoViewer, setShowPhotoViewer] = useState(false);
    const [photoViewerUrl, setPhotoViewerUrl] = useState('');

    // Get the most up-to-date door data from jobData, fallback to selectedDoor (initial state)
    const currentDoorInJobData = jobData?.doors.find(d => d.id === selectedDoor?.id);
    const doorToDisplay = currentDoorInJobData || selectedDoor;

    // Stabilize the door reference using useMemo to prevent unnecessary recalculations
    const stableDoor = useMemo(() => {
      if (!doorToDisplay) return null;
      
      // Create a stable reference for the door object by extracting only the values we need
      return {
        id: doorToDisplay.id,
        door_number: doorToDisplay.door_number,
        location: doorToDisplay.location,
        door_type: doorToDisplay.door_type,
        width: doorToDisplay.width,
        height: doorToDisplay.height,
        dimension_unit: doorToDisplay.dimension_unit,
        labor_description: doorToDisplay.labor_description,
        notes: doorToDisplay.notes,
        completed: Boolean(doorToDisplay.completed),
        line_items: doorToDisplay.line_items || [],
        // Extract primitive values for media info to ensure stability
        photo_info_id: doorToDisplay.photo_info?.id,
        photo_info_url: doorToDisplay.photo_info?.url,
        photo_info_thumbnail_url: doorToDisplay.photo_info?.thumbnail_url,
        photo_info_uploaded_at: doorToDisplay.photo_info?.uploaded_at,
        video_info_id: doorToDisplay.video_info?.id,
        video_info_url: doorToDisplay.video_info?.url,
        video_info_thumbnail_url: doorToDisplay.video_info?.thumbnail_url,
        video_info_uploaded_at: doorToDisplay.video_info?.uploaded_at,
        has_photo: Boolean(doorToDisplay.photo_info && doorToDisplay.photo_info.url),
        has_video: Boolean(doorToDisplay.video_info && doorToDisplay.video_info.url)
      };
    }, [
      doorToDisplay?.id,
      doorToDisplay?.door_number,
      doorToDisplay?.location,
      doorToDisplay?.door_type,
      doorToDisplay?.width,
      doorToDisplay?.height,
      doorToDisplay?.dimension_unit,
      doorToDisplay?.labor_description,
      doorToDisplay?.notes,
      doorToDisplay?.completed,
      doorToDisplay?.line_items?.length,
      // Use primitive values instead of object references for media info
      doorToDisplay?.photo_info?.id,
      doorToDisplay?.photo_info?.url,
      doorToDisplay?.photo_info?.thumbnail_url,
      doorToDisplay?.photo_info?.uploaded_at,
      doorToDisplay?.video_info?.id,
      doorToDisplay?.video_info?.url,
      doorToDisplay?.video_info?.thumbnail_url,
      doorToDisplay?.video_info?.uploaded_at,
      // Ensure line items completion state is tracked without deep object references
      JSON.stringify(doorToDisplay?.line_items?.map(item => ({ id: item.id, completed: item.completed })))
    ]);

    // Memoize media URLs with stable dependencies to prevent video reloading
    const mediaUrls = useMemo(() => {
      if (!stableDoor) {
        return {
          hasPhoto: false,
          hasVideo: false,
          absolutePhotoThumbnailUrl: null,
          absolutePhotoUrl: null,
          absoluteVideoUrl: null,
          photoInfo: null,
          videoInfo: null
        };
      }

      const hasPhoto = stableDoor.has_photo;
      const hasVideo = stableDoor.has_video;

      // Construct absolute URLs for img/video src attributes
      const absolutePhotoThumbnailUrl = hasPhoto && stableDoor.photo_info_thumbnail_url ? 
        (apiServerRoot + stableDoor.photo_info_thumbnail_url) : null;
      const absolutePhotoUrl = hasPhoto && stableDoor.photo_info_url ? 
        (apiServerRoot + stableDoor.photo_info_url) : null;
      const absoluteVideoUrl = hasVideo && stableDoor.video_info_url ? 
        (apiServerRoot + stableDoor.video_info_url) : null;

      // Reconstruct info objects from primitive values
      const photoInfo = hasPhoto ? {
        id: stableDoor.photo_info_id,
        url: stableDoor.photo_info_url,
        thumbnail_url: stableDoor.photo_info_thumbnail_url,
        uploaded_at: stableDoor.photo_info_uploaded_at
      } : null;

      const videoInfo = hasVideo ? {
        id: stableDoor.video_info_id,
        url: stableDoor.video_info_url,
        thumbnail_url: stableDoor.video_info_thumbnail_url,
        uploaded_at: stableDoor.video_info_uploaded_at
      } : null;

      return {
        hasPhoto,
        hasVideo,
        absolutePhotoThumbnailUrl,
        absolutePhotoUrl,
        absoluteVideoUrl,
        photoInfo,
        videoInfo
      };
    }, [
      // Use primitive values only to ensure stable dependencies
      stableDoor?.has_photo,
      stableDoor?.has_video,
      stableDoor?.photo_info_id,
      stableDoor?.photo_info_url,
      stableDoor?.photo_info_thumbnail_url,
      stableDoor?.photo_info_uploaded_at,
      stableDoor?.video_info_id,
      stableDoor?.video_info_url,
      stableDoor?.video_info_thumbnail_url,
      stableDoor?.video_info_uploaded_at,
      apiServerRoot
    ]);

    // Create stable keys for media elements to prevent unnecessary reloading
    const mediaKeys = useMemo(() => {
      return {
        photoKey: mediaUrls.hasPhoto ? `photo-${mediaUrls.photoInfo?.id}-${stableDoor?.id}` : null,
        videoKey: mediaUrls.hasVideo ? `video-${mediaUrls.videoInfo?.id}-${stableDoor?.id}` : null
      };
    }, [
      mediaUrls.hasPhoto,
      mediaUrls.hasVideo,
      mediaUrls.photoInfo?.id,
      mediaUrls.videoInfo?.id,
      stableDoor?.id
    ]);

    if (!stableDoor) {
      // This case should ideally not be reached if navigation is managed well
      console.warn("DoorDetail rendered without a valid door. Returning to overview.");
      setCurrentView('overview');
      return null; 
    }
    
    // Door-level completion based on signature
    const isDoorSignedOff = stableDoor.completed; 
    
    // Destructure memoized values
    const { 
      hasPhoto, 
      hasVideo, 
      absolutePhotoThumbnailUrl, 
      absolutePhotoUrl, 
      absoluteVideoUrl,
      photoInfo,
      videoInfo
    } = mediaUrls;
    
    const handleViewPhoto = () => {
      if (absolutePhotoUrl) {
        setPhotoViewerUrl(absolutePhotoUrl);
        setShowPhotoViewer(true);
      } else {
        console.warn("Attempted to view photo, but no URL available.");
      }
    };

    // Check if all line items for *this specific door* are completed
    const allLineItemsCompleted = stableDoor.line_items.every(item => item.completed);
    
    return (
      <div className="mobile-section-spacing">
        <div className="door-detail-header">
          <button
            onClick={() => { setSelectedDoor(null); setCurrentView('overview'); }} // Clear selectedDoor on back
            className="door-detail-back-button"
          >
            <ArrowLeft className="icon-md" />
          </button>
          <div>
            <h1 className="mobile-text-xl mobile-font-bold">Door #{stableDoor.door_number}</h1>
            <p className="mobile-text-gray-600">{stableDoor.location}</p>
          </div>
        </div>

        <div className="mobile-card">
          <h3 className="mobile-font-semibold mb-2">Door Information</h3>
          <div className="mobile-section-spacing mobile-text-sm">
            <p><span className="mobile-font-medium">Type:</span> {stableDoor.door_type}</p>
            <p>
              <span className="mobile-font-medium">Dimensions:</span> 
              {stableDoor.width && stableDoor.height ? 
                `${stableDoor.width} × ${stableDoor.height} ${stableDoor.dimension_unit || ''}` : 
                'N/A'}
            </p>
            <p><span className="mobile-font-medium">Work:</span> {stableDoor.labor_description}</p>
            {stableDoor.notes && <p><span className="mobile-font-medium">Notes:</span> {stableDoor.notes}</p>}
          </div>
        </div>

        <div className="mobile-card">
          <h3 className="mobile-font-semibold mb-3">Work Items ({stableDoor.line_items.filter(i => i.completed).length} / {stableDoor.line_items.length})</h3>
          <div className="mobile-item-spacing">
            {stableDoor.line_items.map(item => (
              <div
                key={item.id}
                className={`line-item-checklist-item ${item.completed ? 'completed' : 'pending'} ${isDoorSignedOff ? 'disabled' : ''}`}
                onClick={() => !isDoorSignedOff && toggleLineItem(stableDoor.id, item.id)} // Prevent changes if door signed off
              >
                {item.completed ? (
                  <CheckSquare className="icon-md mobile-text-green-600 icon-flex-shrink-0" />
                ) : (
                  <Square className="icon-md mobile-text-gray-400 icon-flex-shrink-0" />
                )}
                <div style={{ flex: 1 }}>
                  <p className={`mobile-font-medium ${item.completed ? 'mobile-text-green-800 line-through' : 'mobile-text-gray-800'}`}>
                    {item.description}
                  </p>
                  <p className="mobile-text-sm mobile-text-gray-600">
                    Part: {item.part_number || 'N/A'} • Qty: {item.quantity}
                    {item.completed_at && <span className="mobile-text-xs block">Completed: {new Date(item.completed_at).toLocaleTimeString()}</span>}
                  </p>
                </div>
              </div>
            ))}
            {stableDoor.line_items.length === 0 && <p className="mobile-text-sm mobile-text-gray-500">No work items specified for this door.</p>}
          </div>
        </div>

        <div className="mobile-card">
          <h3 className="mobile-font-semibold mb-3">Documentation</h3>
          
          <div className="media-section">
            <div className="media-section-header">
              <h4 className="mobile-font-medium">Completion Photo</h4>
              <div className="media-status-indicator">
                {hasPhoto ? (
                  <span className="media-status-badge captured"><CheckCircle className="icon-sm" />Captured</span>
                ) : (
                  <span className="media-status-badge not-captured"><Camera className="icon-sm" />Required</span>
                )}
              </div>
            </div>
            
            {hasPhoto && absolutePhotoThumbnailUrl ? (
              <div className="media-preview-container">
                <div className="media-preview-thumbnail" onClick={handleViewPhoto} style={{cursor: 'pointer'}}>
                  <img
                    key={mediaKeys.photoKey} // Use stable key to prevent unnecessary reloads
                    src={absolutePhotoThumbnailUrl}
                    alt={`Door ${stableDoor.door_number} thumbnail`}
                    className="media-preview-image"
                    onError={(e) => { 
                      console.error('Failed to load photo thumbnail:', absolutePhotoThumbnailUrl); 
                      e.target.style.display = 'none'; 
                    }}
                  />
                  <div className="media-preview-overlay">
                    <span className="mobile-text-white mobile-text-sm">Tap to view</span>
                  </div>
                </div>
                <div className="media-preview-info">
                  <p className="mobile-text-xs mobile-text-gray-500">
                    ID: {photoInfo.id} <br/>
                    Uploaded: {photoInfo.uploaded_at ? new Date(photoInfo.uploaded_at).toLocaleString() : 'N/A'}
                  </p>
                  {!isDoorSignedOff && ( // Can only retake if door is not signed off
                    <button
                      onClick={() => { setCameraType('photo'); setShowCamera(true); }}
                      className="media-retake-button" disabled={uploading}
                    >
                      <Camera className="icon-sm" /> Retake
                    </button>
                  )}
                </div>
              </div>
            ) : (
              !isDoorSignedOff && ( // Can only capture if door is not signed off
                <button
                  onClick={() => { setCameraType('photo'); setShowCamera(true); }}
                  disabled={uploading} className="media-capture-button-large not-captured"
                >
                  <Camera className="icon-lg mobile-text-gray-400" />
                  <span className="mobile-font-medium">Capture Photo</span>
                  <span className="mobile-text-sm mobile-text-gray-500">Required for completion</span>
                </button>
              )
            )}
            {isDoorSignedOff && !hasPhoto && (
                <p className="mobile-text-sm mobile-text-gray-500">No photo captured for this completed door.</p>
            )}
          </div>

          <div className="media-section">
            <div className="media-section-header">
              <h4 className="mobile-font-medium">Operation Video</h4>
              <div className="media-status-indicator">
                {hasVideo ? (
                  <span className="media-status-badge captured"><CheckCircle className="icon-sm" />Recorded</span>
                ) : (
                  <span className="media-status-badge not-captured"><Video className="icon-sm" />Required</span>
                )}
              </div>
            </div>
            
            {hasVideo && absoluteVideoUrl ? (
              <div className="media-preview-container">
                <div className="media-preview-thumbnail video-thumbnail">
                  <video
                    key={mediaKeys.videoKey} // Use stable key to prevent unnecessary reloads
                    src={absoluteVideoUrl} 
                    controls 
                    playsInline 
                    muted 
                    width="100%"
                    className="media-preview-video"
                    preload="metadata" // Only load metadata initially to reduce server requests
                    onError={(e) => { 
                      console.error('Failed to load video preview:', absoluteVideoUrl); 
                      e.target.style.display = 'none'; 
                    }}
                    onLoadStart={() => {
                      // Log when video starts loading to help debug
                      console.log('Video loading started for:', absoluteVideoUrl);
                    }}
                    onCanPlay={() => {
                      // Log when video is ready to play
                      console.log('Video ready to play:', absoluteVideoUrl);
                    }}
                  />
                </div>
                <div className="media-preview-info">
                  <p className="mobile-text-xs mobile-text-gray-500">
                    ID: {videoInfo.id} <br/>
                    Uploaded: {videoInfo.uploaded_at ? new Date(videoInfo.uploaded_at).toLocaleString() : 'N/A'}
                  </p>
                  {!isDoorSignedOff && ( // Can only re-record if door is not signed off
                    <button
                      onClick={() => { setCameraType('video'); setShowCamera(true); }}
                      className="media-retake-button" disabled={uploading}
                    >
                      <Video className="icon-sm" /> Re-record
                    </button>
                  )}
                </div>
              </div>
            ) : (
              !isDoorSignedOff && ( // Can only record if door is not signed off
                <button
                  onClick={() => { setCameraType('video'); setShowCamera(true); }}
                  disabled={uploading} className="media-capture-button-large not-captured"
                >
                  <Video className="icon-lg mobile-text-gray-400" />
                  <span className="mobile-font-medium">Record Video</span>
                  <span className="mobile-text-sm mobile-text-gray-500">Required for completion</span>
                </button>
              )
            )}
            {isDoorSignedOff && !hasVideo && (
                <p className="mobile-text-sm mobile-text-gray-500">No video recorded for this completed door.</p>
            )}
          </div>
        </div>

        {!isDoorSignedOff && (
          <div className="mobile-card">
            <h3 className="mobile-font-semibold mb-3">Complete Door</h3>
            {isDoorReadyForCompletion(stableDoor) ? ( // Pass the stable door state
              <button onClick={handleCompleteDoor} disabled={uploading} className="mobile-button mobile-button-green">
                {uploading ? <Loader className="icon-md animate-spin" /> : <PenTool className="icon-md" />}
                {uploading ? 'Processing...' : 'Complete Door (Signature Required)'}
              </button>
            ) : (
              <div className="alert-warning-inline">
                <AlertTriangle className="icon-lg mobile-text-yellow-500 mx-auto mb-2" />
                <p className="mobile-text-sm mobile-text-gray-600 mb-2">Complete the following to finish this door:</p>
                <ul className="list-disc list-inside mobile-text-sm">
                  {!allLineItemsCompleted && <li>Complete all work items</li>}
                  {!hasPhoto && <li>Capture completion photo</li>}
                  {!hasVideo && <li>Record operation video</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {isDoorSignedOff && (
          <div className="mobile-card mobile-bg-green-50 mobile-border-green-200">
            <div className="flex-align-center flex-gap-2 mobile-text-green-800 mb-2">
              <CheckCircle className="icon-md" />
              <span className="mobile-font-semibold">Door Completed & Signed Off</span>
            </div>
            <p className="mobile-text-green-700 mobile-text-sm">
              This door's completion was recorded on {stableDoor.completed && photoInfo?.uploaded_at ? new Date(photoInfo.uploaded_at).toLocaleDateString() : 'N/A'}.
            </p>
          </div>
        )}

        {showPhotoViewer && photoViewerUrl && (
          <PhotoViewer photoUrl={photoViewerUrl} onClose={() => setShowPhotoViewer(false)} doorNumber={stableDoor.door_number} />
        )}
      </div>
    );
  };


  /**
   * Toggle line item completion status with comprehensive validation and error handling
   */
  const toggleLineItem = async (doorId, lineItemId) => {
    // Validate parameters
    if (!doorId || !lineItemId) {
      console.error("Missing required parameters for line item toggle:", {
        doorId,
        lineItemId,
      });
      alert("Error: Missing required information. Please try again.");
      return;
    }

    // Validate parameter types and values
    const doorIdNum = parseInt(doorId);
    const lineItemIdNum = parseInt(lineItemId);

    if (isNaN(doorIdNum) || doorIdNum <= 0) {
      console.error("Invalid door ID for line item toggle:", doorId);
      alert("Error: Invalid door ID. Please refresh and try again.");
      return;
    }

    if (isNaN(lineItemIdNum) || lineItemIdNum <= 0) {
      console.error("Invalid line item ID for toggle:", lineItemId);
      alert("Error: Invalid line item ID. Please refresh and try again.");
      return;
    }

    // Validate job data exists and job is started
    if (!jobData) {
      console.error("Cannot toggle line item: No job data available");
      alert("Error: Job data not loaded. Please refresh and try again.");
      return;
    }

    if (jobStatus !== "started") {
      console.warn("Cannot toggle line item for job that is not started");
      alert("Job must be started before modifying line items.");
      return;
    }

    if (jobStatus === "completed") {
      console.warn("Cannot modify line items for completed job");
      alert("Cannot modify line items for a completed job.");
      return;
    }

    // Find the specific door and line item
    const targetDoor = jobData.doors.find((door) => door.id === doorIdNum);
    if (!targetDoor) {
      console.error("Door not found in job data:", doorIdNum);
      alert("Error: Door not found. Please refresh and try again.");
      return;
    }

    // Check if door is already completed
    if (targetDoor.completed) {
      console.warn("Cannot modify line items for completed door");
      alert(
        `Door #${targetDoor.door_number} is already completed. Line items cannot be modified.`
      );
      return;
    }

    const targetLineItem = targetDoor.line_items.find(
      (item) => item.id === lineItemIdNum
    );
    if (!targetLineItem) {
      console.error("Line item not found in door data:", lineItemIdNum);
      alert("Error: Work item not found. Please refresh and try again.");
      return;
    }

    // Store current state for rollback if needed
    const originalCompletionState = targetLineItem.completed;
    const newCompletionState = !originalCompletionState;

    try {
      console.log(
        `Toggling line item ${lineItemIdNum} in door ${doorIdNum} from ${originalCompletionState} to ${newCompletionState}`
      );

      // Optimistically update local state for immediate UI response
      setJobData((prev) => ({
        ...prev,
        doors: prev.doors.map((door) =>
          door.id === doorIdNum
            ? {
                ...door,
                line_items: door.line_items.map((item) =>
                  item.id === lineItemIdNum
                    ? {
                        ...item,
                        completed: newCompletionState,
                        completed_at: newCompletionState
                          ? new Date().toISOString()
                          : null,
                      }
                    : item
                ),
              }
            : door
        ),
      }));

      // Also update selectedDoor if it matches the current door
      if (selectedDoor && selectedDoor.id === doorIdNum) {
        setSelectedDoor((prev) => ({
          ...prev,
          line_items: prev.line_items.map((item) =>
            item.id === lineItemIdNum
              ? {
                  ...item,
                  completed: newCompletionState,
                  completed_at: newCompletionState
                    ? new Date().toISOString()
                    : null,
                }
              : item
          ),
        }));
      }

      // Make API call to persist the change
      await mobileWorkerService.toggleLineItem(jobData.id, lineItemIdNum);

      console.log(
        `Line item ${lineItemIdNum} toggled successfully to ${newCompletionState}`
      );

      // Background refresh to ensure data consistency (optional, for critical accuracy)
      setTimeout(async () => {
        try {
          await loadJobData(false); // Force fresh data from API
          console.log("Job data refreshed after line item toggle");
        } catch (refreshError) {
          console.warn(
            "Failed to refresh job data after line item toggle:",
            refreshError
          );
          // Don't show error to user since toggle was successful
        }
      }, 2000);

      // Show subtle success feedback (optional - you might prefer no notification for quick actions)
      const action = newCompletionState ? "completed" : "uncompleted";
      console.log(`Work item "${targetLineItem.description}" ${action}`);
    } catch (error) {
      console.error("Error toggling line item:", error);

      // Rollback optimistic update on error
      setJobData((prev) => ({
        ...prev,
        doors: prev.doors.map((door) =>
          door.id === doorIdNum
            ? {
                ...door,
                line_items: door.line_items.map((item) =>
                  item.id === lineItemIdNum
                    ? {
                        ...item,
                        completed: originalCompletionState,
                        completed_at: originalCompletionState
                          ? targetLineItem.completed_at
                          : null,
                      }
                    : item
                ),
              }
            : door
        ),
      }));

      // Also rollback selectedDoor if it matches
      if (selectedDoor && selectedDoor.id === doorIdNum) {
        setSelectedDoor((prev) => ({
          ...prev,
          line_items: prev.line_items.map((item) =>
            item.id === lineItemIdNum
              ? {
                  ...item,
                  completed: originalCompletionState,
                  completed_at: originalCompletionState
                    ? targetLineItem.completed_at
                    : null,
                }
              : item
          ),
        }));
      }

      // Provide specific error messages based on error type
      let errorMessage = "Failed to update work item status";

      if (
        error.message.includes("401") ||
        error.message.includes("unauthorized")
      ) {
        errorMessage =
          "You are not authorized to modify work items. Please log in and try again.";
      } else if (
        error.message.includes("403") ||
        error.message.includes("forbidden")
      ) {
        errorMessage =
          "You do not have permission to modify work items for this job.";
      } else if (
        error.message.includes("404") ||
        error.message.includes("not found")
      ) {
        errorMessage =
          "Work item not found. It may have been deleted or the job may have been modified.";
      } else if (
        error.message.includes("409") ||
        error.message.includes("conflict")
      ) {
        errorMessage =
          "Work item was modified by another user. Please refresh and try again.";
      } else if (
        error.message.includes("Network") ||
        error.message.includes("fetch")
      ) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else {
        errorMessage = `Failed to update work item: ${error.message}`;
      }

      alert(errorMessage);

      // Store the failed action for later retry if offline
      if (!isOnline) {
        try {
          const pendingChangeData = {
            action: "toggle_line_item",
            jobId: jobData.id,
            doorId: doorIdNum,
            lineItemId: lineItemIdNum,
            doorNumber: targetDoor.door_number,
            lineItemDescription: targetLineItem.description,
            newCompletionState: newCompletionState,
            timestamp: new Date().toISOString(),
          };

          mobileWorkerService.storePendingChange(pendingChangeData);

          // Update UI to show the intended state even though it failed to sync
          setJobData((prev) => ({
            ...prev,
            doors: prev.doors.map((door) =>
              door.id === doorIdNum
                ? {
                    ...door,
                    line_items: door.line_items.map((item) =>
                      item.id === lineItemIdNum
                        ? {
                            ...item,
                            completed: newCompletionState,
                            completed_at: newCompletionState
                              ? new Date().toISOString()
                              : null,
                            pending_sync: true, // Add flag to indicate pending sync
                          }
                        : item
                    ),
                  }
                : door
            ),
          }));

          alert(
            "You are offline. Work item changes will be synced when connection is restored."
          );
        } catch (storeError) {
          console.error(
            "Failed to store pending line item change:",
            storeError
          );
          alert(
            "Failed to update work item and unable to store change for later sync."
          );
        }
      }
    }
  };

  /**
   * Calculate door completion progress
   */
  const getDoorProgress = (door) => {
    const completedItems = door.line_items.filter(
      (item) => item.completed
    ).length;
    return (completedItems / door.line_items.length) * 100;
  };

  const isDoorReadyForCompletion = (door) => {
    if (!door) return false;
    const allItemsCompleted = (door.line_items || []).every(
      (item) => item.completed
    );
    // Check against door.has_photo and door.has_video which are derived from photo_info/video_info
    return allItemsCompleted && door.has_photo && door.has_video;
  };

  /**
   * Check if job can be completed
   */
  const canCompleteJob = () => {
    return jobData && jobData.doors.every((door) => door.completed);
  };

  /**
   * Handle door completion
   */
  const handleCompleteDoor = () => {
    if (!isDoorReadyForCompletion(selectedDoor)) {
      alert(
        "Please complete all line items, capture a photo, and record a video before completing this door."
      );
      return;
    }
    setSignatureType("door_complete");
    setShowSignaturePad(true);
  };

  /**
   * Handle job completion
   */
  const handleCompleteJob = () => {
    if (!canCompleteJob()) {
      alert("Please complete all doors before finishing the job.");
      return;
    }
    setSignatureType("final");
    setShowSignaturePad(true);
  };

  /**
   * Refresh job data
   */
  const handleRefresh = () => {
    loadJobData(false);
  };

  // CONDITIONAL RENDERING LOGIC - AFTER ALL HOOKS ARE DEFINED

  // Validate required jobId prop
  if (!jobId) {
    return (
      <div
        className="mobile-job-worker-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "1rem",
        }}
      >
        <div
          className="mobile-card"
          style={{ width: "100%", maxWidth: "28rem" }}
        >
          <AlertTriangle className="icon-xxl mobile-text-red-500 mx-auto mb-4" />
          <h2 className="mobile-text-lg mobile-font-semibold text-center mb-2">
            No Job Selected
          </h2>
          <p className="mobile-text-gray-600 text-center mb-4">
            Please select a job to work on from the job list.
          </p>
        </div>
      </div>
    );
  }

  /**
   * Loading state component
   */
  if (loading) {
    return (
      <div
        className="mobile-job-worker-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div className="text-center">
          <Loader className="icon-lg mobile-loader animate-spin mobile-text-blue-600" />
          <p className="mobile-text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  /**
   * Error state component
   */
  if (error) {
    return (
      <div
        className="mobile-job-worker-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "1rem",
        }}
      >
        <div
          className="mobile-card"
          style={{ width: "100%", maxWidth: "28rem" }}
        >
          <AlertTriangle className="icon-xxl mobile-text-red-500 mx-auto mb-4" />
          <h2 className="mobile-text-lg mobile-font-semibold text-center mb-2">
            Error Loading Job
          </h2>
          <p className="mobile-text-gray-600 text-center mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="mobile-button mobile-button-blue"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /**
   * Job Overview Component - Main dashboard view
   */
  const JobOverview = () => (
    <div className="mobile-section-spacing">
      {/* Job Header Card */}
      <div className="mobile-card">
        <div className="job-overview-header">
          <h1 className="mobile-text-xl mobile-font-bold">
            Job #{jobData.job_number}
          </h1>
          <span
            className={`job-overview-status-badge ${(jobStatus || '').replace( // Force to empty string if null/undefined
              "_",
              "-"
            )}`}
          >
            {jobStatus === "not_started"
              ? "Not Started"
              : jobStatus === "started"
              ? "In Progress"
              : "Completed"}
          </span>
        </div>

        {/* Enhanced Time Display */}
        {jobTimingStatus !== 'not_started' && (
          <div className="mobile-card mobile-bg-blue-50 mobile-border-blue-200 mb-3">
            <div className="mobile-section-spacing">
              <div className="flex-align-center flex-gap-2 mobile-text-blue-800 mb-2">
                <Clock className="icon-md" />
                <span className="mobile-font-semibold">Time Tracking</span>
                <span className={`mobile-text-xs px-2 py-1 rounded ${
                  jobTimingStatus === 'active' ? 'mobile-bg-green-200 mobile-text-green-800' :
                  jobTimingStatus === 'paused' ? 'mobile-bg-yellow-200 mobile-text-yellow-800' :
                  'mobile-bg-gray-200 mobile-text-gray-800'
                }`}>
                  {jobTimingStatus === 'active' ? 'ACTIVE' : 
                  jobTimingStatus === 'paused' ? 'PAUSED' : 
                  (jobTimingStatus || '').toUpperCase()}
                </span>
              </div>
              
              {/* Total Job Time */}
              <div className="mb-2">
                <span className="mobile-text-sm mobile-text-blue-700">Total Job Time: </span>
                <span className="mobile-font-mono mobile-font-semibold mobile-text-blue-800 mobile-text-lg">
                  {formatTime(totalJobTime)}
                </span>
              </div>
              
              {/* Current Session Time */}
              {jobTimingStatus === 'active' && (
                <div className="mb-2">
                  <span className="mobile-text-sm mobile-text-blue-700">Current Session: </span>
                  <span className="mobile-font-mono mobile-font-semibold mobile-text-blue-800">
                    {formatTime(currentSessionTime)}
                  </span>
                </div>
              )}
              
              {/* Session Information */}
              {timeTrackingData && (
                <div className="flex-align-center flex-gap-4 mobile-text-sm mobile-text-blue-700">
                  {timeTrackingData.session_count > 0 && (
                    <div>
                      <span>Sessions: {timeTrackingData.session_count}</span>
                    </div>
                  )}
                  {timeTrackingData.total_hours > 0 && (
                    <div>
                      <span>Total Hours: {timeTrackingData.total_hours.toFixed(1)}h</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Session Started Time */}
              {jobTimingStatus === 'active' && startTime && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <span className="mobile-text-xs mobile-text-blue-600">
                    Session started: {new Date(startTime).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legacy single timer display for backwards compatibility */}
        {jobStatus === "started" && jobTimingStatus === 'not_started' && (
          <div className="flex-align-center flex-gap-2 mobile-text-blue-600 mb-2">
            <Clock className="icon-sm" />
            <span className="mobile-font-mono">{formatTime(elapsedTime)}</span>
          </div>
        )}

        <div className="mobile-section-spacing mobile-text-sm">
          <div className="job-overview-info-item">
            <User className="icon-sm mobile-text-gray-500" />
            <span>{jobData.customer_name}</span>
          </div>
          <div className="job-overview-info-item">
            <MapPin className="icon-sm mobile-text-gray-500" />
            <span>{jobData.address}</span>
          </div>
          <div className="job-overview-info-item">
            <Phone className="icon-sm mobile-text-gray-500" />
            <span>
              {jobData.contact_name} • {jobData.phone}
            </span>
          </div>
        </div>

        {jobData.job_scope && (
          <div className="job-overview-scope">
            <div className="flex-align-center flex-gap-2 mb-1">
              <FileText className="icon-sm mobile-text-gray-500" />
              <span className="mobile-font-medium mobile-text-sm">
                Scope of Work
              </span>
            </div>
            <p className="mobile-text-sm mobile-text-gray-700">
              {jobData.job_scope}
            </p>
          </div>
        )}
      </div>

      {/* Enhanced Action Button Section */}
      {jobStatus === "not_started" && (
        <button
          onClick={handleStartJob}
          disabled={uploading}
          className="mobile-button mobile-button-green"
        >
          {uploading ? (
            <Loader className="icon-md animate-spin" />
          ) : (
            <Play className="icon-md" />
          )}
          {uploading ? "Starting..." : "Start Job"}
        </button>
      )}

      {jobStatus === "started" && (
        <div className="mobile-item-spacing">
          {/* Time Control Buttons */}
          <div className="mobile-card mobile-bg-blue-50 mobile-border-blue-200">
            <div className="flex-align-center flex-gap-2 mobile-text-blue-800 mb-3">
              <Clock className="icon-md" />
              <span className="mobile-font-semibold">Job Time Control</span>
            </div>
            
            <div className="mobile-item-spacing">
              {jobTimingStatus === 'active' ? (
                <button
                  onClick={handlePauseJob}
                  disabled={uploading}
                  className="mobile-button mobile-button-orange"
                >
                  {uploading ? (
                    <Loader className="icon-md animate-spin" />
                  ) : (
                    <Pause className="icon-md" />
                  )}
                  {uploading ? "Pausing..." : "Pause Job"}
                </button>
              ) : jobTimingStatus === 'paused' ? (
                <button
                  onClick={handleResumeJob}
                  disabled={uploading}
                  className="mobile-button mobile-button-blue"
                >
                  {uploading ? (
                    <Loader className="icon-md animate-spin" />
                  ) : (
                    <Play className="icon-md" />
                  )}
                  {uploading ? "Resuming..." : "Resume Job"}
                </button>
              ) : (
                <div className="mobile-text-sm mobile-text-blue-700">
                  <p>Job is started but no active time tracking.</p>
                  <button
                    onClick={handleResumeJob}
                    disabled={uploading}
                    className="mobile-button mobile-button-blue mt-2"
                  >
                    {uploading ? (
                      <Loader className="icon-md animate-spin" />
                    ) : (
                      <Play className="icon-md" />
                    )}
                    {uploading ? "Starting Timer..." : "Start Timer"}
                  </button>
                </div>
              )}
            </div>
            
            {/* Quick time summary */}
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="flex-align-center flex-gap-4 mobile-text-sm mobile-text-blue-700">
                <span>Today: {formatTime(currentSessionTime)}</span>
                <span>Total: {formatTime(totalJobTime)}</span>
              </div>
            </div>
          </div>
          
          {/* Legacy job progress card - kept for consistency */}
          {jobTimingStatus === 'not_started' && (
            <div className="mobile-card mobile-bg-blue-50 mobile-border-blue-200">
              <div className="flex-align-center flex-gap-2 mobile-text-blue-800 mb-2">
                <Clock className="icon-md" />
                <span className="mobile-font-semibold">Job in Progress</span>
              </div>
              <p className="mobile-text-blue-700 mobile-text-sm">
                Started:{" "}
                {startTime ? new Date(startTime).toLocaleTimeString() : "N/A"}
              </p>
              <p className="mobile-text-blue-700 mobile-text-sm">
                Elapsed: {formatTime(elapsedTime)}
              </p>
            </div>
          )}
        </div>
      )}

      {jobStatus === "completed" && (
        <div className="mobile-card mobile-bg-green-50 mobile-border-green-200">
          <div className="flex-align-center flex-gap-2 mobile-text-green-800 mb-2">
            <CheckCircle className="icon-md" />
            <span className="mobile-font-semibold">Job Completed</span>
          </div>
          
          {/* Show total time for completed job */}
          {timeTrackingData && timeTrackingData.total_minutes > 0 && (
            <div className="mb-2">
              <p className="mobile-text-green-700 mobile-text-sm">
                Total Time: {formatTime(totalJobTime)} ({timeTrackingData.total_hours.toFixed(1)} hours)
              </p>
              {timeTrackingData.session_count > 1 && (
                <p className="mobile-text-green-700 mobile-text-sm">
                  Completed in {timeTrackingData.session_count} work sessions
                </p>
              )}
            </div>
          )}
          
          <button
            onClick={() => setCurrentView("summary")}
            className="mobile-button mobile-button-green"
            style={{ marginTop: "0.5rem" }}
          >
            View Summary
          </button>
        </div>
      )}

      {/* Doors List */}
      <div className="mobile-item-spacing">
        <h2 className="mobile-text-lg mobile-font-semibold">
          Doors ({jobData.doors.length})
        </h2>

        {jobData.doors.map((door) => {
          const progress = getDoorProgress(door);
          const isCompleted = door.completed;

          return (
            <div
              key={door.id}
              className={`door-list-item-card ${
                jobStatus === "not_started" ? "disabled" : ""
              }`}
              onClick={() => {
                if (jobStatus !== "not_started") {
                  setSelectedDoor(door);
                  setCurrentView("door_detail");
                }
              }}
            >
              <div className="door-list-header">
                <div className="door-list-title-group">
                  <span className="mobile-font-semibold">
                    Door #{door.door_number}
                  </span>
                  {isCompleted && (
                    <CheckCircle className="icon-md mobile-text-green-600" />
                  )}
                </div>
                <ChevronRight className="icon-md mobile-text-gray-400" />
              </div>

              <p className="mobile-text-sm mobile-text-gray-600 mb-2">
                {door.location}
              </p>
              <p className="mobile-text-sm mobile-text-gray-500 mb-3">
                {door.labor_description}
              </p>

              <div className="mobile-section-spacing">
                <div className="door-list-progress-text">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="door-list-progress-bar-bg">
                  <div
                    className={`door-list-progress-bar-fg ${
                      isCompleted ? "completed" : "in-progress"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Complete Job Button */}
      {jobStatus === "started" && canCompleteJob() && (
        <button
          onClick={handleCompleteJob}
          disabled={uploading}
          className="mobile-button mobile-button-green"
        >
          {uploading ? (
            <Loader className="icon-md animate-spin" />
          ) : (
            <CheckCircle className="icon-md" />
          )}
          {uploading ? "Completing..." : "Complete Job"}
        </button>
      )}
    </div>
  );

  /**
   * Job Summary Component - Final summary and documentation
   */
  const JobSummary = () => {
    const totalTime = formatTime(elapsedTime);

    return (
      <div className="mobile-section-spacing">
        {/* Header */}
        <div className="door-detail-header">
          <button
            onClick={() => setCurrentView("overview")}
            className="door-detail-back-button"
          >
            <ArrowLeft className="icon-md" />
          </button>
          <h1 className="mobile-text-xl mobile-font-bold">Job Summary</h1>
        </div>

        {/* Job Overview Card */}
        <div className="mobile-card">
          <h3 className="mobile-font-semibold mb-3">Job Overview</h3>
          <div className="mobile-section-spacing mobile-text-sm">
            <p>
              <span className="mobile-font-medium">Job Number:</span>{" "}
              {jobData.job_number}
            </p>
            <p>
              <span className="mobile-font-medium">Customer:</span>{" "}
              {jobData.customer_name}
            </p>
            <p>
              <span className="mobile-font-medium">Total Time:</span>{" "}
              {totalTime}
            </p>
            <p>
              <span className="mobile-font-medium">Doors Completed:</span>{" "}
              {jobData.doors.filter((d) => d.completed).length}/
              {jobData.doors.length}
            </p>
          </div>
        </div>

        {/* Completed Doors Summary */}
        <div className="mobile-card">
          <h3 className="mobile-font-semibold mb-3">Completed Work</h3>
          <div className="mobile-item-spacing">
            {jobData.doors.map((door) => {
              if (!door.completed) return null;

              const completedItems = door.line_items.filter(
                (item) => item.completed
              );

              return (
                <div
                  key={door.id}
                  className="mobile-card"
                  style={{ padding: "0.75rem" }}
                >
                  <div className="flex-align-center flex-gap-2 mb-2">
                    <CheckCircle className="icon-md mobile-text-green-600" />
                    <span className="mobile-font-medium">
                      Door #{door.door_number} - {door.location}
                    </span>
                  </div>
                  <p className="mobile-text-sm mobile-text-gray-600 mb-2">
                    {door.labor_description}
                  </p>
                  <div className="mobile-text-sm">
                    <p className="mobile-font-medium mb-1">
                      Items Completed ({completedItems.length}):
                    </p>
                    <ul
                      style={{ listStyle: "none", padding: 0 }}
                      className="mobile-item-spacing mobile-text-gray-600"
                    >
                      {completedItems.map((item) => (
                        <li key={item.id}>• {item.description}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Completion Status */}
        <div className="mobile-card mobile-bg-green-50 mobile-border-green-200 text-center">
          <CheckCircle className="icon-xxl mobile-text-green-600 mx-auto mb-2" />
          <h3 className="mobile-font-semibold mobile-text-green-800 mb-1">
            Job Complete!
          </h3>
          <p className="mobile-text-green-700 mobile-text-sm">
            All work has been completed and documented.
          </p>
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="mobile-job-worker-container">
      {/* Status Bar */}
      <div className="mobile-job-worker-status-bar">
        <div className="status-bar-left">
          <div
            className={`status-indicator-dot ${jobStatus.replace("_", "-")}`}
          />
          <span className="status-bar-brand">Scott Overhead Doors</span>
          <div className="status-bar-network">
            {isOnline ? (
              <Wifi className="icon-sm network-icon-online" />
            ) : (
              <WifiOff className="icon-sm network-icon-offline" />
            )}
            {pendingSync && (
              <RefreshCw className="icon-sm sync-icon animate-spin" />
            )}
          </div>
        </div>
        <div className="status-bar-right">
          {jobStatus === "started" && (
            <div className="status-bar-timer">
              <Clock className="icon-sm" />
              <span>{formatTime(elapsedTime)}</span>
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={!isOnline || loading}
            className="status-bar-refresh-btn"
          >
            <RefreshCw className={`icon-sm ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="mobile-job-worker-offline-indicator">
          <p>Working offline. Changes will sync when connection is restored.</p>
        </div>
      )}

      {/* Main Content */}
      <div className="mobile-job-worker-main-content">
        {currentView === "overview" && <JobOverview />}
        {currentView === "door_detail" && <DoorDetail />}
        {currentView === "summary" && <JobSummary />}
      </div>

      {/* Modals */}
      {showStartOptions && (
        <StartJobOptionsModal
          onSelect={handleStartOptionSelect}
          onCancel={() => setShowStartOptions(false)}
        />
      )}

      {showResumeOptions && (
        <StartJobOptionsModal
          title="Resume Job"
          onSelect={handleResumeOptionSelect}
          onCancel={() => setShowResumeOptions(false)}
        />
      )}

      {showPauseOptions && (
        <PauseJobOptionsModal
          onSelect={handlePauseOptionSelect}
          onCancel={() => setShowPauseOptions(false)}
          workSummary={currentWorkSummary}
        />
      )}

      {showSignaturePad && (
        <SignaturePad
          onSave={handleSignatureSave}
          onCancel={() => {
            setShowSignaturePad(false);
            // Clear work summary when canceling pause signature
            if (signatureType === "pause") {
              setCurrentWorkSummary(null);
            }
          }}
          title={
            signatureType === "start"
              ? "Start Job Signature"
              : signatureType === "pause"
              ? "Pause Job Signature"
              : signatureType === "resume"
              ? "Resume Job Signature"
              : signatureType === "door_complete"
              ? "Door Completion Signature"
              : "Final Job Completion Signature"
          }
          workSummary={signatureType === "pause" ? currentWorkSummary : null}
        />
      )}

      {showCamera && (
        <CameraCapture
          onCapture={handleMediaCapture}
          onCancel={() => setShowCamera(false)}
          type={cameraType}
        />
      )}

      {/* Upload Progress Overlay */}
      {uploading && (
        <div className="mobile-modal-overlay">
          <div className="uploading-overlay-content">
            <Loader className="icon-lg animate-spin mobile-text-blue-600" />
            <span className="mobile-font-medium">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileJobWorker;