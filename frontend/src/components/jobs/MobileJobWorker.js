import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
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
  Loader
} from 'lucide-react';
import mobileWorkerService from '../../services/MobileWorkerService';
import './MobileJobWorker.css'; // <-- IMPORT THE CSS FILE

/**
 * Custom Signature Pad Component
 * Provides touch and mouse support for signature capture
 */
const SignaturePad = ({ onSave, onCancel, title = "Signature" }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }, []);

  const getEventPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getEventPos(e);
    setLastPosition(pos);
    
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const pos = getEventPos(e);
    const ctx = canvasRef.current.getContext('2d');
    
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
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const saveSignature = () => {
    if (isEmpty) {
      alert('Please provide a signature before saving.');
      return;
    }
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL('image/png');
    onSave(dataURL);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="border-2 border-gray-300 rounded-lg mb-4 bg-white">
          <canvas
            ref={canvasRef}
            className="w-full h-48 touch-none cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ touchAction: 'none' }}
          />
        </div>
        <p className="text-sm text-gray-600 mb-4">Please sign above</p>
        <div className="flex gap-2">
          <button
            onClick={clearSignature}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveSignature}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
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
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        },
        audio: type === 'video'
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions and try again.');
    }
  };

  const capturePhoto = () => {
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const dataURL = canvas.toDataURL('image/jpeg', 0.8);
    onCapture(dataURL, 'photo');
  };

  const startVideoRecording = () => {
    if (!stream) return;
    
    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus'
    });
    
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      onCapture(blob, 'video');
    };
    
    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
  };

  const stopVideoRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Camera Error</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-md mx-4">
        <div className="mb-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg bg-black"
            style={{ aspectRatio: '16/9' }}
          />
        </div>
        
        {isRecording && (
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Recording...</span>
            </div>
          </div>
        )}
        
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          
          {type === 'photo' ? (
            <button
              onClick={capturePhoto}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Capture Photo
            </button>
          ) : (
            <button
              onClick={isRecording ? stopVideoRecording : startVideoRecording}
              className={`flex-1 px-4 py-2 rounded-md text-white transition-colors flex items-center justify-center gap-2 ${
                isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Video className="w-4 h-4" />
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Main Mobile Job Worker Component
 * Complete field worker interface for job management
 */
const MobileJobWorker = ({ jobId }) => {
  // Job state management
  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobStatus, setJobStatus] = useState('not_started');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState(null);
  
  // UI state management
  const [currentView, setCurrentView] = useState('overview');
  const [selectedDoor, setSelectedDoor] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState('photo');
  const [signatureType, setSignatureType] = useState('start');
  
  // Network and offline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false);
  const [uploading, setUploading] = useState(false);

  /**
   * Load job data from API or cache
   */
  const loadJobData = async (useCache = true) => {
    setLoading(true);
    setError(null);
    
    try {
      let data;
      
      if (!isOnline) {
        // Try to get cached data when offline
        data = mobileWorkerService.getCachedJob(jobId);
        if (!data) {
          throw new Error('No cached job data available offline');
        }
      } else {
        // Fetch from API when online
        data = await mobileWorkerService.getJob(jobId, useCache);
        
        // Cache for offline use
        await mobileWorkerService.cacheJobForOffline(jobId);
      }
      
      setJobData(data);
      setJobStatus(data.mobile_status || 'not_started');
      
      // Set up timer if job is in progress
      if (data.start_time && data.mobile_status === 'started') {
        const startTimestamp = new Date(data.start_time).getTime();
        setStartTime(startTimestamp);
      }
      
    } catch (err) {
      console.error('Error loading job data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Timer effect for tracking elapsed time
   */
  useEffect(() => {
    let interval = null;
    if (jobStatus === 'started' && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [jobStatus, startTime]);

  /**
   * Initialize component and set up offline handlers
   */
  useEffect(() => {
    if (!jobId) {
      setError('No job ID provided');
      return;
    }

    loadJobData();

    // Set up online/offline handlers
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingChanges();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    mobileWorkerService.setupOfflineHandlers(handleOnline, handleOffline);
    
    // Initial online status
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [jobId]);

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
      console.error('Sync failed:', error);
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
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * Handle job start with signature
   */
  const handleStartJob = () => {
    setSignatureType('start');
    setShowSignaturePad(true);
  };

  /**
   * Handle signature saving for different types
   */
  const handleSignatureSave = async (signature) => {
    try {
      setUploading(true);
      
      if (signatureType === 'start') {
        if (isOnline) {
          await mobileWorkerService.startJob(
            jobId, 
            signature, 
            jobData?.contact_name || '', 
            'Site Contact'
          );
          await loadJobData(false);
        } else {
          // Store for offline sync
          mobileWorkerService.storePendingChange('job_start', {
            jobId,
            signature,
            signerName: jobData?.contact_name || '',
            signerTitle: 'Site Contact'
          });
          setJobStatus('started');
          setStartTime(Date.now());
        }
      } else if (signatureType === 'door_complete') {
        if (isOnline) {
          await mobileWorkerService.completeDoor(
            selectedDoor.id,
            jobId,
            signature,
            jobData?.contact_name || '',
            'Site Contact'
          );
          await loadJobData(false);
        } else {
          mobileWorkerService.storePendingChange('door_complete', {
            doorId: selectedDoor.id,
            jobId,
            signature,
            signerName: jobData?.contact_name || '',
            signerTitle: 'Site Contact'
          });
          // Update local state
          setJobData(prev => ({
            ...prev,
            doors: prev.doors.map(door =>
              door.id === selectedDoor.id
                ? { ...door, completed: true, has_signature: true }
                : door
            )
          }));
        }
      } else if (signatureType === 'final') {
        if (isOnline) {
          await mobileWorkerService.completeJob(
            jobId,
            signature,
            jobData?.contact_name || '',
            'Site Contact'
          );
          await loadJobData(false);
        } else {
          mobileWorkerService.storePendingChange('job_complete', {
            jobId,
            signature,
            signerName: jobData?.contact_name || '',
            signerTitle: 'Site Contact'
          });
          setJobStatus('completed');
        }
      }
      
      setShowSignaturePad(false);
    } catch (error) {
      console.error('Error saving signature:', error);
      alert(`Failed to save signature: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle media capture (photo/video)
   */
  const handleMediaCapture = async (media, type) => {
    try {
      setUploading(true);
      
      if (isOnline) {
        if (type === 'photo') {
          await mobileWorkerService.uploadDoorPhoto(selectedDoor.id, jobId, media);
        } else {
          await mobileWorkerService.uploadDoorVideo(selectedDoor.id, jobId, media);
        }
        await loadJobData(false);
      } else {
        // Store media locally for offline sync
        const storageKey = `offline_${type}_${selectedDoor.id}_${jobId}`;
        if (type === 'photo') {
          localStorage.setItem(storageKey, media); // data URL
        } else {
          // For video blobs, we'd need a more sophisticated offline storage solution
          alert('Video upload requires internet connection');
          return;
        }
        
        // Update local state
        setJobData(prev => ({
          ...prev,
          doors: prev.doors.map(door =>
            door.id === selectedDoor.id
              ? { ...door, [`has_${type}`]: true }
              : door
          )
        }));
      }
      
      setShowCamera(false);
    } catch (error) {
      console.error('Error uploading media:', error);
      alert(`Failed to upload ${type}: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Toggle line item completion status
   */
  const toggleLineItem = async (doorId, lineItemId) => {
    try {
      if (isOnline) {
        await mobileWorkerService.toggleLineItem(jobId, lineItemId);
        await loadJobData(false);
      } else {
        // Store for offline sync
        mobileWorkerService.storePendingChange('line_item', {
          jobId,
          lineItemId
        });
        
        // Update local state
        setJobData(prev => ({
          ...prev,
          doors: prev.doors.map(door => 
            door.id === doorId 
              ? {
                  ...door,
                  line_items: door.line_items.map(item =>
                    item.id === lineItemId
                      ? { ...item, completed: !item.completed }
                      : item
                  )
                }
              : door
          )
        }));
      }
    } catch (error) {
      console.error('Error toggling line item:', error);
      alert(`Failed to update line item: ${error.message}`);
    }
  };

  /**
   * Calculate door completion progress
   */
  const getDoorProgress = (door) => {
    const completedItems = door.line_items.filter(item => item.completed).length;
    return (completedItems / door.line_items.length) * 100;
  };

  /**
   * Check if door is ready for completion
   */
  const isDoorReadyForCompletion = (door) => {
    const allItemsCompleted = door.line_items.every(item => item.completed);
    return allItemsCompleted && door.has_photo && door.has_video;
  };

  /**
   * Check if job can be completed
   */
  const canCompleteJob = () => {
    return jobData && jobData.doors.every(door => door.completed);
  };

  /**
   * Handle door completion
   */
  const handleCompleteDoor = () => {
    if (!isDoorReadyForCompletion(selectedDoor)) {
      alert('Please complete all line items, capture a photo, and record a video before completing this door.');
      return;
    }
    setSignatureType('door_complete');
    setShowSignaturePad(true);
  };

  /**
   * Handle job completion
   */
  const handleCompleteJob = () => {
    if (!canCompleteJob()) {
      alert('Please complete all doors before finishing the job.');
      return;
    }
    setSignatureType('final');
    setShowSignaturePad(true);
  };

  /**
   * Refresh job data
   */
  const handleRefresh = () => {
    loadJobData(false);
  };

  /**
   * Loading state component
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  /**
   * Error state component
   */
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border p-6 w-full max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-center mb-2">Error Loading Job</h2>
          <p className="text-gray-600 text-center mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors"
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
    <div className="space-y-4">
      {/* Job Header Card */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">Job #{jobData.job_number}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            jobStatus === 'not_started' ? 'bg-gray-100 text-gray-800' :
            jobStatus === 'started' ? 'bg-blue-100 text-blue-800' :
            'bg-green-100 text-green-800'
          }`}>
            {jobStatus === 'not_started' ? 'Not Started' :
             jobStatus === 'started' ? 'In Progress' :
             'Completed'}
          </span>
        </div>
        
        {jobStatus === 'started' && (
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Clock className="w-4 h-4" />
            <span className="font-mono">{formatTime(elapsedTime)}</span>
          </div>
        )}
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-500" />
            <span>{jobData.customer_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span>{jobData.address}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-500" />
            <span>{jobData.contact_name} • {jobData.phone}</span>
          </div>
        </div>
        
        {jobData.job_scope && (
          <div className="mt-3 p-3 bg-gray-50 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-sm">Scope of Work</span>
            </div>
            <p className="text-sm text-gray-700">{jobData.job_scope}</p>
          </div>
        )}
      </div>

      {/* Action Button Section */}
      {jobStatus === 'not_started' && (
        <button
          onClick={handleStartJob}
          disabled={uploading}
          className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
          {uploading ? 'Starting...' : 'Start Job'}
        </button>
      )}

      {jobStatus === 'started' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800 mb-2">
            <Clock className="w-5 h-5" />
            <span className="font-semibold">Job in Progress</span>
          </div>
          <p className="text-blue-700 text-sm">
            Started: {startTime ? new Date(startTime).toLocaleTimeString() : 'N/A'}
          </p>
          <p className="text-blue-700 text-sm">
            Elapsed: {formatTime(elapsedTime)}
          </p>
        </div>
      )}

      {jobStatus === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800 mb-2">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Job Completed</span>
          </div>
          <button
            onClick={() => setCurrentView('summary')}
            className="w-full mt-2 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            View Summary
          </button>
        </div>
      )}

      {/* Doors List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Doors ({jobData.doors.length})</h2>
        
        {jobData.doors.map(door => {
          const progress = getDoorProgress(door);
          const isCompleted = door.completed;
          
          return (
            <div
              key={door.id}
              className={`bg-white rounded-lg shadow-sm border p-4 transition-all ${
                jobStatus === 'not_started' 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'cursor-pointer hover:bg-gray-50 hover:shadow-md'
              }`}
              onClick={() => {
                if (jobStatus !== 'not_started') {
                  setSelectedDoor(door);
                  setCurrentView('door_detail');
                }
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Door #{door.door_number}</span>
                  {isCompleted && <CheckCircle className="w-5 h-5 text-green-600" />}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
              
              <p className="text-sm text-gray-600 mb-2">{door.location}</p>
              <p className="text-sm text-gray-500 mb-3">{door.labor_description}</p>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isCompleted ? 'bg-green-500' : 'bg-blue-500'
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
      {jobStatus === 'started' && canCompleteJob() && (
        <button
          onClick={handleCompleteJob}
          disabled={uploading}
          className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
          {uploading ? 'Completing...' : 'Complete Job'}
        </button>
      )}
    </div>
  );

  /**
   * Door Detail Component - Individual door work interface
   */
  const DoorDetail = () => {
    if (!selectedDoor) return null;
    
    const isCompleted = selectedDoor.completed;
    const hasPhoto = selectedDoor.has_photo;
    const hasVideo = selectedDoor.has_video;
    const hasSignature = selectedDoor.has_signature;
    
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setCurrentView('overview')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Door #{selectedDoor.door_number}</h1>
            <p className="text-gray-600">{selectedDoor.location}</p>
          </div>
        </div>

        {/* Door Information Card */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="font-semibold mb-2">Door Information</h3>
          <div className="space-y-1 text-sm">
            <p><span className="font-medium">Type:</span> {selectedDoor.door_type}</p>
            <p><span className="font-medium">Dimensions:</span> {selectedDoor.width} × {selectedDoor.height} {selectedDoor.dimension_unit}</p>
            <p><span className="font-medium">Work:</span> {selectedDoor.labor_description}</p>
          </div>
        </div>

        {/* Line Items Checklist */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="font-semibold mb-3">Work Items</h3>
          <div className="space-y-3">
            {selectedDoor.line_items.map(item => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all ${
                  item.completed 
                    ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
                onClick={() => toggleLineItem(selectedDoor.id, item.id)}
              >
                {item.completed ? (
                  <CheckSquare className="w-5 h-5 text-green-600 flex-shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${item.completed ? 'text-green-800' : 'text-gray-800'}`}>
                    {item.description}
                  </p>
                  <p className="text-sm text-gray-600">
                    Part: {item.part_number} • Qty: {item.quantity}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Media Capture Section */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="font-semibold mb-3">Documentation</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setCameraType('photo');
                setShowCamera(true);
              }}
              disabled={uploading}
              className={`p-4 rounded-lg border-2 border-dashed transition-all flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                hasPhoto 
                  ? 'border-green-300 bg-green-50 hover:bg-green-100' 
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <Camera className={`w-6 h-6 ${hasPhoto ? 'text-green-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${hasPhoto ? 'text-green-800' : 'text-gray-600'}`}>
                {hasPhoto ? 'Photo Captured' : 'Capture Photo'}
              </span>
            </button>
            
            <button
              onClick={() => {
                setCameraType('video');
                setShowCamera(true);
              }}
              disabled={uploading}
              className={`p-4 rounded-lg border-2 border-dashed transition-all flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                hasVideo 
                  ? 'border-green-300 bg-green-50 hover:bg-green-100' 
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <Video className={`w-6 h-6 ${hasVideo ? 'text-green-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${hasVideo ? 'text-green-800' : 'text-gray-600'}`}>
                {hasVideo ? 'Video Recorded' : 'Record Video'}
              </span>
            </button>
          </div>
        </div>

        {/* Door Completion Section */}
        {!isCompleted && (
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold mb-3">Complete Door</h3>
            {isDoorReadyForCompletion(selectedDoor) ? (
              <button
                onClick={handleCompleteDoor}
                disabled={uploading}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? <Loader className="w-5 h-5 animate-spin" /> : <PenTool className="w-5 h-5" />}
                {uploading ? 'Completing...' : 'Complete Door (Signature Required)'}
              </button>
            ) : (
              <div className="text-center">
                <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-2">Complete the following to finish this door:</p>
                <ul className="text-sm text-gray-500 space-y-1">
                  {!selectedDoor.line_items.every(item => item.completed) && (
                    <li>✗ Complete all work items</li>
                  )}
                  {!hasPhoto && <li>✗ Capture completion photo</li>}
                  {!hasVideo && <li>✗ Record operation video</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {isCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800 mb-2">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Door Completed</span>
            </div>
            <p className="text-green-700 text-sm">
              This door has been completed and signed off by the customer.
            </p>
          </div>
        )}
      </div>
    );
  };

  /**
   * Job Summary Component - Final summary and documentation
   */
  const JobSummary = () => {
    const totalTime = formatTime(elapsedTime);
    
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setCurrentView('overview')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Job Summary</h1>
        </div>

        {/* Job Overview Card */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="font-semibold mb-3">Job Overview</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Job Number:</span> {jobData.job_number}</p>
            <p><span className="font-medium">Customer:</span> {jobData.customer_name}</p>
            <p><span className="font-medium">Total Time:</span> {totalTime}</p>
            <p><span className="font-medium">Doors Completed:</span> {jobData.completed_doors}/{jobData.total_doors}</p>
          </div>
        </div>

        {/* Completed Doors Summary */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="font-semibold mb-3">Completed Work</h3>
          <div className="space-y-3">
            {jobData.doors.map(door => {
              if (!door.completed) return null;
              
              const completedItems = door.line_items.filter(item => item.completed);
              
              return (
                <div key={door.id} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium">Door #{door.door_number} - {door.location}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{door.labor_description}</p>
                  <div className="text-sm">
                    <p className="font-medium mb-1">Items Completed ({completedItems.length}):</p>
                    <ul className="space-y-1 text-gray-600">
                      {completedItems.map(item => (
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
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
          <h3 className="font-semibold text-green-800 mb-1">Job Complete!</h3>
          <p className="text-green-700 text-sm">
            All work has been completed and documented.
          </p>
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Status Bar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full transition-colors ${
            jobStatus === 'not_started' ? 'bg-gray-400' :
            jobStatus === 'started' ? 'bg-blue-500' :
            'bg-green-500'
          }`} />
          <span className="font-medium">Scott Overhead Doors</span>
          <div className="flex items-center gap-1 ml-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600" />
            )}
            {pendingSync && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {jobStatus === 'started' && (
            <div className="flex items-center gap-2 text-blue-600">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-sm">{formatTime(elapsedTime)}</span>
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={!isOnline || loading}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2 text-center">
          <p className="text-yellow-800 text-sm">
            Working offline. Changes will sync when connection is restored.
          </p>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 max-w-md mx-auto pb-20">
        {currentView === 'overview' && <JobOverview />}
        {currentView === 'door_detail' && <DoorDetail />}
        {currentView === 'summary' && <JobSummary />}
      </div>

      {/* Modals */}
      {showSignaturePad && (
        <SignaturePad
          onSave={handleSignatureSave}
          onCancel={() => setShowSignaturePad(false)}
          title={
            signatureType === 'start' ? 'Start Job Signature' :
            signatureType === 'door_complete' ? 'Door Completion Signature' :
            'Final Job Completion Signature'
          }
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <Loader className="w-6 h-6 animate-spin text-blue-600" />
            <span className="font-medium">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileJobWorker;