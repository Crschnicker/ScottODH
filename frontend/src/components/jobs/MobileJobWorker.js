// frontend/src/components/jobs/MobileJobWorker.js

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

// Import the centralized MobileWorkerService instance
import mobileWorkerService from "../../services/MobileWorkerService";

// Video rotation utility functions
const detectVideoOrientation = async (videoBlob) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      const { videoWidth, videoHeight } = video;
      console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);
      
      // If width > height significantly, it's likely a rotated portrait video
      // This is a heuristic - adjust the ratio threshold as needed
      if (videoWidth > videoHeight && videoWidth / videoHeight > 1.3) {
        resolve(90); // Needs 90 degree clockwise rotation
      } else {
        resolve(0); // No rotation needed
      }
      
      // Clean up
      URL.revokeObjectURL(video.src);
    };
    
    video.onerror = () => {
      console.warn('Could not detect video orientation, assuming no rotation needed');
      resolve(0);
    };
    
    video.src = URL.createObjectURL(videoBlob);
  });
};

const rotateVideoBlob = async (videoBlob, rotationDegrees) => {
  if (rotationDegrees === 0) {
    return videoBlob; // No rotation needed
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.onloadedmetadata = () => {
      const { videoWidth, videoHeight, duration } = video;
      
      // Set canvas dimensions based on rotation
      if (rotationDegrees === 90 || rotationDegrees === 270) {
        canvas.width = videoHeight;
        canvas.height = videoWidth;
      } else {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
      }
      
      // Create MediaRecorder to capture rotated video
      const canvasStream = canvas.captureStream(30); // 30 FPS
      const mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });
      
      const chunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const rotatedBlob = new Blob(chunks, { type: 'video/webm' });
        resolve(rotatedBlob);
      };
      
      // Start recording
      mediaRecorder.start();
      
      // Play video and draw rotated frames to canvas
      const drawFrame = () => {
        if (video.ended || video.paused) {
          mediaRecorder.stop();
          return;
        }
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply rotation transformation
        ctx.save();
        
        if (rotationDegrees === 90) {
          ctx.translate(canvas.width, 0);
          ctx.rotate(Math.PI / 2);
        } else if (rotationDegrees === 180) {
          ctx.translate(canvas.width, canvas.height);
          ctx.rotate(Math.PI);
        } else if (rotationDegrees === 270) {
          ctx.translate(0, canvas.height);
          ctx.rotate(-Math.PI / 2);
        }
        
        // Draw video frame
        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
        ctx.restore();
        
        // Continue to next frame
        requestAnimationFrame(drawFrame);
      };
      
      // Start playback
      video.play().then(() => {
        drawFrame();
      }).catch(reject);
    };
    
    video.onerror = reject;
    video.src = URL.createObjectURL(videoBlob);
  });
};

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
 * Now includes video rotation correction before upload
 */
