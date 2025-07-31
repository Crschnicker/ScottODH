import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Alert,
  Row,
  Col,
  Spinner,
  ListGroup,
  Form,
  InputGroup,
} from "react-bootstrap";
import {
  FaArrowLeft,
  FaCheck,
  FaVolumeUp,
  FaTrash,
  FaServer,
  FaSync,
  FaEdit,
  FaSave,
  FaTimes,
} from "react-icons/fa";
import AudioRecorder from "../components/audio/AudioRecorder";
import {
  getEstimate,
  // eslint-disable-next-line
  updateEstimateWithDoors,
} from "../services/estimateService";
import { getCustomer } from "../services/customerService";
import {
  getAudioRecordings,
  transcribeAudio,
  processAudioWithAI,
  deleteAudio,
} from "../services/audioService";
import { createBid, addDoorsToBid } from "../services/bidService";
import api from "../services/api"; // Add this import
import "./EstimateInProgress.css";

const EstimateInProgress = () => {
  const { estimateId } = useParams();
  const navigate = useNavigate();

  // State management
  const [estimate, setEstimate] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [doors, setDoors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState("");
  const [savingDoors, setSavingDoors] = useState(false);
  const [doorsUpdated, setDoorsUpdated] = useState(false);

  // Edit mode state
  const [editingDoorId, setEditingDoorId] = useState(null);
  const [editingDoorDetails, setEditingDoorDetails] = useState([]);
  const [editingDoorDescription, setEditingDoorDescription] = useState("");

  // Audio playback state
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);


  /**
   * Safely execute API call with error handling
   * @param {Function} apiCall - The API function to call
   * @param {string} errorMessage - Custom error message to display
   * @param {Function} onSuccess - Callback for successful API call
   * @param {boolean} isCritical - If true, sets connectionError state on failure
   * @returns {Promise<any>} - The API call result or null on error
   */
  const safeApiCall = useCallback(
    async (apiCall, errorMessage, onSuccess, isCritical = false) => {
      try {
        const result = await apiCall();
        if (onSuccess && typeof onSuccess === "function") {
          onSuccess(result);
        }
        return result;
      } catch (err) {
        console.error(`${errorMessage}:`, err);

        // Determine if this is a network/connection error
        const isNetworkError =
          err.message === "Network Error" ||
          err.code === "ERR_NETWORK" ||
          !err.response;

        if (isNetworkError && isCritical) {
          setConnectionError(true);
          setError(
            "Unable to connect to the server. Please check that the backend is running and try again."
          );
        } else {
          setError(`${errorMessage}: ${err.message || "Unknown error"}`);
        }

        return null;
      }
    },
    []
  );

  // Define loadData using useCallback to prevent infinite loops with useEffect
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConnectionError(false);

    // Get estimate data
    const estimateData = await safeApiCall(
      () => getEstimate(estimateId),
      "Failed to load estimate data",
      (data) => setEstimate(data),
      true // Critical - set connection error if this fails
    );

    // If estimate loaded successfully, get customer data
    if (estimateData && estimateData.customer_id) {
      await safeApiCall(
        () => getCustomer(estimateData.customer_id),
        "Failed to load customer data",
        (data) => setCustomer(data)
      );
    }

    // Try to load recordings (non-critical)
    await safeApiCall(
      () => getAudioRecordings(estimateId),
      "Failed to load audio recordings",
      (data) => setRecordings(data || [])
    );

    // If the estimate has saved doors, load them
    if (estimateData && estimateData.doors && estimateData.doors.length > 0) {
      setDoors(estimateData.doors);
    }

    setLoading(false);
  }, [estimateId, safeApiCall]);

  // Load data when component mounts or estimateId changes
  useEffect(() => {
    if (estimateId) {
      loadData();
    }

    // Cleanup function for audio
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = "";
      }
    };
  }, [estimateId, currentAudio, loadData]);

  /**
   * Handle retrying data load after connection error
   */
  const handleRetry = () => {
    loadData();
  };

  /**
   * Enhanced saveDoorsToEstimate function with CORS-safe headers and improved error handling
   * This fixes the CORS issues and connection problems from the original implementation
   */
  const saveDoorsToEstimate = async (doorsToSave = null) => {
    setSavingDoors(true);
    setError(null);
    
    // Use a ref to store the most current doors data to avoid stale state issues
    const getCurrentDoors = () => {
      if (doorsToSave) {
        return doorsToSave;
      }
      return doors;
    };

    let validDoors = [];
    let retryCount = 0;
    const maxRetries = 5;
    
    try {
      // Enhanced: Get the most current doors data with better fallback logic
      let doorsData = getCurrentDoors();
      
      console.log(`[SAVE DOORS] Starting save operation with ${doorsData?.length || 0} doors`);
      
      // Enhanced validation with better error messages and logging
      if (!doorsData || !Array.isArray(doorsData) || doorsData.length === 0) {
        const errorMsg = !doorsData
          ? "No door data available - state may not be properly initialized"
          : !Array.isArray(doorsData)
          ? `Invalid door data format - expected array, got ${typeof doorsData}`
          : "No doors to save - please add doors first by recording audio";

        console.error(`[SAVE DOORS] Validation failed:`, {
          doorsData: doorsData,
          isArray: Array.isArray(doorsData),
          length: doorsData?.length,
          type: typeof doorsData
        });

        setError(errorMsg);
        setSavingDoors(false);
        return null;
      }

      // Enhanced: Validate individual door objects with comprehensive checks
      const invalidDoors = doorsData.filter((door, index) => {
        if (!door || typeof door !== 'object') {
          console.warn(`[SAVE DOORS] Door at index ${index} is not a valid object:`, door);
          return true;
        }
        return false;
      });

      if (invalidDoors.length > 0) {
        setError(`Found ${invalidDoors.length} invalid door objects. Please refresh and try again.`);
        setSavingDoors(false);
        return null;
      }

      // Enhanced: Validate and normalize each door object
      validDoors = doorsData.map((door, index) => {
        // Generate consistent ID if missing
        const doorId = door.id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Ensure door_number is valid
        let doorNumber = door.door_number;
        if (!doorNumber || isNaN(parseInt(doorNumber))) {
          doorNumber = index + 1;
          console.warn(`[SAVE DOORS] Door at index ${index} missing/invalid door_number, assigned: ${doorNumber}`);
        }

        // Ensure description exists
        let description = door.description;
        if (!description || description.trim() === '') {
          description = `Door #${doorNumber}`;
          console.warn(`[SAVE DOORS] Door at index ${index} missing description, assigned: ${description}`);
        }

        // Ensure details is an array and filter out empty strings
        let details = door.details;
        if (!Array.isArray(details)) {
          details = details ? [String(details)] : [];
          console.warn(`[SAVE DOORS] Door at index ${index} had non-array details, converted to array`);
        }
        details = details.filter(detail => detail && String(detail).trim() !== '');

        const validatedDoor = {
          id: doorId,
          door_number: parseInt(doorNumber),
          description: description.trim(),
          details: details
        };

        console.log(`[SAVE DOORS] Validated door ${index + 1}:`, validatedDoor);
        return validatedDoor;
      });

      // Main save operation with enhanced retry logic and CORS-safe headers
      const attemptSave = async (attempt) => {
        console.log(`[SAVE DOORS] Save attempt ${attempt + 1}/${maxRetries + 1} for estimate ${estimateId}...`);
        
        // Pre-save connectivity check for ngrok tunnels (simplified to avoid CORS)
        if (api.defaults?.baseURL?.includes("ngrok")) {
          console.log(`[SAVE DOORS] Ngrok tunnel detected`);
          setSubmissionProgress("Saving to ngrok tunnel...");
        } else {
          setSubmissionProgress("Saving doors to estimate...");
        }

        // Enhanced: Create the exact payload structure the backend expects
        const requestPayload = {
          doors: validDoors,
          metadata: {
            timestamp: new Date().toISOString(),
            attempt: attempt + 1,
            clientId: `client-${Date.now()}`,
            doorsCount: validDoors.length
          }
        };

        console.log(`[SAVE DOORS] Making API call with payload:`, requestPayload);

        // Enhanced: Dynamic timeout based on attempt and request size
        const baseTimeout = 30000; // 30 seconds base
        const requestSize = JSON.stringify(requestPayload).length;
        let timeout = baseTimeout;
        
        // Increase timeout for large requests
        if (requestSize > 50000) {
          timeout = Math.max(timeout, 45000);
        }
        
        // Increase timeout for ngrok tunnels
        if (api.defaults?.baseURL?.includes("ngrok")) {
          timeout = Math.max(timeout, 40000);
        }
        
        // Decrease timeout for retry attempts (fail faster on retries)
        if (attempt > 0) {
          timeout = Math.max(15000, timeout - (attempt * 5000));
        }

        console.log(`[SAVE DOORS] Using timeout: ${timeout}ms for attempt ${attempt + 1}`);

        // Enhanced: Make the API call with CORS-safe headers only
        const response = await api.put(
          `/estimates/${estimateId}/doors`,
          requestPayload,
          {
            headers: {
              // Only CORS-safe headers - removed custom headers causing preflight issues
              "Content-Type": "application/json",
              "Accept": "application/json",
              "Cache-Control": "no-cache"
              // Removed: X-Request-ID, X-Retry-Attempt, X-Client-Timestamp, Connection
              // These headers were causing CORS preflight failures
            },
            timeout: timeout,
            validateStatus: function (status) {
              return status >= 200 && status < 300;
            },
            // Enhanced: Add retry-specific configuration
            retry: false, // Disable axios-retry if it's configured, we handle retries manually
            // Add metadata for debugging (internal, not sent as header)
            metadata: {
              operation: 'save-doors',
              doorCount: validDoors.length,
              estimateId: estimateId,
              attempt: attempt + 1,
              timestamp: new Date().toISOString()
            }
          }
        );

        return response;
      };

      // Main retry loop with exponential backoff and enhanced error handling
      let lastError = null;
      let response = null;

      for (retryCount = 0; retryCount <= maxRetries; retryCount++) {
        try {
          response = await attemptSave(retryCount);
          
          // If we get here, the request succeeded
          console.log(`[SAVE DOORS] API response status: ${response.status}`, response.data);
          break;
          
        } catch (err) {
          lastError = err;
          console.error(`[SAVE DOORS] Attempt ${retryCount + 1} failed:`, err.message);

          // Enhanced error classification for better retry decisions
          const isRetryableError = (
            err.code === 'ERR_NETWORK' ||
            err.code === 'ECONNABORTED' ||
            err.message === 'Network Error' ||
            err.message.includes('timeout') ||
            err.message.includes('ECONNRESET') ||
            err.message.includes('ECONNREFUSED') ||
            (err.response && err.response.status >= 500) ||
            (err.response && err.response.status === 502) || // Bad Gateway
            (err.response && err.response.status === 503) || // Service Unavailable
            (err.response && err.response.status === 504) || // Gateway Timeout
            !err.response // No response received
          );

          // Enhanced CORS error handling - don't retry CORS errors
          const isCorsError = err.message.includes('CORS') || 
                            err.message.includes('Access-Control') ||
                            err.message.includes('preflight');

          if (isCorsError) {
            console.error(`[SAVE DOORS] CORS error detected - not retrying:`, err.message);
            setError(`CORS configuration issue: The server is blocking this request. Please check the backend CORS settings.`);
            break; // Don't retry CORS errors
          }

          // Don't retry on client errors (4xx) except for specific cases
          if (err.response && err.response.status >= 400 && err.response.status < 500) {
            if (err.response.status !== 408 && err.response.status !== 429) { // Timeout and Rate Limit are retryable
              console.log(`[SAVE DOORS] Non-retryable client error: ${err.response.status}`);
              break;
            }
          }

          if (!isRetryableError || retryCount >= maxRetries) {
            console.log(`[SAVE DOORS] Not retrying: retryable=${isRetryableError}, retryCount=${retryCount}, maxRetries=${maxRetries}`);
            break;
          }

          // Calculate delay with exponential backoff and jitter
          const baseDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Cap at 10 seconds
          const jitter = Math.random() * 1000; // Add up to 1 second of jitter
          const delay = baseDelay + jitter;

          // Additional delay for ngrok tunnels
          const finalDelay = api.defaults?.baseURL?.includes('ngrok') ? delay * 1.2 : delay;

          console.log(`[SAVE DOORS] Retrying in ${Math.round(finalDelay)}ms... (attempt ${retryCount + 2}/${maxRetries + 1})`);
          setSubmissionProgress(`Retry ${retryCount + 1}/${maxRetries} in ${Math.round(finalDelay/1000)}s...`);

          // Check online status before retry
          if (!navigator.onLine) {
            console.error(`[SAVE DOORS] Browser is offline, extending delay`);
            await new Promise(resolve => setTimeout(resolve, finalDelay * 2));
          } else {
            await new Promise(resolve => setTimeout(resolve, finalDelay));
          }

          // Update progress for next attempt
          setSubmissionProgress(`Retrying save operation (${retryCount + 2}/${maxRetries + 1})...`);
        }
      }

      // Check if all attempts failed
      if (!response) {
        throw lastError || new Error('All retry attempts failed');
      }

      // Enhanced: Validate response structure and success
      if (response.status >= 200 && response.status < 300 && response.data) {
        const responseData = response.data;

        // Check if backend explicitly indicates failure
        if (responseData.success === false) {
          const errorMsg = responseData.error || responseData.message || "Server indicated save failed";
          console.error(`[SAVE DOORS] Backend returned failure response:`, responseData);
          setError(`Failed to save doors: ${errorMsg}`);
          setSubmissionProgress("");
          return null;
        }

        // Enhanced: Update local state with a state updater function to ensure latest state
        if (!doorsToSave) {
          console.log(`[SAVE DOORS] Updating local state with saved doors`);
          setDoors(prevDoors => {
            // Only update if the current state is different from what we just saved
            if (JSON.stringify(prevDoors) !== JSON.stringify(validDoors)) {
              console.log(`[SAVE DOORS] State updated with ${validDoors.length} doors`);
              return validDoors;
            }
            return prevDoors;
          });
        }

        setDoorsUpdated(true);
        setSubmissionProgress("Doors saved successfully!");

        // Reset success indicator and progress after delay
        setTimeout(() => {
          setDoorsUpdated(false);
          setSubmissionProgress("");
        }, 3000);

        console.log(`[SAVE DOORS] Successfully saved ${validDoors.length} doors after ${retryCount + 1} attempts`);
        
        return {
          ...responseData,
          doors: validDoors,
          doorCount: validDoors.length,
          attemptsUsed: retryCount + 1
        };
      } else {
        // Handle unexpected response structure
        const errorMsg = response.data?.error || 
                        response.data?.message || 
                        `Unexpected response status: ${response.status}`;
        console.error(`[SAVE DOORS] Unexpected response:`, {
          status: response.status,
          data: response.data,
          headers: response.headers
        });
        setError(`Failed to save doors: ${errorMsg}`);
        setSubmissionProgress("");
        return null;
      }

    } catch (err) {
      // Enhanced error handling with comprehensive user guidance
      console.error("[SAVE DOORS] Save operation failed after all retries:", err);

      let userFriendlyError;
      let troubleshootingTips = [];
      let errorCode = 'UNKNOWN_ERROR';

      // Handle different types of errors with specific user guidance
      if (err.response) {
        // Server responded with an error status
        const status = err.response.status;
        const errorData = err.response.data;

        console.error("[SAVE DOORS] Server error response:", {
          status: status,
          data: errorData,
          headers: err.response.headers,
          attemptsUsed: retryCount + 1
        });

        if (status === 400) {
          userFriendlyError = errorData?.error || errorData?.message || "Invalid request data";
          errorCode = 'INVALID_DATA';
          troubleshootingTips = [
            "The door data format may be invalid",
            "Try refreshing the page and re-adding doors",
            "Check that all doors have valid information",
            `Attempted to save ${validDoors?.length || 0} doors`
          ];
        } else if (status === 401) {
          userFriendlyError = "Authentication required";
          errorCode = 'AUTH_REQUIRED';
          troubleshootingTips = ["Please refresh the page and log in again"];
        } else if (status === 404) {
          userFriendlyError = `Estimate not found (ID: ${estimateId})`;
          errorCode = 'ESTIMATE_NOT_FOUND';
          troubleshootingTips = [
            "The estimate may have been deleted",
            "Try refreshing the page",
            "Navigate back to estimates list and try again"
          ];
        } else if (status === 422) {
          userFriendlyError = "Data validation failed on server";
          errorCode = 'VALIDATION_FAILED';
          troubleshootingTips = [
            "The door data doesn't match server requirements",
            "Try refreshing and re-entering door information",
            "Check that all required fields are filled"
          ];
        } else if (status >= 500) {
          userFriendlyError = `Server error (${status})`;
          errorCode = 'SERVER_ERROR';
          troubleshootingTips = [
            "This is a temporary server issue",
            "Try again in a few moments",
            "Contact support if the problem persists"
          ];
        } else {
          userFriendlyError = errorData?.error || errorData?.message || `Server error (${status})`;
          errorCode = 'HTTP_ERROR';
          troubleshootingTips = [
            "Try refreshing the page",
            "Contact support if the problem persists",
            `HTTP Status: ${status}`
          ];
        }
      } else if (err.request) {
        // Request was made but no response received (network issues)
        console.error("[SAVE DOORS] No response received:", err.request);

        // Enhanced CORS error detection and handling
        if (err.message.includes('CORS') || err.message.includes('Access-Control') || err.message.includes('preflight')) {
          userFriendlyError = "CORS policy violation";
          errorCode = 'CORS_ERROR';
          troubleshootingTips = [
            "The server is blocking this request due to CORS policy",
            "Backend needs to allow custom headers in Access-Control-Allow-Headers",
            "This is a server configuration issue, not a network problem",
            "Contact the backend developer to fix CORS settings",
            `Error: ${err.message}`
          ];
        } else if (api.defaults?.baseURL?.includes("ngrok")) {
          userFriendlyError = "Ngrok tunnel connection issue";
          errorCode = 'NGROK_TUNNEL_ERROR';
          troubleshootingTips = [
            "Check that your ngrok tunnel is still active",
            "Try refreshing the page to reconnect",
            "Consider using a local connection instead",
            "Ngrok free tunnels can be unstable - this is normal",
            `Tried ${retryCount + 1} times over ${Math.round(retryCount * 2)}+ seconds`
          ];
        } else {
          userFriendlyError = "Network connection problem";
          errorCode = 'NETWORK_ERROR';
          troubleshootingTips = [
            "Check your internet connection",
            "Verify the backend server is running",
            "Try refreshing the page",
            `Attempted ${retryCount + 1} times`
          ];
        }
      } else if (err.code === "ECONNABORTED") {
        // Request timeout
        userFriendlyError = "Request timed out";
        errorCode = 'REQUEST_TIMEOUT';
        troubleshootingTips = [
          "The server may be overloaded",
          "Try again in a few moments",
          "Consider reducing the number of doors being saved",
          `Timed out after ${retryCount + 1} attempts`
        ];
      } else {
        // Something else happened during request setup
        console.error("[SAVE DOORS] Request setup error:", err.message);
        userFriendlyError = err.message || "Unknown error occurred";
        errorCode = 'SETUP_ERROR';
        troubleshootingTips = [
          "Try refreshing the page",
          "Check your internet connection",
          "Contact support if the problem persists"
        ];
      }

      // Create comprehensive error message
      const errorMessage = `Unable to save doors: ${userFriendlyError}`;

      setError(errorMessage);
      setSubmissionProgress("");

      // Show detailed debug information in development
      if (process.env.NODE_ENV === "development") {
        console.group("SAVE DOORS TROUBLESHOOTING");
        troubleshootingTips.forEach((tip) => console.log(`• ${tip}`));
        console.log(`• Response status: ${err.response?.status || "no response"}`);
        console.log(`• Request timeout: ${err.code === "ECONNABORTED" ? "Yes" : "No"}`);
        console.log(`• Is ngrok: ${api.defaults?.baseURL?.includes("ngrok") || false}`);
        console.log(`• Is CORS error: ${err.message?.includes('CORS') || err.message?.includes('Access-Control') || false}`);
        console.log(`• Error type: ${err.constructor.name}`);
        console.log(`• Door count: ${validDoors?.length || 0}`);
        console.log(`• Estimate ID: ${estimateId}`);
        console.log(`• Retry attempts used: ${retryCount + 1}/${maxRetries + 1}`);
        console.log(`• Error code: ${errorCode}`);
        console.groupEnd();
      }

      return null;
    } finally {
      setSavingDoors(false);
    }
  };

  /**
   * Handle successful upload of an audio recording - UPDATED to fix timing issue
   */
  const handleAudioUploaded = async (recording) => {
    try {
      setIsProcessing(true);
      setError(null);

      // First add the recording to the list
      setRecordings((prev) => [...prev, recording]);

      // Step 1: Transcribe the audio
      const transcribeResponse = await safeApiCall(
        () => transcribeAudio(recording.id),
        "Error transcribing audio"
      );

      if (!transcribeResponse) {
        setIsProcessing(false);
        return;
      }

      // Step 2: Process with AI
      const processResponse = await safeApiCall(
        () => processAudioWithAI(recording.id),
        "Error processing audio with AI"
      );

      if (!processResponse) {
        setIsProcessing(false);
        return;
      }

      // Step 3: Add doors from processing
      if (processResponse.doors && processResponse.doors.length > 0) {
        // Find the highest door number in the existing doors list
        let highestDoorNumber = 0;
        doors.forEach((door) => {
          const doorNum = parseInt(door.door_number, 10);
          if (!isNaN(doorNum) && doorNum > highestDoorNumber) {
            highestDoorNumber = doorNum;
          }
        });

        // Process and renumber the new doors to continue from the highest existing number
        const processedDoors = processResponse.doors.map((door, index) => {
          // Calculate the new door number
          const newDoorNumber = highestDoorNumber + index + 1;

          // Generate a unique ID if one doesn't exist
          if (!door.id) {
            door.id = `temp-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}`;
          }

          // Extract location from details
          let location = "";
          if (door.details && door.details.length > 0) {
            for (const detail of door.details) {
              if (detail.startsWith("Location:")) {
                location = detail.split("Location:")[1].trim();
                break;
              }
            }
          }

          // Update door details that might reference the old door number
          const updatedDetails = door.details.map((detail) => {
            // If the detail references the original door number, update it
            if (detail.includes(`Door #${door.door_number}`)) {
              return detail.replace(
                `Door #${door.door_number}`,
                `Door #${newDoorNumber}`
              );
            }
            return detail;
          });

          // Create updated door object with new door number
          return {
            ...door,
            door_number: newDoorNumber,
            details: updatedDetails,
            description: location
              ? `Door #${newDoorNumber} (${location})`
              : `Door #${newDoorNumber}`,
          };
        });

        console.log(
          `Added ${processedDoors.length} doors starting from #${
            highestDoorNumber + 1
          }`
        );

        // Create the updated doors array (existing + new)
        const updatedDoorsArray = [...doors, ...processedDoors];

        // Update the doors state
        setDoors(updatedDoorsArray);

        // FIXED: Pass the updated doors array directly to avoid timing issues
        await saveDoorsToEstimate(updatedDoorsArray);
      }

      // Refresh recordings to get updated transcripts
      await safeApiCall(
        () => getAudioRecordings(estimateId),
        "Failed to refresh recordings",
        (data) => setRecordings(data || [])
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlayAudio = (filePath, recordingId) => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    if (isPlaying && currentPlayingId === recordingId) {
      currentAudio.pause();
      setIsPlaying(false);
      return;
    }

    const backendApiUrl = api.defaults.baseURL;
    const backendRootUrl = backendApiUrl.replace('/api', '');

    // Construct the full, correct path to the audio file on the backend server.
    // The filePath from the database is likely "uploads/recording.wav".
    const audioPath = filePath.startsWith("http")
      ? filePath
      : `${backendRootUrl}/${filePath.replace(/^\//, "")}`;

    console.log("Attempting to play audio from:", audioPath); // For debugging

    const audio = new Audio(audioPath);

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentPlayingId(null);
    });

    audio.addEventListener("error", (err) => {
      console.error("Error playing audio:", err);
      // More specific error message
      setError(
        `Unable to play audio. File not found at ${audioPath} or network issue.`
      );
      setIsPlaying(false);
      setCurrentPlayingId(null);
    });

    audio.play()
      .then(() => {
        setIsPlaying(true);
        setCurrentAudio(audio);
        setCurrentPlayingId(recordingId);
      })
      .catch((err) => {
        console.error("Error playing audio:", err);
        setError(`Failed to play audio: ${err.message || "Browser prevented playback."}`);
      });
  };

  /**
   * Handle deleting a recording
   */
  const handleDeleteRecording = async (recordingId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this recording?"
    );
    if (!confirmed) return;

    try {
      const result = await safeApiCall(
        () => deleteAudio(recordingId),
        "Failed to delete recording"
      );

      if (result) {
        // Update recordings list
        setRecordings((prev) => prev.filter((rec) => rec.id !== recordingId));
      }
    } catch (err) {
      // Error already handled by safeApiCall
    }
  };

  /**
   * Handle editing a door
   */
  const handleEditDoor = (door) => {
    setEditingDoorId(door.id);
    setEditingDoorDetails([...door.details]);
    setEditingDoorDescription(door.description);
  };

  /**
   * Handle updating a door detail during edit
   */
  const handleUpdateDoorDetail = (index, value) => {
    const updatedDetails = [...editingDoorDetails];
    updatedDetails[index] = value;
    setEditingDoorDetails(updatedDetails);
  };

  /**
   * Add a new blank detail to a door being edited
   */
  const handleAddDoorDetail = () => {
    setEditingDoorDetails([...editingDoorDetails, ""]);
  };

  /**
   * Remove a detail from a door being edited
   */
  const handleRemoveDoorDetail = (index) => {
    const updatedDetails = [...editingDoorDetails];
    updatedDetails.splice(index, 1);
    setEditingDoorDetails(updatedDetails);
  };

  /**
   * Enhanced save edited door function with better error handling
   */
  const handleSaveDoorEdit = async () => {
    try {
      console.log("[DOOR EDIT] Starting door edit save");
      
      // Validate editing state
      if (!editingDoorId) {
        setError("No door selected for editing");
        return;
      }
      
      // Validate edit data
      if (!editingDoorDescription.trim()) {
        setError("Door description cannot be empty");
        return;
      }
      
      console.log("[DOOR EDIT] Updating door:", editingDoorId);
      
      // Find and update the door in the doors array
      const updatedDoors = doors.map((door) => {
        if (door.id === editingDoorId) {
          const updatedDoor = {
            ...door,
            description: editingDoorDescription.trim(),
            details: editingDoorDetails
              .map(detail => detail.trim())
              .filter(detail => detail !== ""), // Remove empty details
          };
          console.log("[DOOR EDIT] Updated door object:", updatedDoor);
          return updatedDoor;
        }
        return door;
      });
      
      // Update state immediately
      setDoors(updatedDoors);
      
      // Clear edit mode
      setEditingDoorId(null);
      setEditingDoorDetails([]);
      setEditingDoorDescription("");
      
      console.log("[DOOR EDIT] State updated, saving to backend");
      
      // Save the updated doors with explicit data to avoid timing issues
      const result = await saveDoorsToEstimate(updatedDoors);
      
      if (result) {
        console.log("[DOOR EDIT] Door edit saved successfully");
      } else {
        console.warn("[DOOR EDIT] Failed to save door edit - check error messages");
      }
      
    } catch (error) {
      console.error("[DOOR EDIT] Error saving door edit:", error);
      setError(`Failed to save door edits: ${error.message}`);
    }
  };

  /**
   * Enhanced handleReprocessAudio function with better error handling
   */
  const handleReprocessAudio = async (recordingId) => {
    try {
      setIsProcessing(true);
      setError(null);

      // Find the recording in the recordings list
      const recording = recordings.find((rec) => rec.id === recordingId);
      if (!recording) {
        setError("Recording not found");
        setIsProcessing(false);
        return;
      }

      // Enhanced progress reporting
      setSubmissionProgress(`Reprocessing recording ${recording.id}...`);
      console.log(
        `[REPROCESS AUDIO] Starting reprocessing for recording ${recordingId}`
      );

      // Step 1: Transcribe the audio (in case it wasn't transcribed properly before)
      setSubmissionProgress("Transcribing audio...");
      const transcribeResponse = await safeApiCall(
        () => transcribeAudio(recordingId),
        "Error transcribing audio"
      );

      if (!transcribeResponse) {
        setIsProcessing(false);
        setSubmissionProgress("");
        return;
      }

      setSubmissionProgress("Extracting door information with AI...");
      console.log(
        `[REPROCESS AUDIO] Transcription complete, processing with AI...`
      );

      // Step 2: Process with AI
      const processResponse = await safeApiCall(
        () => processAudioWithAI(recordingId),
        "Error processing audio with AI"
      );

      if (!processResponse) {
        setIsProcessing(false);
        setSubmissionProgress("");
        return;
      }

      // Step 3: Add doors from processing
      if (processResponse.doors && processResponse.doors.length > 0) {
        setSubmissionProgress(
          `Processing ${processResponse.doors.length} doors...`
        );
        console.log(
          `[REPROCESS AUDIO] AI processing complete, found ${processResponse.doors.length} doors`
        );

        // Find the highest door number in the existing doors list
        let highestDoorNumber = 0;
        doors.forEach((door) => {
          const doorNum = parseInt(door.door_number, 10);
          if (!isNaN(doorNum) && doorNum > highestDoorNumber) {
            highestDoorNumber = doorNum;
          }
        });

        // Process and renumber the new doors to continue from the highest existing number
        const processedDoors = processResponse.doors.map((door, index) => {
          // Calculate the new door number
          const newDoorNumber = highestDoorNumber + index + 1;

          // Generate a unique ID if one doesn't exist
          if (!door.id) {
            door.id = `temp-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}`;
          }

          // Extract location from details
          let location = "";
          if (door.details && door.details.length > 0) {
            for (const detail of door.details) {
              if (detail.startsWith("Location:")) {
                location = detail.split("Location:")[1].trim();
                break;
              }
            }
          }

          // Update door details that might reference the old door number
          const updatedDetails = door.details.map((detail) => {
            // If the detail references the original door number, update it
            if (detail.includes(`Door #${door.door_number}`)) {
              return detail.replace(
                `Door #${door.door_number}`,
                `Door #${newDoorNumber}`
              );
            }
            return detail;
          });

          // Create updated door object with new door number
          return {
            ...door,
            door_number: newDoorNumber,
            details: updatedDetails,
            description: location
              ? `Door #${newDoorNumber} (${location})`
              : `Door #${newDoorNumber}`,
          };
        });

        console.log(
          `[REPROCESS AUDIO] Added ${
            processedDoors.length
          } doors starting from #${highestDoorNumber + 1}`
        );

        // Create the updated doors array (existing + new)
        const updatedDoorsArray = [...doors, ...processedDoors];

        // Update the doors state
        setDoors(updatedDoorsArray);

        // Save with enhanced error handling - pass the updated doors array directly
        setSubmissionProgress("Saving doors to estimate...");
        const saveResult = await saveDoorsToEstimate(updatedDoorsArray);

        if (!saveResult) {
          // Error was already set by saveDoorsToEstimate
          console.error(
            `[REPROCESS AUDIO] Failed to save doors for recording ${recordingId}`
          );
          setSubmissionProgress("Failed to save doors");
          return;
        }
      } else {
        setError("No door information could be extracted from this recording.");
        setSubmissionProgress("");
        setIsProcessing(false);
        return;
      }

      // Refresh recordings to get updated transcripts
      setSubmissionProgress("Refreshing recording data...");
      await safeApiCall(
        () => getAudioRecordings(estimateId),
        "Failed to refresh recordings",
        (data) => setRecordings(data || [])
      );

      setSubmissionProgress("Reprocessing complete!");
      console.log(
        `[REPROCESS AUDIO] Successfully completed reprocessing for recording ${recordingId}`
      );

      // Clear progress message after delay
      setTimeout(() => {
        setSubmissionProgress("");
      }, 2000);
    } catch (error) {
      console.error(
        `[REPROCESS AUDIO] Error reprocessing recording ${recordingId}:`,
        error
      );

      // Enhanced error handling with specific messages
      let errorMessage = "Failed to reprocess audio recording";

      if (
        error.message?.includes("Network Error") ||
        error.message?.includes("ngrok")
      ) {
        errorMessage =
          "Connection issue while reprocessing. Please check your connection and try again.";
      } else if (error.message?.includes("timeout")) {
        errorMessage =
          "Reprocessing timed out. Please try again - this can happen with slower connections.";
      } else if (error.message?.includes("auth")) {
        errorMessage =
          "Authentication expired. Please refresh the page and try again.";
      }

      setError(`${errorMessage}: ${error.message}`);
      setSubmissionProgress("");
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Cancel door edit
   */
  const handleCancelDoorEdit = () => {
    setEditingDoorId(null);
    setEditingDoorDetails([]);
    setEditingDoorDescription("");
  };

  /**
   * Enhanced remove door function with better error handling
   */
  const handleRemoveDoor = async (doorId) => {
    try {
      console.log("[DOOR REMOVE] Starting door removal:", doorId);
      
      const confirmed = window.confirm(
        "Are you sure you want to remove this door? This action cannot be undone."
      );
      if (!confirmed) {
        console.log("[DOOR REMOVE] User cancelled removal");
        return;
      }
      
      // Find the door being removed for logging
      const doorToRemove = doors.find(door => door.id === doorId);
      if (!doorToRemove) {
        setError("Door not found - it may have already been removed");
        return;
      }
      
      console.log("[DOOR REMOVE] Removing door:", doorToRemove);
      
      // Remove the door from the doors array
      const updatedDoors = doors.filter((door) => door.id !== doorId);
      
      // Update state immediately
      setDoors(updatedDoors);
      
      console.log(`[DOOR REMOVE] Updated doors array: ${updatedDoors.length} doors remaining`);
      
      // Save the updated doors with explicit data
      const result = await saveDoorsToEstimate(updatedDoors);
      
      if (result) {
        console.log("[DOOR REMOVE] Door removal saved successfully");
      } else {
        console.warn("[DOOR REMOVE] Failed to save door removal - check error messages");
      }
      
    } catch (error) {
      console.error("[DOOR REMOVE] Error removing door:", error);
      setError(`Failed to remove door: ${error.message}`);
    }
  };

  /**
   * Handle submitting the estimate to create a bid
   */
  const handleSubmitToBid = async () => {
    if (doors.length === 0) {
      setError("No doors to submit. Please record and process audio first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSubmissionProgress("Creating bid...");

    try {
      // Step 1: Create a new bid
      const bidResponse = await safeApiCall(
        () => createBid(estimateId),
        "Failed to create bid"
      );

      if (!bidResponse) {
        setSubmitting(false);
        return;
      }

      const bidId = bidResponse.id;
      setSubmissionProgress(`Adding ${doors.length} doors to bid...`);

      // Step 2: Add all the doors to the bid
      const doorsResponse = await safeApiCall(
        () => addDoorsToBid(bidId, doors),
        "Failed to add doors to bid"
      );

      if (!doorsResponse) {
        setSubmitting(false);
        return;
      }

      setSubmissionProgress("Finalizing bid...");

      // Success!
      setSubmitSuccess(true);
      setSubmissionProgress("Bid created successfully!");

      // Navigate to the bid page after a short delay
      setTimeout(() => {
        navigate(`/bids/${bidId}`);
      }, 2000);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Enhanced connection error handling component
   */
  const renderConnectionError = () => {
    const isNgrok = api.defaults?.baseURL?.includes("ngrok");

    return (
      <div className="connection-error-container p-5 text-center">
        <FaServer size={48} className="text-danger mb-3" />
        <h3>
          {isNgrok
            ? "Ngrok Tunnel Connection Error"
            : "Server Connection Error"}
        </h3>
        <p>
          Unable to connect to the {isNgrok ? "ngrok tunnel" : "backend server"}
          .
          {isNgrok
            ? " This is common with ngrok free tunnels."
            : " Please ensure that:"}
        </p>

        {isNgrok ? (
          <div className="alert alert-info">
            <h6 className="alert-heading">
              <FaServer className="me-2" />
              Ngrok Tunnel Troubleshooting
            </h6>
            <ul className="list-unstyled mb-0">
              <li>
                • Check that your ngrok tunnel is still active in terminal
              </li>
              <li>• Ngrok free tunnels have time limits and can be unstable</li>
              <li>
                • Try running: <code>ngrok http 5000</code> to restart tunnel
              </li>
              <li>
                • Consider using a local connection instead:{" "}
                <code>http://localhost:3000</code>
              </li>
              <li>• Free ngrok tunnels may have bandwidth or request limits</li>
            </ul>
          </div>
        ) : (
          <ul className="list-unstyled">
            <li>• The backend server is running at http://127.0.0.1:5000</li>
            <li>• No firewall or network issues are blocking the connection</li>
            <li>• The API endpoint is configured correctly</li>
          </ul>
        )}

        <div className="mt-4">
          <Button variant="primary" onClick={handleRetry} className="me-3">
            <FaSync className="me-2" /> Retry Connection
          </Button>

          {isNgrok && (
            <Button
              variant="outline-info"
              onClick={() =>
                window.open(
                  "https://dashboard.ngrok.com/tunnels/agents",
                  "_blank"
                )
              }
              className="me-3"
            >
              <FaServer className="me-2" /> Check Ngrok Status
            </Button>
          )}

          <Button
            variant="outline-secondary"
            onClick={() => navigate("/estimates")}
          >
            <FaArrowLeft className="me-2" /> Back to Estimates
          </Button>
        </div>

        {/* Development-only debugging information */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-4 p-3 bg-light rounded">
            <h6>Debug Information:</h6>
            <small className="text-muted">
              <div>Base URL: {api.defaults?.baseURL || "undefined"}</div>
              <div>Online: {navigator.onLine ? "Yes" : "No"}</div>
              <div>
                Connection: {navigator.connection?.effectiveType || "unknown"}
              </div>
              <div>User Agent: {navigator.userAgent.slice(0, 50)}...</div>
            </small>
          </div>
        )}
      </div>
    );
  };

  /**
   * Enhanced error alert component with troubleshooting
   */
  const renderErrorAlert = () => {
    if (!error) return null;

    const isNgrokError =
      error.includes("ngrok") || api.defaults?.baseURL?.includes("ngrok");
    const isNetworkError =
      error.includes("Network Error") || error.includes("connection");
    const isTimeoutError =
      error.includes("timeout") || error.includes("timed out");

    return (
      <Alert
        variant="danger"
        dismissible
        onClose={() => setError(null)}
        className="mb-4"
      >
        <Alert.Heading>
          <FaServer className="me-2" />
          {isNgrokError
            ? "Ngrok Tunnel Issue"
            : isNetworkError
            ? "Connection Problem"
            : "Error"}
        </Alert.Heading>

        <p className="mb-2">{error}</p>

        {/* Additional context for manual save errors */}
        {error.includes("save") && (
          <div className="mt-3">
            <h6>Current Status:</h6>
            <ul className="mb-0 small">
              <li>Doors in memory: {doors?.length || 0}</li>
              <li>Estimate ID: {estimateId}</li>
              <li>Backend URL: {api.defaults?.baseURL || 'Not set'}</li>
              <li>Connection: {navigator.onLine ? 'Online' : 'Offline'}</li>
            </ul>
          </div>
        )}

        {(isNgrokError || isNetworkError || isTimeoutError) && (
          <div className="mt-3">
            <h6>Troubleshooting Tips:</h6>
            <ul className="mb-0 small">
              {isNgrokError && (
                <>
                  <li>Check if your ngrok tunnel is still active</li>
                  <li>Ngrok free tunnels can be unstable - this is normal</li>
                  <li>Try refreshing the page to reconnect</li>
                  <li>
                    Consider using localhost instead of ngrok for development
                  </li>
                </>
              )}
              {isNetworkError && !isNgrokError && (
                <>
                  <li>Check your internet connection</li>
                  <li>Verify the backend server is running</li>
                  <li>Try refreshing the page</li>
                </>
              )}
              {isTimeoutError && (
                <>
                  <li>
                    The request took too long - this can happen with slow
                    connections
                  </li>
                  <li>Try again in a moment</li>
                  <li>Consider reducing the amount of data being saved</li>
                </>
              )}
            </ul>
          </div>
        )}

        {process.env.NODE_ENV === "development" && (
          <div className="mt-3 p-2 bg-light rounded">
            <small className="text-muted">
              <strong>Debug:</strong>{" "}
              {api.defaults?.baseURL || "No base URL set"}
              {isNgrokError && " (Ngrok tunnel detected)"}
            </small>
          </div>
        )}
      </Alert>
    );
  };

  /**
   * Enhanced submission progress component
   */
  const renderSubmissionProgress = () => {
    if (!submissionProgress && !savingDoors && !isProcessing) return null;

    const message =
      submissionProgress ||
      (savingDoors ? "Saving doors..." : "") ||
      (isProcessing ? "Processing..." : "");

    const isNgrok = api.defaults?.baseURL?.includes("ngrok");

    return (
      <div className="submitting-indicator mt-3 d-flex align-items-center">
        <Spinner animation="border" size="sm" className="me-2" />
        <span>{message}</span>
        {isNgrok && message.includes("aving") && (
          <small className="text-muted ms-2">(Ngrok tunnels can be slow)</small>
        )}
      </div>
    );
  };

  // Connection error state - show a user-friendly message
  if (connectionError) {
    return renderConnectionError();
  }

  // Loading state
  if (loading) {
    return (
      <div className="loading-container text-center p-5">
        <Spinner animation="border" />
        <p className="mt-3">Loading estimate data...</p>
      </div>
    );
  }

  return (
    <div className="estimate-in-progress-container">
      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center">
          <Button
            variant="outline-secondary"
            onClick={() => navigate("/estimates")}
            className="me-3"
          >
            <FaArrowLeft className="me-2" /> Back to Estimates
          </Button>
          <h2 className="mb-0">Estimate Details</h2>
        </div>
      </div>

      {renderErrorAlert()}

      {submitSuccess && (
        <Alert variant="success" className="mb-4">
          Successfully submitted to bid! Redirecting...
        </Alert>
      )}

      {doorsUpdated && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setDoorsUpdated(false)}
          className="mb-4"
        >
          Door information successfully saved!
        </Alert>
      )}

      <Card className="customer-info-card mb-4">
        <Card.Header>Customer Information</Card.Header>
        <Card.Body>
          {customer ? (
            <Row>
              <Col md={6}>
                <p>
                  <strong>Name:</strong> {customer.name}
                </p>
                <p>
                  <strong>Site:</strong> {estimate?.site_name || "N/A"}
                </p>
                <p>
                  <strong>Site Address:</strong>{" "}
                  {estimate?.site_address || "N/A"}
                </p>
              </Col>
              <Col md={6}>
                <p>
                  <strong>Onsite Contact:</strong>{" "}
                  {estimate?.site_contact_name || "N/A"}
                </p>
                <p>
                  <strong>Phone:</strong> {estimate?.site_phone || "N/A"}
                </p>
                <p>
                  <strong>Lockbox Location:</strong>{" "}
                  {estimate?.site_lockbox_location || "N/A"}
                </p>
              </Col>
            </Row>
          ) : (
            <p className="mb-0">No customer information available.</p>
          )}
        </Card.Body>
      </Card>

      {/* Only show this section if the estimate is pending (not converted to bid) */}
      {estimate && estimate.status === "pending" && (
        <>
          <Card className="audio-recorder-card mb-4">
            <Card.Header>Record Door Information</Card.Header>
            <Card.Body>
              <p className="mb-3">
                Record audio notes for each door. Speak clearly and include
                dimensions, specifications, and any special details about the
                doors.
              </p>
              <AudioRecorder
                estimateId={estimateId}
                onAudioUploaded={handleAudioUploaded}
                onError={(err) =>
                  setError(err.message || "Error with audio recording")
                }
              />

              {(isProcessing || submissionProgress) &&
                renderSubmissionProgress()}
            </Card.Body>
          </Card>

          {recordings.length > 0 && (
            <Card className="audio-recordings-card mb-4">
              <Card.Header>Saved Recordings</Card.Header>
              <Card.Body>
                <ListGroup>
                  {recordings.map((recording, index) => (
                    <ListGroup.Item
                      key={recording.id}
                      className="recording-list-item"
                    >
                      <div className="d-flex flex-column flex-md-row justify-content-between w-100">
                        <div className="recording-info flex-grow-1 mb-2 mb-md-0 me-md-3">
                          <strong>Recording {index + 1}</strong>
                          <p className="text-muted small mb-1">
                            {new Date(recording.created_at).toLocaleString()}
                          </p>
                          {recording.transcript && (
                            <div className="transcript-text mt-2 mb-2">
                              <small className="text-wrap">
                                <strong>Transcript:</strong>{" "}
                                {recording.transcript}
                              </small>
                            </div>
                          )}
                        </div>
                        <div className="recording-actions d-flex flex-wrap justify-content-start justify-content-md-end align-items-center mt-2 mt-md-0">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="me-2 mb-2 mb-md-0"
                            onClick={() =>
                              handlePlayAudio(recording.file_path, recording.id)
                            }
                          >
                            <FaVolumeUp className="me-1" />{" "}
                            {isPlaying && currentPlayingId === recording.id
                              ? "Pause"
                              : "Play"}
                          </Button>
                          <Button
                            variant="outline-info"
                            size="sm"
                            className="me-2 mb-2 mb-md-0"
                            onClick={() => handleReprocessAudio(recording.id)}
                            disabled={isProcessing}
                            title="Reprocess this recording to extract door information again"
                          >
                            <FaSync className="me-1" /> Reprocess
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="mb-2 mb-md-0"
                            onClick={() => handleDeleteRecording(recording.id)}
                          >
                            <FaTrash className="me-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card.Body>
            </Card>
          )}

          {doors.length > 0 && (
            <Card className="door-information-card mb-4">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <span>Extracted Door Information</span>
                <div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      // Enhanced manual save with comprehensive error handling
                      try {
                        console.log("[MANUAL SAVE] Starting manual save operation");
                        console.log("[MANUAL SAVE] Current doors state:", doors);
                        
                        // Immediate validation before attempting save
                        if (!doors || !Array.isArray(doors) || doors.length === 0) {
                          const errorDetails = !doors 
                            ? "doors state is null or undefined" 
                            : !Array.isArray(doors) 
                            ? `doors is not an array (type: ${typeof doors})` 
                            : "no doors in the array";
                          
                          const errorMsg = `Cannot save doors: ${errorDetails}. Please record audio to extract door information first.`;
                          console.error("[MANUAL SAVE] Validation failed:", errorMsg);
                          setError(errorMsg);
                          return;
                        }
                        
                        // Check for data integrity issues
                        const invalidDoors = doors.filter((door, index) => {
                          if (!door || typeof door !== 'object') {
                            console.warn(`[MANUAL SAVE] Door at index ${index} is invalid:`, door);
                            return true;
                          }
                          return false;
                        });
                        
                        if (invalidDoors.length > 0) {
                          const errorMsg = `Found ${invalidDoors.length} corrupted door objects. Please refresh the page and try again.`;
                          console.error("[MANUAL SAVE] Data integrity check failed:", invalidDoors);
                          setError(errorMsg);
                          return;
                        }
                        
                        console.log(`[MANUAL SAVE] Validation passed: ${doors.length} valid doors`);
                        
                        // Create a deep copy to avoid state mutation issues
                        const doorsToSave = JSON.parse(JSON.stringify(doors));
                        console.log("[MANUAL SAVE] Created deep copy for saving:", doorsToSave);
                        
                        // Call the enhanced save function with explicit doors data
                        const result = await saveDoorsToEstimate(doorsToSave);
                        
                        if (result) {
                          console.log("[MANUAL SAVE] Save operation completed successfully:", result);
                        } else {
                          console.warn("[MANUAL SAVE] Save operation returned null - check error messages");
                        }
                        
                      } catch (error) {
                        console.error("[MANUAL SAVE] Unexpected error during save operation:", error);
                        setError(`Manual save failed: ${error.message}`);
                      }
                    }}
                    disabled={savingDoors || editingDoorId !== null || !doors || doors.length === 0}
                    title={!doors || doors.length === 0 ? "No doors to save - record audio first" : "Save all doors to estimate"}
                  >
                    {savingDoors ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-1"
                        />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FaSave className="me-1" />
                        Save Doors {doors?.length ? `(${doors.length})` : ''}
                      </>
                    )}
                  </Button>
                </div>
              </Card.Header>
              <Card.Body>
                <p className="text-muted mb-3">
                  <small>
                    You have {doors.length} door{doors.length !== 1 ? "s" : ""}{" "}
                    in this estimate. Record additional audio to add more doors,
                    or use the buttons below to edit or remove existing doors.
                  </small>
                </p>

                {doors.length > 0 ? (
                  <ListGroup>
                    {doors.map((door, index) => (
                      <ListGroup.Item key={door.id || `door-${door.door_number}-${index}`}>
                        {editingDoorId === door.id ? (
                          <div className="door-edit-container">
                            <Form.Group className="mb-3">
                              <Form.Label>Door Description</Form.Label>
                              <Form.Control
                                type="text"
                                value={editingDoorDescription}
                                onChange={(e) => setEditingDoorDescription(e.target.value)}
                                placeholder="Enter door description..."
                                isInvalid={!editingDoorDescription.trim()}
                              />
                              <Form.Control.Feedback type="invalid">
                                Description is required
                              </Form.Control.Feedback>
                            </Form.Group>

                            <Form.Group className="mb-3">
                              <Form.Label>
                                Door Details 
                                <small className="text-muted ms-2">({editingDoorDetails.length} details)</small>
                              </Form.Label>
                              {editingDoorDetails.map((detail, detailIndex) => (
                                <InputGroup className="mb-2" key={detailIndex}>
                                  <Form.Control
                                    type="text"
                                    value={detail}
                                    onChange={(e) => handleUpdateDoorDetail(detailIndex, e.target.value)}
                                    placeholder="Enter detail..."
                                  />
                                  <Button
                                    variant="outline-danger"
                                    onClick={() => handleRemoveDoorDetail(detailIndex)}
                                    title="Remove this detail"
                                  >
                                    <FaTimes />
                                  </Button>
                                </InputGroup>
                              ))}
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={handleAddDoorDetail}
                                className="mt-2"
                              >
                                + Add Detail
                              </Button>
                            </Form.Group>

                            <div className="d-flex justify-content-end">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="me-2"
                                onClick={handleCancelDoorEdit}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="success"
                                size="sm"
                                onClick={handleSaveDoorEdit}
                                disabled={!editingDoorDescription.trim()}
                              >
                                <FaSave className="me-1" />
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <h5 className="mb-2">
                                {door.description}
                                <small className="text-muted ms-2">
                                  (ID: {door.id?.slice(-8) || 'No ID'})
                                </small>
                              </h5>
                              {door.details && door.details.length > 0 ? (
                                <ul className="mb-0">
                                  {door.details.map((detail, detailIndex) => (
                                    <li key={detailIndex}>{detail}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-muted mb-0">
                                  <em>No details available</em>
                                </p>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              <Button
                                variant="outline-primary"
                                size="sm"
                                className="me-2"
                                onClick={() => handleEditDoor(door)}
                                disabled={editingDoorId !== null}
                                title="Edit this door"
                              >
                                <FaEdit className="me-1" /> Edit
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleRemoveDoor(door.id)}
                                disabled={editingDoorId !== null}
                                title="Remove this door"
                              >
                                <FaTrash className="me-1" /> Remove
                              </Button>
                            </div>
                          </div>
                        )}
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted">
                      No doors extracted yet. Record audio to automatically extract door information.
                    </p>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {doors.length > 0 && (
            <div className="submit-actions mb-4">
              <Button
                variant="success"
                size="lg"
                onClick={handleSubmitToBid}
                disabled={submitting || submitSuccess || editingDoorId !== null}
                className="submit-button"
              >
                <FaCheck className="me-2" /> Submit to Bid
              </Button>

              {submitting && renderSubmissionProgress()}
            </div>
          )}
        </>
      )}

      {/* If the estimate is already converted to a bid, show a message */}
      {estimate && estimate.status === "converted" && (
        <Card className="mb-4">
          <Card.Body>
            <Alert variant="info" className="mb-0">
              <h5>This estimate has been converted to a bid</h5>
              <p>You can view and manage the bid details from the bids page.</p>
              <Button
                variant="primary"
                onClick={() => navigate(`/bids?estimateId=${estimateId}`)}
              >
                View Associated Bid
              </Button>
            </Alert>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default EstimateInProgress;