const CameraCapture = ({ onCapture, onCancel, type = "photo" }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

    recorder.onstop = async () => {
      setIsProcessing(true);
      try {
        const rawBlob = new Blob(chunks, { type: "video/webm" });
        
        console.log("Processing video for orientation correction...");
        
        // Detect if video needs rotation
        const rotationNeeded = await detectVideoOrientation(rawBlob);
        console.log(`Video rotation needed: ${rotationNeeded} degrees`);
        
        let finalBlob;
        if (rotationNeeded > 0) {
          console.log("Rotating video before upload...");
          finalBlob = await rotateVideoBlob(rawBlob, rotationNeeded);
          console.log("Video rotation completed");
        } else {
          finalBlob = rawBlob;
        }
        
        onCapture(finalBlob, "video");
      } catch (error) {
        console.error("Error processing video:", error);
        // Fallback to original video if rotation fails
        const fallbackBlob = new Blob(chunks, { type: "video/webm" });
        onCapture(fallbackBlob, "video");
      } finally {
        setIsProcessing(false);
      }
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

  if (isProcessing) {
    return (
      <div className="mobile-modal-overlay">
        <div className="mobile-modal-content">
          <div className="text-center">
            <Loader className="icon-xxl mobile-text-blue-500 mx-auto mb-4 animate-spin" />
            <h3 className="mobile-text-lg mobile-font-semibold mb-2">
              Processing Video
            </h3>
            <p className="mobile-text-gray-600 mb-4">
              Correcting video orientation, please wait...
            </p>
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
              disabled={isProcessing}
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


  // Use the API server root from the service instance directly
  // Ensure getApiConfig is implemented in MobileWorkerService
  const apiServerRoot = mobileWorkerService.getApiConfig().baseUrl.replace("/api", "");

  /**
   * Generate work summary for the current session/day
   * Used for pause operations to show what was accomplished
   */
  const generateWorkSummary = () => {
    // Add null checks for jobData and timeTrackingData
    if (!jobData || !timeTrackingData) return null;

    // Calculate current session time in a readable format
    const sessionTime = formatTime(currentSessionTime);
    
    // Count doors that have been worked on (have any completed line items or media)
    const doorsWorkedOn = jobData.doors.filter(door => 
      (door.line_items && door.line_items.some(item => item.completed)) || // Check if line_items exists
      (door.photos && door.photos.length > 0) || 
      door.has_video
    ).length;

    // Count total line items completed across all doors
    const lineItemsCompleted = jobData.doors.reduce((total, door) => 
      total + (door.line_items ? door.line_items.filter(item => item.completed).length : 0), 0 // Check if line_items exists
    );

    // Count doors completed (have signatures)
    const doorsCompleted = jobData.doors.filter(door => door.completed).length;

    // Generate media captured list
    const mediaUploaded = [];
    jobData.doors.forEach(door => {
      const photoCount = door.photos?.length || 0;
      if (photoCount > 0) {
        mediaUploaded.push(`Door #${door.door_number} - ${photoCount} Photo(s)`);
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

  // Memoize `loadJobData` to prevent unnecessary re-renders in effects that depend on it
  const loadJobData = React.useCallback(async (useCache = true) => {
    setLoading(true);
    setError(null);
    const currentJobId = parseInt(jobId); // Ensure jobId is consistently a number

    try {
      // Fetch from cache if offline
      if (useCache && !isOnline) {
        const cachedData = mobileWorkerService.getCachedJobFromLocalStorage(currentJobId);
        if (cachedData) {
          console.log("[MobileJobWorker] Loading job data from cache (offline mode).");
          setJobData(cachedData);
          setJobStatus(cachedData.mobile_status || "not_started");
          
          if (cachedData.time_tracking) {
            setTimeTrackingData(cachedData.time_tracking);
            setJobTimingStatus(cachedData.time_tracking.job_timing_status || 'not_started');
            setTotalJobTime(cachedData.time_tracking.total_minutes * 60000);
            if (cachedData.time_tracking.current_session_start) {
              const startTimestamp = new Date(cachedData.time_tracking.current_session_start).getTime();
              if (!isNaN(startTimestamp)) setStartTime(startTimestamp);
            }
          }
          setLoading(false);
          return;
        }
      }

      console.log(`[MobileJobWorker] Loading job data for job ID: ${currentJobId} from API.`);
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

      // This patch makes the frontend resilient to backend data inconsistencies,
      // particularly after a state change (like starting a job).
      let timeTrackingInfo = data.time_tracking || {
        total_minutes: 0, total_hours: 0, current_session_start: null, has_active_session: false,
        job_timing_status: 'not_started', session_count: 0, sessions: []
      };

      // PATCH 1: If the overall job is 'started' but the timing status isn't set correctly, force it.
      if (data.mobile_status === 'started' && !['active', 'paused'].includes(timeTrackingInfo.job_timing_status)) {
        console.warn("[MobileJobWorker] Backend data inconsistency detected: Job is 'started' but timing status is not. Patching to 'active'.");
        timeTrackingInfo.job_timing_status = 'active';
        // If there's no active session start time, use the job's overall start_time as a fallback.
        if (!timeTrackingInfo.current_session_start && data.start_time) {
            timeTrackingInfo.current_session_start = data.start_time;
        }
      }

      // PATCH 2: If the job is 'completed', ensure timing status reflects this.
      if (data.mobile_status === 'completed' && timeTrackingInfo.job_timing_status !== 'completed') {
          console.warn("[MobileJobWorker] Backend data inconsistency detected: Job is 'completed' but timing status is not. Patching to 'completed'.");
          timeTrackingInfo.job_timing_status = 'completed';
      }

      const processedDoors = data.doors.map((door, index) => {
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
        
        const doorPhotos = (door.photos || []).map(photo => ({
            id: photo.id || `temp_photo_${Date.now()}`,
            url: photo.url,
            thumbnail_url: photo.thumbnail_url,
            uploaded_at: photo.uploaded_at,
        }));

        // Backward compatibility: If old fields exist and new one doesn't, migrate it.
        if (door.has_photo && (!door.photos || door.photos.length === 0) && door.photo_info) {
            console.log(`[MobileJobWorker] Migrating legacy photo data for door ${door.id}.`);
            doorPhotos.push({
                id: door.photo_info.id,
                url: door.photo_info.url,
                thumbnail_url: door.photo_info.thumbnail_url,
                uploaded_at: door.photo_info.uploaded_at
            });
        }


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
          completed: Boolean(door.completed),
          photos: doorPhotos,
          has_video: Boolean(door.has_video),
          has_signature: Boolean(door.has_signature),
          video_info: door.video_info || null,
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
        start_time: data.start_time || null,
        doors: processedDoors,
        total_doors: data.total_doors || processedDoors.length,
        completed_doors: data.completed_doors || processedDoors.filter((d) => d.completed).length,
        completion_percentage: data.completion_percentage || 0,
        job_readiness: data.job_readiness || {
          can_start: true, can_complete: false, all_doors_ready: false, missing_requirements: [],
        },
        media_summary: data.media_summary || { total_photos: 0, total_videos: 0 },
        job_status: data.job_status,
        scheduled_date: data.scheduled_date,
        region: data.region,
        time_tracking: timeTrackingInfo, // Use the patched time tracking info
      };

      console.log("[MobileJobWorker] Processed job data for UI:", processedJobData);
      setJobData(processedJobData);
      setJobStatus(processedJobData.mobile_status);
      
      if (processedJobData.time_tracking) {
        setTimeTrackingData(processedJobData.time_tracking);
        setJobTimingStatus(processedJobData.time_tracking.job_timing_status);
        const totalTimeMs = processedJobData.time_tracking.total_minutes * 60000;
        setTotalJobTime(totalTimeMs);
        
        if (processedJobData.time_tracking.current_session_start) {
          try {
            const startTimestamp = new Date(processedJobData.time_tracking.current_session_start).getTime();
            if (!isNaN(startTimestamp)) setStartTime(startTimestamp);
          } catch (timeError) {
            console.warn("⚠️ [MobileJobWorker] Error parsing current_session_start:", timeError);
          }
        }
      }

      if (isOnline) {
        try {
          await mobileWorkerService.cacheJobForOffline(processedJobData);
        } catch (cacheError) {
          console.warn("[MobileJobWorker] Failed to cache job data:", cacheError);
        }
      }
      
      console.log(`[MobileJobWorker] Job data loaded successfully: ${processedJobData.job_number} - ${processedJobData.mobile_status} - Timing: ${processedJobData.time_tracking.job_timing_status} - Total: ${processedJobData.time_tracking.total_minutes}min`);
      
    } catch (err) {
      console.error("[MobileJobWorker] Error in loadJobData:", err);
      let errorMessage = err.message || "Failed to load job data";
      if (err.message && err.message.includes("404")) errorMessage = `Job #${currentJobId} not found.`;
      else if (err.message && err.message.includes("Network error")) errorMessage = "Network error. Please check connection.";
      setError(errorMessage);

      if (useCache && isOnline) {
        try {
          const cachedData = mobileWorkerService.getCachedJobFromLocalStorage(currentJobId);
          if (cachedData && cachedData.id === currentJobId) {
            console.log("[MobileJobWorker] Falling back to cached data after API error.");
            setJobData(cachedData);
            setJobStatus(cachedData.mobile_status || "not_started");
            if (cachedData.time_tracking) {
              setTimeTrackingData(cachedData.time_tracking);
              setJobTimingStatus(cachedData.time_tracking.job_timing_status || 'not_started');
              setTotalJobTime(cachedData.time_tracking.total_minutes * 60000);
              if (cachedData.time_tracking.current_session_start) {
                const startTimestamp = new Date(cachedData.time_tracking.current_session_start).getTime();
                if (!isNaN(startTimestamp)) setStartTime(startTimestamp);
              }
            }
            setError(null);
            setTimeout(() => alert("Using cached data due to connection issues. Some information may be outdated."), 1000);
          }
        } catch (cacheError) {
          console.error("[MobileJobWorker] Cache fallback also failed:", cacheError);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [jobId, isOnline]);

  /**
   * Sync pending changes when back online (memoized for stability)
   */
  const syncPendingChanges = React.useCallback(async () => {
    if (!isOnline) return;

    setPendingSync(true);
    try {
      const results = await mobileWorkerService.syncPendingChanges();
      if (results.synced > 0) {
        await loadJobData(false); // Refresh job data after sync
      }
      if (results.errors.length > 0) {
        // Optionally show a summary of sync errors to the user
        alert(`Sync completed with ${results.errors.length} errors. Some changes may not have been saved.`);
      }
    } catch (error) {
      console.error("[MobileJobWorker] Sync failed:", error);
      alert(`Failed to sync pending changes: ${error.message}`);
    } finally {
      setPendingSync(false);
    }
  }, [isOnline, loadJobData]); // Depend on isOnline and loadJobData

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

  // Timer useEffect with comprehensive logging for debugging
  useEffect(() => {
    console.log("[MobileJobWorker] 🕐 Timer useEffect triggered with:", {
      jobTimingStatus, hasTimeTrackingData: !!timeTrackingData, sessionStart: timeTrackingData?.current_session_start,
      jobStatus, hasStartTime: !!startTime, startTimeValue: startTime ? new Date(startTime).toISOString() : null
    });

    let interval = null;
    
    if (jobTimingStatus === 'active' && timeTrackingData?.current_session_start) {
      // Robust date parsing for current_session_start (assumed ISO 8601 or similar)
      let sessionStartTimeMs;
      try {
        sessionStartTimeMs = new Date(timeTrackingData.current_session_start).getTime();
        if (isNaN(sessionStartTimeMs)) { // Fallback if initial parsing fails
            console.warn("⚠️ [MobileJobWorker] Invalid session start time format, attempting fallback parsing.");
            const parts = timeTrackingData.current_session_start.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})\.?(\d*)/);
            if (parts) {
                const [, year, month, day, hour, minute, second, ms] = parts;
                sessionStartTimeMs = new Date(
                    parseInt(year), parseInt(month) - 1, parseInt(day),
                    parseInt(hour), parseInt(minute), parseInt(second),
                    parseInt(ms.padEnd(3, '0').substring(0, 3))
                ).getTime();
            }
        }
      } catch (parseError) {
        console.error("❌ [MobileJobWorker] Error parsing session start time in timer useEffect:", parseError);
        sessionStartTimeMs = Date.now(); // Fallback
      }

      // Adjust for potential future timestamps (small tolerance)
      if (sessionStartTimeMs > Date.now() + 5000) {
        console.warn("⚠️ [MobileJobWorker] Session start time is in the future, adjusting to current time for timer calculation.");
        sessionStartTimeMs = Date.now();
      }
      
      if (isNaN(sessionStartTimeMs)) {
        console.error("❌ [MobileJobWorker] Invalid session start time (after all parsing), cannot start timer.");
        return;
      }
      
      interval = setInterval(() => {
        const now = Date.now();
        const sessionElapsed = Math.max(0, now - sessionStartTimeMs);
        const sessionMinutes = Math.floor(sessionElapsed / 60000);
        
        setCurrentSessionTime(sessionElapsed);
        setElapsedTime(sessionElapsed); // Also update legacy timer for display consistency
        
        const baseTotalMinutes = timeTrackingData?.total_minutes || 0;
        const totalWithCurrent = baseTotalMinutes + sessionMinutes;
        setTotalJobTime(totalWithCurrent * 60000); // Convert to milliseconds
      }, 1000);
    } 
    // Fallback timer: Legacy timing (for backward compatibility if new time_tracking not fully adopted)
    else if (jobStatus === "started" && startTime && jobTimingStatus !== 'paused') {
      if (isNaN(startTime)) {
        console.error("❌ [MobileJobWorker] Invalid start time, cannot start fallback timer.");
        return;
      }
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.max(0, now - startTime);
        setElapsedTime(elapsed);
        setCurrentSessionTime(elapsed);
        setTotalJobTime(elapsed); // Assuming legacy `elapsedTime` is the total
      }, 1000);
    } 
    // No active timer
    else {
      // Set static values when no timer is running
      if (jobTimingStatus === 'paused' || jobStatus === 'completed') {
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
        console.log("[MobileJobWorker] 🛑 Clearing timer interval.");
        clearInterval(interval);
      }
    };
  }, [jobTimingStatus, timeTrackingData, jobStatus, startTime]);


  // Main initialization useEffect
  useEffect(() => {
    if (!jobId) {
      setError("No job ID provided. Cannot load job data.");
      setLoading(false);
      return;
    }
    const jobIdNum = parseInt(jobId);
    if (isNaN(jobIdNum) || jobIdNum <= 0) {
      setError("Invalid job ID format. Please provide a valid job number.");
      setLoading(false);
      return;
    }
    console.log(`[MobileJobWorker] Initializing for Job ID: ${jobId}.`);

    // Setup network status monitoring
    const handleOnlineStatusChange = () => {
      const currentOnlineStatus = navigator.onLine;
      setIsOnline(currentOnlineStatus);
      console.log(`[MobileJobWorker] Network status changed: ${currentOnlineStatus ? "Online" : "Offline"}.`);
      if (currentOnlineStatus && !isOnline) { // Only sync if *just* came online
        console.log("[MobileJobWorker] Back online - attempting to sync pending changes.");
        syncPendingChanges();
      }
    };
    window.addEventListener("online", handleOnlineStatusChange);
    window.addEventListener("offline", handleOnlineStatusChange);
    setIsOnline(navigator.onLine); // Set initial status

    // Perform initial data load
    loadJobData(true); // Attempt to load from cache first

    // Cleanup function
    return () => {
      console.log("[MobileJobWorker] Cleaning up Mobile Job Worker.");
      window.removeEventListener("online", handleOnlineStatusChange);
      window.removeEventListener("offline", handleOnlineStatusChange);
    };
  }, [jobId, isOnline, loadJobData, syncPendingChanges]); // Dependencies for useEffect

  /**
   * Handle job start - now shows options modal first
   */
  const handleStartJob = () => {
    setShowStartOptions(true);
  };

  /**
   * Handle job pause - now shows options modal first, and captures work summary
   */
  const handlePauseJob = () => {
    // Generate and set current work summary before showing pause options
    const summary = generateWorkSummary();
    setCurrentWorkSummary(summary);
    setShowPauseOptions(true);
  };

  /**
   * Enhanced start option selection handler - now handles both start and pause scenarios
   */
  const handleStartOptionSelect = async (option) => { // Made async as it calls async functions
    setShowStartOptions(false);
    if (option === "signature") {
      setIsVacantStart(false);
      setSignatureType("start");
      setShowSignaturePad(true);
    } else if (option === "vacant") {
      setIsVacantStart(true);
      await handleVacantJobStart(); // Await this call
    }
  };

  /**
   * Handle pause option selection handler
   */
  const handlePauseOptionSelect = async (option) => {
    setShowPauseOptions(false);
    if (option === "signature") {
      setIsVacantPause(false);
      setSignatureType("pause");
      setShowSignaturePad(true); // Signature pad will now display workSummary
    } else if (option === "vacant") {
      setIsVacantPause(true);
      await handleVacantJobPause(); // Await this call
    }
  };

  /**
   * Handle resume option selection handler
   */
  const handleResumeJob = () => {
    setShowResumeOptions(true);
  };

  const handleResumeOptionSelect = async (option) => {
    setShowResumeOptions(false);
    if (option === "signature") {
      setSignatureType("resume");
      setShowSignaturePad(true);
    } else if (option === "vacant") {
      await handleVacantJobResume(); // Await this call
    }
  };

  /**
   * Handle pausing job without signature (vacant site)
   */
  const handleVacantJobPause = async () => {
    if (!jobData || jobStatus !== "started" || jobStatus === "completed") {
      alert(jobStatus === "completed" ? "Cannot pause completed job." : "Job must be started before it can be paused.");
      return;
    }
    setUploading(true);
    try {
      console.log(`[MobileJobWorker] Pausing vacant job for Job ID: ${jobData.id}.`);
      await mobileWorkerService.pauseJob(jobData.id);

      // Perform optimistic UI update
      const newTimeTrackingData = {
          ...jobData.time_tracking,
          job_timing_status: 'paused',
          has_active_session: false,
          current_session_start: null,
      };
      setJobData(prev => ({ ...prev, time_tracking: newTimeTrackingData }));
      setJobTimingStatus('paused');
      setTimeTrackingData(newTimeTrackingData);
      setStartTime(null);

      setCurrentWorkSummary(null); // Clear summary after action
      alert("Job paused successfully at vacant site.");
      setTimeout(() => loadJobData(false), 3000);
    } catch (error) {
      console.error("[MobileJobWorker] Error pausing vacant job:", error);
      alert(`Failed to pause job: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle resuming job without signature (vacant site)
   */
  const handleVacantJobResume = async () => {
    if (!jobData || jobTimingStatus !== 'paused') {
      alert("Job must be paused before it can be resumed as vacant.");
      return;
    }
    setUploading(true);
    try {
      console.log(`[MobileJobWorker] Resuming vacant job for Job ID: ${jobData.id}.`);
      await mobileWorkerService.resumeJob(jobData.id);
      
      // Perform optimistic UI update
      const currentTime = Date.now();
      const newStartTimeISO = new Date(currentTime).toISOString();
      const newTimeTrackingData = {
          ...jobData.time_tracking,
          job_timing_status: 'active',
          has_active_session: true,
          current_session_start: newStartTimeISO,
      };

      setJobData(prev => ({ ...prev, time_tracking: newTimeTrackingData }));
      setJobTimingStatus('active');
      setTimeTrackingData(newTimeTrackingData);
      setStartTime(currentTime);

      alert("Job resumed successfully at vacant site.");
      setTimeout(() => loadJobData(false), 3000);
    } catch (error) {
      console.error("[MobileJobWorker] Error resuming vacant job:", error);
      alert(`Failed to resume job: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle starting job without signature (vacant site) with comprehensive validation and error handling
   */
  const handleVacantJobStart = async () => {
    if (!jobData || jobStatus === "started" || jobStatus === "completed") {
      alert(jobStatus === "started" ? "This job has already been started." : jobStatus === "completed" ? "This job has already been completed." : "Error: Job data not loaded. Please refresh and try again.");
      return;
    }
    const jobIdNum = parseInt(jobData.id);
    if (isNaN(jobIdNum) || jobIdNum <= 0) {
      alert("Error: Invalid job ID. Cannot start job.");
      return;
    }

    setUploading(true);
    try {
      console.log(`[MobileJobWorker] Starting vacant job for Job ID: ${jobData.id}.`);
      await mobileWorkerService.startJob(jobData.id, "", "VACANT SITE", "No Contact Available");

      // Perform comprehensive optimistic update
      const currentTime = Date.now();
      const newStartTimeISO = new Date(currentTime).toISOString();
      const newTimeTrackingData = {
          ...(jobData.time_tracking || {}),
          current_session_start: newStartTimeISO,
          has_active_session: true,
          job_timing_status: 'active',
          session_count: (jobData.time_tracking?.session_count || 0) + 1,
      };

      setJobData(prev => ({
          ...prev,
          mobile_status: 'started',
          time_tracking: newTimeTrackingData,
      }));

      // Update individual states for consistency
      setJobStatus("started");
      setJobTimingStatus('active');
      setTimeTrackingData(newTimeTrackingData);
      setStartTime(currentTime);

      console.log("[MobileJobWorker] Job started successfully as vacant site - state updated optimistically.");
      alert("Job started successfully at vacant site.");
      // Background refresh after a longer delay to avoid race conditions
      setTimeout(() => loadJobData(false), 3000); 
    } catch (error) {
      console.error("[MobileJobWorker] Error starting vacant job:", error);
      alert(`Failed to start job: ${error.message}`);
      if (!isOnline) {
        alert("You are offline. The job start will be synced when connection is restored.");
      }
    } finally {
      setUploading(false);
    }
  };

  /**
   * Enhanced signature saving handler - now supports pause signatures with work summary
   */
  const handleSignatureSave = async (signature) => {
    if (!signature || typeof signature !== "string" || !signature.startsWith("data:image/")) {
      alert("Error: Invalid signature data. Please try signing again."); return;
    }
    if (!jobData) {
      alert("Error: Job data not loaded. Please refresh and try again."); return;
    }
    const jobIdNum = parseInt(jobData.id);
    if (isNaN(jobIdNum) || jobIdNum <= 0) {
      alert("Error: Invalid job ID. Cannot save signature."); return;
    }

    const contactName = jobData.contact_name || "Site Contact";
    const contactTitle = "Authorized Representative";

    setUploading(true);
    try {
      console.log(`[MobileJobWorker] Saving ${signatureType} signature for Job ID: ${jobData.id}.`);

      if (signatureType === "start") {
        if (jobStatus === "started" || jobStatus === "completed") {
          alert(jobStatus === "started" ? "This job has already been started." : "This job has already been completed.");
          setShowSignaturePad(false); return;
        }
        await mobileWorkerService.startJob(jobData.id, signature, contactName, contactTitle);
        
        // Perform comprehensive optimistic update
        const currentTime = Date.now();
        const newStartTimeISO = new Date(currentTime).toISOString();
        const newTimeTrackingData = {
            ...(jobData.time_tracking || {}),
            current_session_start: newStartTimeISO,
            has_active_session: true,
            job_timing_status: 'active',
            session_count: (jobData.time_tracking?.session_count || 0) + 1,
        };

        setJobData(prev => ({ ...prev, mobile_status: 'started', time_tracking: newTimeTrackingData }));
        setJobStatus("started");
        setJobTimingStatus('active');
        setTimeTrackingData(newTimeTrackingData);
        setStartTime(currentTime);

      } else if (signatureType === "pause") {
        if (jobStatus !== "started" || jobStatus === "completed") {
          alert(jobStatus === "completed" ? "Cannot pause completed job." : "Job must be started before it can be paused.");
          setShowSignaturePad(false); return;
        }
        await mobileWorkerService.pauseJob(jobData.id, signature, contactName, contactTitle);
        
        // Perform optimistic UI update
        const newTimeTrackingData = {
            ...jobData.time_tracking,
            job_timing_status: 'paused',
            has_active_session: false,
            current_session_start: null,
        };
        setJobData(prev => ({ ...prev, time_tracking: newTimeTrackingData }));
        setJobTimingStatus('paused');
        setTimeTrackingData(newTimeTrackingData);
        setStartTime(null);

      } else if (signatureType === "resume") {
        if (jobTimingStatus !== 'paused') { alert("Job must be paused before it can be resumed."); setShowSignaturePad(false); return; }
        await mobileWorkerService.resumeJob(jobData.id, signature, contactName, contactTitle);
        
        // Perform optimistic UI update
        const currentTime = Date.now();
        const newStartTimeISO = new Date(currentTime).toISOString();
        const newTimeTrackingData = {
            ...jobData.time_tracking,
            job_timing_status: 'active',
            has_active_session: true,
            current_session_start: newStartTimeISO,
        };
        setJobData(prev => ({ ...prev, time_tracking: newTimeTrackingData }));
        setJobTimingStatus('active');
        setTimeTrackingData(newTimeTrackingData);
        setStartTime(currentTime);

      } else if (signatureType === "door_complete") {
        if (!selectedDoor || selectedDoor.completed || !isDoorReadyForCompletion(selectedDoor)) {
          alert("Door not ready for completion: complete all items, photo, video."); setShowSignaturePad(false); return;
        }
        const doorIdNum = parseInt(selectedDoor.id);
        if (isNaN(doorIdNum) || doorIdNum <= 0) { alert("Error: Invalid door ID. Cannot complete door."); setShowSignaturePad(false); return; }

        await mobileWorkerService.completeDoor(selectedDoor.id, jobData.id, signature, contactName, contactTitle);
        setJobData((prev) => ({
          ...prev, doors: prev.doors.map((door) => door.id === selectedDoor.id ? { ...door, completed: true, has_signature: true } : door),
          completed_doors: (prev.completed_doors || 0) + 1,
        }));
      } else if (signatureType === "final") {
        if (jobStatus === "completed" || jobStatus !== "started" || !canCompleteJob()) {
          alert(jobStatus === "completed" ? "Job already completed." : jobStatus !== "started" ? "Job must be started before completion." : "Complete all doors first.");
          setShowSignaturePad(false); return;
        }
        await mobileWorkerService.completeJob(jobData.id, signature, contactName, contactTitle);
        setJobData(prev => ({ ...prev, mobile_status: 'completed', time_tracking: {...prev.time_tracking, job_timing_status: 'completed'} }));
        setJobStatus("completed");
        setJobTimingStatus("completed");
      } else { throw new Error(`Invalid signature type: ${signatureType}`); }

      setShowSignaturePad(false);
      if (signatureType === "pause") { setCurrentWorkSummary(null); }
      // Background refresh after a longer delay to avoid race conditions
      setTimeout(() => loadJobData(false), 3000); 

      const successMessages = {
        start: "Job started successfully!", pause: "Job paused successfully!", resume: "Job resumed successfully!",
        door_complete: `Door #${selectedDoor?.door_number || ""} completed successfully!`, final: "Job completed successfully!",
      };
      alert(successMessages[signatureType] || "Signature saved successfully!");
    } catch (error) {
      console.error("[MobileJobWorker] Error saving signature:", error);
      alert(`Failed to save ${signatureType} signature: ${error.message}`);
      if (!isOnline) {
        alert("You are offline. The signature will be synced when connection is restored.");
      }
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle media capture (photo/video) with comprehensive validation and error handling
   * Now handles videos that have already been rotated by the CameraCapture component
   */
  const handleMediaCapture = async (media, type) => {
    if (!media || !["photo", "video"].includes(type) || !selectedDoor || !jobData || jobStatus !== "started") {
      alert("Error: Missing data or invalid state for media upload."); return;
    }
    const doorIdNum = parseInt(selectedDoor.id);
    const jobIdNum = parseInt(jobData.id);
    if (isNaN(doorIdNum) || doorIdNum <= 0 || isNaN(jobIdNum) || jobIdNum <= 0) {
      alert("Error: Invalid Door/Job ID for media upload."); return;
    }

    let mediaSize = 0;
    let uploadFunction;
    let mediaDataForService;

    try {
      if (type === "photo") {
        if (typeof media !== "string" || !media.startsWith("data:image/")) throw new Error("Invalid photo format.");
        mediaSize = (media.split(",")[1]?.length || 0) * 3 / 4;
        uploadFunction = mobileWorkerService.uploadDoorPhoto;
        mediaDataForService = media; // Pass Data URL
      } else if (type === "video") {
        if (!(media instanceof Blob)) throw new Error("Invalid video format - expected Blob.");
        mediaSize = media.size;
        uploadFunction = mobileWorkerService.uploadDoorVideo;
        mediaDataForService = media; // Pass the already-rotated Blob
        console.log("Video blob received for upload (already rotated if needed):", mediaSize, "bytes");
      } else { throw new Error("Unknown media type."); }

      // Validate file size (add your size constraints if needed, or let backend handle)
      const maxPhotoSize = 10 * 1024 * 1024; // Example max photo size
      const maxVideoSize = 100 * 1024 * 1024; // Example max video size
      if ((type === 'photo' && mediaSize > maxPhotoSize) || (type === 'video' && mediaSize > maxVideoSize)) {
        alert(`Error: ${type} file is too large.`); return;
      }
      if (mediaSize === 0) { alert(`Error: ${type} file is empty.`); return; }

    } catch (validationError) {
      console.error("[MobileJobWorker] Media validation error:", validationError);
      alert(`Error validating ${type}: ${validationError.message}.`); return;
    }

    setUploading(true);
    try {
      console.log(`[MobileJobWorker] Uploading ${type} for Door ${selectedDoor.door_number} in Job ${jobData.id}.`);
      console.log(`[MobileJobWorker] Media size: ${(mediaSize / 1024).toFixed(1)} KB.`);

      const uploadResponse = await uploadFunction(selectedDoor.id, jobData.id, mediaDataForService);

      const mediaInfo = {
        id: uploadResponse?.media_id || uploadResponse?.id || Date.now(),
        url: uploadResponse?.media_url || uploadResponse?.url || (type === "photo" ? media : null),
        thumbnail_url: uploadResponse?.thumbnail_url || uploadResponse?.thumb_url || (type === "photo" ? media : null),
        uploaded_at: uploadResponse?.uploaded_at || new Date().toISOString(),
      };

      if (type === 'photo') {
        setJobData((prev) => ({
          ...prev,
          doors: prev.doors.map((door) =>
            door.id === selectedDoor.id
              ? { ...door, photos: [...(door.photos || []), mediaInfo] }
              : door
          ),
        }));
        setSelectedDoor((prev) => ({
          ...prev,
          photos: [...(prev.photos || []), mediaInfo],
        }));
      } else if (type === 'video') {
        // Video logic remains the same (1 per door)
        setJobData((prev) => ({
          ...prev,
          doors: prev.doors.map((door) =>
            door.id === selectedDoor.id ? { ...door, has_video: true, video_info: mediaInfo } : door
          ),
        }));
        setSelectedDoor((prev) => ({
          ...prev, has_video: true, video_info: mediaInfo
        }));
      }
      
      setShowCamera(false);
      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} captured and uploaded successfully for Door #${selectedDoor.door_number}!`);
      // Background refresh after a short delay
      setTimeout(() => loadJobData(false), 3000);
    } catch (error) {
      console.error(`[MobileJobWorker] Error uploading ${type}:`, error);
      alert(`Failed to upload ${type}: ${error.message}.`);
      if (!isOnline) { // Service method already queues if network error
        alert(`You are offline. The ${type} will be uploaded when connection is restored.`);
      }
    } finally {
      setUploading(false);
    }
  };

  // Memoized for stability: `getDoorProgress` no longer needs to be `useCallback`
  // since it's a simple calculation and does not depend on component state directly.
  const getDoorProgress = (door) => {
    const completedItems = (door.line_items || []).filter(item => item.completed).length;
    return (door.line_items && door.line_items.length > 0) ? (completedItems / door.line_items.length) * 100 : 0;
  };

  // Memoized for stability: `isDoorReadyForCompletion`
  const isDoorReadyForCompletion = React.useCallback((door) => {
    if (!door) return false;
    const allItemsCompleted = (door.line_items || []).every((item) => item.completed);
    const hasAtLeastOnePhoto = door.photos && door.photos.length > 0;
    return allItemsCompleted && hasAtLeastOnePhoto && door.has_video;
  }, []); // No dependencies, it's a pure function of `door` prop

  // Memoized for stability: `canCompleteJob`
  const canCompleteJob = React.useCallback(() => {
    return jobData && jobData.doors && jobData.doors.every((door) => door.completed);
  }, [jobData]); // Depends only on jobData

  /**
   * Handle door completion
   */
  const handleCompleteDoor = () => {
    if (!isDoorReadyForCompletion(selectedDoor)) {
      alert("Please complete all line items, capture at least one photo, and record a video before completing this door.");
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
  const handleRefresh = React.useCallback(() => {
    loadJobData(false); // Force refresh
  }, [loadJobData]);

  // Handle line item toggle
  const handleToggleLineItem = async (lineItem) => {
    if (!jobData || !selectedDoor) return;

    // Store the state before the optimistic update for potential rollback on API failure.
    const previousJobData = jobData;
    const previousSelectedDoor = selectedDoor;

    // --- Start of Robust Optimistic Update ---
    // This logic prevents race conditions where a background data refresh might
    // overwrite recent optimistic updates (like added media) from the UI.

    const newCompletedStatus = !lineItem.completed;

    // 1. Create the updated door object based on the current `selectedDoor` state.
    // This preserves any previous optimistic updates (like added photos) that might not yet be in the main `jobData`.
    const updatedSelectedDoor = {
      ...selectedDoor,
      line_items: selectedDoor.line_items.map(item =>
        item.id === lineItem.id
          ? { ...item, completed: newCompletedStatus, completed_at: newCompletedStatus ? new Date().toISOString() : null }
          : item
      ),
    };

    // 2. Create the new `jobData` state by replacing the relevant door with our updated version.
    const optimisticJobData = {
      ...jobData,
      doors: jobData.doors.map(door =>
        door.id === selectedDoor.id ? updatedSelectedDoor : door
      ),
    };

    // 3. Update the UI instantly with the new, consistent state.
    setJobData(optimisticJobData);
    setSelectedDoor(updatedSelectedDoor);
    
    // --- End of Optimistic Update ---


    // 4. Make the API call in the background.
    try {
      await mobileWorkerService.toggleLineItem(
        jobData.id,
        lineItem.id
      );
      
      console.log(`Successfully toggled line item ${lineItem.id} to ${newCompletedStatus}`);
      // If the API call is successful, the optimistic state is now confirmed as correct.

    } catch (err) {
      // 5. If the API fails, alert the user and revert the UI to its original state.
      console.error("Error toggling line item:", err);
      alert("Failed to update work item on the server. Reverting the change.");
      
      setJobData(previousJobData); // Revert to the state before the optimistic update
      setSelectedDoor(previousSelectedDoor); // Revert to the state before the optimistic update
    }
  };

  /**
   * Door Detail Component - Displays details and work items for a selected door
   */
  const DoorDetail = () => {
    if (!selectedDoor) {
      return (
        <div className="mobile-section-spacing mobile-error-card">
          <h2 className="mobile-text-lg mobile-font-semibold mb-4">No Door Selected</h2>
          <p className="mobile-text-gray-600">Please select a door from the overview.</p>
          <button onClick={() => setCurrentView("overview")} className="mobile-button mobile-button-gray mt-4">
            <ArrowLeft className="icon-md" /> Back to Job Overview
          </button>
        </div>
      );
    }

    const progress = getDoorProgress(selectedDoor);
    const readyForCompletion = isDoorReadyForCompletion(selectedDoor);

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
          <h1 className="mobile-text-xl mobile-font-bold">
            Door #{selectedDoor.door_number}
          </h1>
          {selectedDoor.completed && (
            <CheckCircle className="icon-xl mobile-text-green-600 ml-auto" />
          )}
        </div>

        {/* Door Info Card */}
        <div className="mobile-card">
          <h3 className="mobile-font-semibold mb-3">Door Information</h3>
          <div className="mobile-section-spacing mobile-text-sm">
            <div className="flex-align-center flex-gap-2">
              <MapPin className="icon-sm mobile-text-gray-500" />
              <span>Location: {selectedDoor.location}</span>
            </div>
            <div className="flex-align-center flex-gap-2">
              <FileText className="icon-sm mobile-text-gray-500" />
              <span>Description: {selectedDoor.labor_description}</span>
            </div>
            {selectedDoor.notes && (
              <div className="flex-align-center flex-gap-2">
                <FileText className="icon-sm mobile-text-gray-500" />
                <span>Notes: {selectedDoor.notes}</span>
              </div>
            )}
            {selectedDoor.door_type && (
              <div className="flex-align-center flex-gap-2">
                <span>Type: {selectedDoor.door_type}</span>
              </div>
            )}
            {selectedDoor.width && selectedDoor.height && (
              <div className="flex-align-center flex-gap-2">
                <span>Dimensions: {selectedDoor.width} x {selectedDoor.height} {selectedDoor.dimension_unit}</span>
              </div>
            )}
          </div>
        </div>

        {/* Media Section */}
        <div className="mobile-card">
          <h3 className="mobile-font-semibold mb-3">Media</h3>
          <div className="media-section-buttons">
            <button
              onClick={() => {
                setCameraType("photo");
                setShowCamera(true);
              }}
              disabled={
                (selectedDoor.photos && selectedDoor.photos.length >= 5) ||
                uploading ||
                jobStatus !== "started"
              }
              className="mobile-button mobile-button-gray"
            >
              <Camera className="icon-md" />
              {selectedDoor.photos && selectedDoor.photos.length >= 5
                ? "Max Photos"
                : `Add Photo (${(selectedDoor.photos || []).length}/5)`}
            </button>
            <button
              onClick={() => {
                setCameraType("video");
                setShowCamera(true);
              }}
              disabled={selectedDoor.has_video || uploading || jobStatus !== "started"}
              className="mobile-button mobile-button-gray"
            >
              {selectedDoor.has_video ? (
                <CheckCircle className="icon-md mobile-text-green-600" />
              ) : (
                <Video className="icon-md" />
              )}
              Video
            </button>
          </div>
          
          {/* Photo Gallery */}
          <div className="mt-4">
            <h4 className="mobile-text-sm mobile-font-medium mb-2">Captured Photos:</h4>
            {(selectedDoor.photos && selectedDoor.photos.length > 0) ? (
                <div className="photo-thumbnail-gallery">
                    {selectedDoor.photos.map(photo => (
                        <div key={photo.id} className="photo-thumbnail-item">
                            <img src={apiServerRoot + photo.thumbnail_url} alt={`Photo thumbnail for door #${selectedDoor.door_number}`} />
                        </div>
                    ))}
                </div>
            ) : (
                <p className="mobile-text-sm mobile-text-gray-600">No photos captured for this door yet.</p>
            )}
          </div>
          
          {/* Video Status */}
          <div className="mobile-text-sm mobile-text-gray-600 mt-3">
            {selectedDoor.has_video && (
              <p className="flex-align-center flex-gap-1">
                <CheckCircle className="icon-sm mobile-text-green-600" /> Video Captured
              </p>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div className="mobile-card">
          <h3 className="mobile-font-semibold mb-3">Work Items</h3>
          {selectedDoor.line_items && selectedDoor.line_items.length > 0 ? (
            <div className="mobile-item-spacing">
              {selectedDoor.line_items.map((item) => (
                <div
                  key={item.id}
                  className={`line-item-card ${
                    item.completed ? "completed" : ""
                  }`}
                  onClick={() => jobStatus === "started" && handleToggleLineItem(item)}
                >
                  <div className="flex-align-center flex-gap-2">
                    {item.completed ? (
                      <CheckSquare className="icon-md mobile-text-green-600" />
                    ) : (
                      <Square className="icon-md mobile-text-gray-500" />
                    )}
                    <span className="mobile-font-medium">
                      {item.description}
                    </span>
                  </div>
                  <span className="mobile-text-sm mobile-text-gray-600">
                    Part: {item.part_number} • Qty: {item.quantity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mobile-text-gray-600">No work items for this door.</p>
          )}
        </div>

        {/* Door Completion Status */}
        <div className="mobile-card">
          <h3 className="mobile-font-semibold mb-3">Door Completion</h3>
          <div className="mobile-section-spacing">
            <div className="flex-align-center flex-gap-2 mobile-text-sm mb-2">
              <span>Progress:</span>
              <div className="door-list-progress-bar-bg flex-grow">
                <div
                  className={`door-list-progress-bar-fg ${
                    selectedDoor.completed ? "completed" : "in-progress"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span>{Math.round(progress)}%</span>
            </div>
            {selectedDoor.completed ? (
              <div className="flex-align-center flex-gap-2 mobile-text-green-700">
                <CheckCircle className="icon-md" />
                <span>Door Marked as Complete!</span>
              </div>
            ) : (
              <div className="flex-align-center flex-gap-2 mobile-text-red-700">
                <AlertTriangle className="icon-md" />
                <span>
                  {readyForCompletion
                    ? "Ready to Complete"
                    : "Complete all items, photo, and video."}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleCompleteDoor}
            disabled={!readyForCompletion || selectedDoor.completed || uploading || jobStatus !== "started"}
            className="mobile-button mobile-button-green mt-4"
          >
            {uploading ? (
              <Loader className="icon-md animate-spin" />
            ) : (
              <CheckCircle className="icon-md" />
            )}
            {uploading ? "Completing..." : "Complete Door"}
          </button>
        </div>
      </div>
    );
  };

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
                  {(jobTimingStatus || '').toUpperCase()}
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
    // jobData is guaranteed to be not null here due to early returns
    const totalTime = formatTime(totalJobTime); // Use totalJobTime state

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
      {/* Conditional Rendering for top-level states */}
      {/* This ensures jobData is populated before rendering components that depend on it */}
      {(() => {
        if (!jobId) {
          return (
            <div className="mobile-job-worker-container mobile-error-card">
              <h2 className="mobile-text-lg mobile-font-semibold mb-4">No Job Selected</h2>
              <p className="mobile-text-gray-600">Please select a job from the list to view its details.</p>
              {/* Add a button to navigate back to the job list if this component is used on a standalone page */}
              {/* <button onClick={() => window.history.back()} className="mobile-button mobile-button-gray mt-4">Back to Jobs</button> */}
            </div>
          );
        }
        if (loading) {
          return (
            <div className="mobile-job-worker-container mobile-loading-card">
              <Loader className="icon-lg animate-spin mobile-text-blue-600" />
              <p className="mobile-text-lg mobile-font-semibold mt-4">Loading Job Data...</p>
              <p className="mobile-text-gray-600">Please wait while we fetch the job details.</p>
            </div>
          );
        }
        if (error) {
          return (
            <div className="mobile-job-worker-container mobile-error-card">
              <AlertTriangle className="icon-xxl mobile-text-red-500 mx-auto mb-4" />
              <h2 className="mobile-text-lg mobile-font-semibold mb-2">Error Loading Job</h2>
              <p className="mobile-text-gray-600 mb-4">{error}</p>
              <button onClick={handleRefresh} className="mobile-button mobile-button-blue">
                <RefreshCw className="icon-md" /> Try Again
              </button>
            </div>
          );
        }
        return null; // Return null if no early exit
      })()}

      {/* Only render the main content if jobData is available (not null, not loading, no error) */}
      {jobData && !loading && !error && (
        <>
          {/* Status Bar */}
          <div className="mobile-job-worker-status-bar">
            <div className="status-bar-left">
              <div
                className={`status-indicator-dot ${(jobStatus || '').replace("_", "-")}`}
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
        </>
      )}
    </div>
  );
};

export default MobileJobWorker;