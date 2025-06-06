import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Row,
  Col,
  ListGroup,
  Modal,
  Form,
  Alert,
  Spinner,
  Badge,
  Image,
} from "react-bootstrap";
import {
  FaCheckCircle,
  FaCalendarAlt,
  FaArrowLeft,
  FaMapMarkerAlt,
  FaUserAlt,
  FaPhoneAlt,
  FaGlobe,
  FaTools,
  FaBoxOpen,
  FaInfo,
  FaTimesCircle,
  FaExclamationTriangle,
  FaPlay,
  FaImage,
  FaVideo,
  FaRuler,
  FaClipboardList,
  FaExpand,
  FaClock,
  FaTasks,
  FaHistory,
  FaArrowDown, // Add this import for download buttons
} from "react-icons/fa";
import { toast } from "react-toastify";
import { getJob, updateJobStatus, cancelJob } from "../../services/jobService";
import "./JobDetails.css";
import MobileJobWorker from "./MobileJobWorker";

/**
 * Enhanced JobDetails Component with Time Tracking and Actions Review
 *
 * Displays comprehensive job information with door details, time tracking,
 * actions performed, and media review for management oversight.
 */
const JobDetails = () => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [error, setError] = useState(null);
  const [doorMedia, setDoorMedia] = useState({});
  const [loadingMedia, setLoadingMedia] = useState({});
  const [expandedDoors, setExpandedDoors] = useState(new Set());
  const [doorTimeTracking, setDoorTimeTracking] = useState({});
  const [doorActions, setDoorActions] = useState({});

  const [cancellationReason, setCancellationReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [showMobileWorker, setShowMobileWorker] = useState(false);

  const { jobId } = useParams();
  const navigate = useNavigate();

  /**
   * Load job details from API
   */
  const loadJob = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getJob(jobId);

      if (data && data.scheduled_date) {
        console.log("Raw scheduled date from API:", data.scheduled_date);
      }

      setJob(data);

      // Load media and time tracking for each door
      if (data && data.doors) {
        loadDoorMedia(data.doors);
      }
    } catch (err) {
      console.error("Error loading job:", err);
      setError("Failed to load job details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const loadDoorTimeTrackingAndActions = async (doors) => {
    console.log('🔄 Starting loadDoorTimeTrackingAndActions for doors:', doors?.length || 0);
    
    try {
      // Load time tracking data for the job
      console.log('📊 Loading job time tracking data for job:', jobId);
      const timeTrackingUrl = `/api/mobile/jobs/${jobId}/time-tracking`;
      console.log('🌐 Time tracking URL:', timeTrackingUrl);
      
      try {
        const timeResponse = await fetch(timeTrackingUrl);
        console.log('📈 Time tracking response status:', timeResponse.status);
        
        if (timeResponse.ok) {
          const timeData = await timeResponse.json();
          console.log('✅ Time tracking data received:', timeData);
          
          // Fix time calculation - properly handle active sessions
          let totalMinutes = timeData.total_minutes || 0;
          const sessions = timeData.sessions || [];
          
          // Calculate time for active sessions
          sessions.forEach(session => {
            if (session.status === 'active' && session.start_time) {
              const startTime = new Date(session.start_time);
              const currentTime = new Date();
              const activeMinutes = Math.floor((currentTime - startTime) / (1000 * 60));
              totalMinutes += activeMinutes;
              session.current_minutes = activeMinutes;
              console.log(`⏰ Active session ${session.id}: ${activeMinutes} minutes`);
            }
          });
          
          const processedTimeData = {
            jobId: timeData.job_id,
            totalMinutes: totalMinutes,
            totalHours: Math.round((totalMinutes / 60) * 100) / 100,
            sessions: sessions,
            jobTimingStatus: timeData.job_timing_status || 'not_started'
          };
          
          console.log('🔧 Processed time tracking data:', processedTimeData);
          setDoorTimeTracking(processedTimeData);
        } else {
          console.warn('⚠️ Time tracking response not OK:', timeResponse.status, timeResponse.statusText);
          setDoorTimeTracking({
            jobId: parseInt(jobId),
            totalMinutes: 0,
            totalHours: 0,
            sessions: [],
            jobTimingStatus: 'not_started'
          });
        }
      } catch (timeError) {
        console.error('❌ Error fetching time tracking data:', timeError);
        setDoorTimeTracking({
          jobId: parseInt(jobId),
          totalMinutes: 0,
          totalHours: 0,
          sessions: [],
          jobTimingStatus: 'error'
        });
      }

      // Load actions performed for each door
      console.log('🚪 Loading door actions data for', doors?.length || 0, 'doors');
      const doorActionsData = {};
      
      if (!doors || doors.length === 0) {
        console.warn('⚠️ No doors provided for action loading');
        setDoorActions({});
        return;
      }
      
      for (const door of doors) {
        const doorId = door.id;
        console.log(`🔍 Processing door ${doorId} (Door #${door.door_number || 'Unknown'})`);
        
        try {
          const actionsUrl = `/api/doors/${doorId}/actions?job_id=${jobId}`;
          console.log(`🌐 Fetching door actions from: ${actionsUrl}`);
          
          const actionsResponse = await fetch(actionsUrl);
          console.log(`📊 Door ${doorId} actions response status:`, actionsResponse.status);
          
          if (actionsResponse.ok) {
            const actionsData = await actionsResponse.json();
            console.log(`✅ Door ${doorId} actions data received:`, actionsData);
            
            const actions = actionsData.actions || [];
            console.log(`🔧 Processing ${actions.length} actions for door ${doorId}`);
            
            // Properly filter and process line item completions
            const lineItemCompletions = actions.filter(action => 
              action.type === 'line_item_completion' && action.completed === true
            );
            console.log(`📋 Found ${lineItemCompletions.length} completed line items for door ${doorId}:`, lineItemCompletions);
            
            // Extract other action types
            const timeEntries = actions.filter(action => action.type === 'time_tracking');
            const mediaUploads = actions.filter(action => action.type === 'media_upload');
            const signatures = actions.filter(action => 
              action.type === 'signature' || action.type === 'job_signature'
            );
            
            console.log(`⏰ Found ${timeEntries.length} time tracking entries for door ${doorId}`);
            console.log(`📸 Found ${mediaUploads.length} media uploads for door ${doorId}`);
            console.log(`✍️ Found ${signatures.length} signatures for door ${doorId}`);
            
            // Calculate last activity timestamp
            const allTimestamps = actions
              .map(action => action.timestamp)
              .filter(timestamp => timestamp)
              .map(timestamp => new Date(timestamp).getTime())
              .filter(time => !isNaN(time));
            
            const lastActivity = allTimestamps.length > 0 ? Math.max(...allTimestamps) : null;
            console.log(`🕐 Last activity for door ${doorId}:`, lastActivity ? new Date(lastActivity) : 'None');
            
            // Create the door actions data with properly formatted line items
            const processedLineItems = lineItemCompletions.map(action => ({
              id: action.line_item_id || action.id,
              description: action.line_item_description || action.description || 'Completed work item',
              completed_at: action.timestamp,
              completed_by_name: action.completed_by_name || action.user_name,
              completed_by: action.completed_by_id || action.user_id,
              part_number: action.part_number,
              quantity: action.quantity || 1,
              completed: true
            }));
            
            console.log(`🔧 Processed line items for door ${doorId}:`, processedLineItems);
            
            // START FIX: Update completion logic
            // Update door media status based on actual media uploads
            const photos = mediaUploads.filter(action => action.media_type === 'photo');
            const videos = mediaUploads.filter(action => action.media_type === 'video');
            door.has_photo = photos.length > 0;
            door.has_video = videos.length > 0;

            // Update door completion status based on BOTH signature and photo presence
            // A door is considered 'completed' only when it is signed AND has at least one photo.
            if (signatures.length > 0 && door.has_photo) {
              door.completed = true;
            } else {
              door.completed = false;
            }
            // END FIX
            
            doorActionsData[doorId] = {
              lineItemsCompleted: processedLineItems,
              totalActions: actions.length,
              timeSpent: 0, // Will be calculated later
              lastActivity: lastActivity,
              actions: actions,
              summary: {
                lineItemCompletions: lineItemCompletions.length,
                timeEntries: timeEntries.length,
                mediaUploads: mediaUploads.length,
                signatures: signatures.length,
                totalActions: actions.length
              },
              mediaInfo: {
                photos: mediaUploads.filter(action => action.media_type === 'photo').length,
                videos: mediaUploads.filter(action => action.media_type === 'video').length,
                total: mediaUploads.length
              },
              fallback: false
            };
            
            // Update the door object to include the completed line items
            if (processedLineItems.length > 0) {
              door.line_items = door.line_items || [];
              
              // Merge completed items into door line items
              processedLineItems.forEach(completedItem => {
                const existingItem = door.line_items.find(item => item.id === completedItem.id);
                if (existingItem) {
                  Object.assign(existingItem, completedItem);
                } else {
                  door.line_items.push(completedItem);
                }
              });
            }
            
            console.log(`✅ Door ${doorId} processed successfully:`, doorActionsData[doorId]);
            
          } else {
            console.warn(`⚠️ Door ${doorId} actions response not OK:`, actionsResponse.status, actionsResponse.statusText);
            const errorText = await actionsResponse.text();
            console.warn(`⚠️ Door ${doorId} error response text:`, errorText);
            
            // Fallback: use existing door data
            const completedItems = door.line_items ? door.line_items.filter(item => item.completed) : [];
            console.log(`📋 Fallback found ${completedItems.length} completed items in door data`);
            
            doorActionsData[doorId] = {
              lineItemsCompleted: completedItems,
              totalActions: completedItems.length,
              timeSpent: 0,
              lastActivity: null,
              actions: [],
              summary: {
                lineItemCompletions: completedItems.length,
                timeEntries: 0,
                mediaUploads: 0,
                signatures: 0,
                totalActions: completedItems.length
              },
              mediaInfo: {
                photos: 0,
                videos: 0,
                total: 0
              },
              fallback: true,
              error: `API returned ${actionsResponse.status}: ${errorText}`
            };
          }
          
        } catch (doorError) {
          console.error(`❌ Error loading actions for door ${doorId}:`, doorError);
          
          doorActionsData[doorId] = {
            lineItemsCompleted: [],
            totalActions: 0,
            timeSpent: 0,
            lastActivity: null,
            actions: [],
            summary: {
              lineItemCompletions: 0,
              timeEntries: 0,
              mediaUploads: 0,
              signatures: 0,
              totalActions: 0
            },
            mediaInfo: {
              photos: 0,
              videos: 0,
              total: 0
            },
            error: doorError.message,
            fallback: true
          };
        }
      }
      
      // Calculate time spent per door based on total job time and actions
      const totalJobMinutes = doorTimeTracking.totalMinutes || 0;
      if (totalJobMinutes > 0) {
        const totalActions = Object.values(doorActionsData).reduce((sum, door) => sum + door.totalActions, 0);
        if (totalActions > 0) {
          Object.keys(doorActionsData).forEach(doorId => {
            const doorActions = doorActionsData[doorId];
            const doorWeight = doorActions.totalActions / totalActions;
            doorActions.timeSpent = Math.round(totalJobMinutes * doorWeight);
          });
        }
      }
      
      console.log('🏁 Final door actions data:', doorActionsData);
      setDoorActions(doorActionsData);
      
      // Update the job state to reflect the modified doors with line items
      setJob(prevJob => ({
        ...prevJob,
        doors: doors
      }));
      
      // Log summary
      const totalActions = Object.values(doorActionsData).reduce((sum, door) => sum + door.totalActions, 0);
      const totalCompletedItems = Object.values(doorActionsData).reduce((sum, door) => sum + door.lineItemsCompleted.length, 0);
      console.log(`📊 Summary: ${totalActions} total actions, ${totalCompletedItems} completed items across ${Object.keys(doorActionsData).length} doors`);
      
    } catch (error) {
      console.error('❌ Fatal error in loadDoorTimeTrackingAndActions:', error);
      setDoorActions({});
      setDoorTimeTracking({
        jobId: parseInt(jobId),
        totalMinutes: 0,
        totalHours: 0,
        sessions: [],
        jobTimingStatus: 'error'
      });
    }
  };

  /**
   * Load media (photos and videos) for doors
   */
  const loadDoorMedia = async (doors) => {
    const mediaPromises = doors.map(async (door) => {
      setLoadingMedia((prev) => ({ ...prev, [door.id]: true }));

      try {
        const response = await fetch(
          `/api/mobile/doors/${door.id}/media?job_id=${jobId}`
        );
        if (response.ok) {
          const mediaData = await response.json();
          setDoorMedia((prev) => ({
            ...prev,
            [door.id]: mediaData,
          }));
          
          // Update door media status based on loaded media
          if (mediaData.photos && mediaData.photos.length > 0) {
            door.has_photo = true;
          }
          if (mediaData.videos && mediaData.videos.length > 0) {
            door.has_video = true;
          }
        }
      } catch (error) {
        console.error(`Error loading media for door ${door.id}:`, error);
      } finally {
        setLoadingMedia((prev) => ({ ...prev, [door.id]: false }));
      }
    });

    await Promise.all(mediaPromises);

    // Also load time tracking and actions data
    await loadDoorTimeTrackingAndActions(doors);
  };

  /**
   * Toggle door expansion for detailed view
   */
  const toggleDoorExpansion = (doorId) => {
    setExpandedDoors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(doorId)) {
        newSet.delete(doorId);
      } else {
        newSet.add(doorId);
      }
      return newSet;
    });
  };

  /**
   * Load job data on component mount
   */
  useEffect(() => {
    loadJob();
  }, [loadJob]);

  /**
   * Handle job status change
   */
  const handleStatusChange = async (newStatus) => {
    try {
      await updateJobStatus(job.id, { status: newStatus });
      toast.success(`Job status updated to ${newStatus.replace("_", " ")}`);
      loadJob();
    } catch (error) {
      console.error("Error updating job status:", error);
      toast.error("Error updating job status");
    }
  };

  /**
   * Cancel a job by calling the dedicated cancel endpoint
   */
  const handleCancelJob = async () => {
    try {
      setIsCancelling(true);

      const cancelData = {};
      if (cancellationReason.trim()) {
        cancelData.reason = cancellationReason.trim();
      }

      await cancelJob(job.id, cancelData);

      toast.success("Job has been cancelled successfully");

      setCancellationReason("");
      setShowCancelModal(false);
      loadJob();
    } catch (error) {
      console.error("Error cancelling job:", error);
      toast.error(`Error cancelling job: ${error.message || "Unknown error"}`);
    } finally {
      setIsCancelling(false);
    }
  };

  /**
   * Enhanced formatDuration function with better time display
   */
  const formatDuration = (minutes) => {
    if (!minutes || minutes <= 0) return "No time recorded";

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  /**
   * Calculate estimated time spent on a door based on actions and job time
   */
  const estimateDoorTime = (door) => {
    const doorActionData = doorActions[door.id];
    if (!doorActionData) return 0;

    // Use the calculated time spent from actions data
    return doorActionData.timeSpent || 0;
  };


  /**
   * Download media file (photo or video)
   * @param {number} mediaId - The ID of the media to download
   * @param {string} mediaType - Type of media ('photo' or 'video')
   * @param {string} fileName - Suggested filename for download
   */
  const downloadMedia = async (mediaId, mediaType, fileName) => {
    try {
      // Show loading toast
      const loadingToast = toast.loading(`Downloading ${mediaType}...`);
      
      // Fetch the media file
      const response = await fetch(`/api/mobile/media/${mediaId}/${mediaType}`);
      
      if (!response.ok) {
        throw new Error(`Failed to download ${mediaType}`);
      }
      
      // Get the blob data
      const blob = await response.blob();
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      
      // Append to body, click, and remove
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up the URL
      window.URL.revokeObjectURL(url);
      
      // Update toast to success
      toast.update(loadingToast, {
        render: `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} downloaded successfully!`,
        type: 'success',
        isLoading: false,
        autoClose: 3000
      });
      
    } catch (error) {
      console.error(`Error downloading ${mediaType}:`, error);
      toast.error(`Failed to download ${mediaType}. Please try again.`);
    }
  };

  /**
   * Render door media gallery with download functionality
   */
  const renderDoorMedia = (door) => {
    const media = doorMedia[door.id];
    const isLoading = loadingMedia[door.id];

    if (isLoading) {
      return (
        <div className="door-media-loading">
          <Spinner animation="border" size="sm" />
          <span className="ms-2">Loading media...</span>
        </div>
      );
    }

    if (!media || (media.photos.length === 0 && media.videos.length === 0)) {
      return (
        <div className="door-media-empty">
          <FaImage className="me-2" />
          <span>No photos or videos uploaded yet</span>
        </div>
      );
    }

    return (
      <div className="door-media-gallery">
        {/* Photos */}
        {media.photos.length > 0 && (
          <div className="media-section">
            <h6 className="media-section-title">
              <FaImage className="me-2" />
              Photos ({media.photos.length})
            </h6>
            <div className="media-grid">
              {media.photos.map((photo, index) => {
                // Generate filename for download
                const photoFileName = `door_${door.door_number || door.id}_photo_${index + 1}_${new Date(photo.uploaded_at).toISOString().split('T')[0]}.jpg`;
                
                return (
                  <div key={photo.id} className="media-item">
                    <div className="media-container">
                      <Image
                        src={`/api/mobile/media/${photo.id}/photo`}
                        thumbnail
                        className="door-photo"
                        alt={`Door ${door.door_number} photo ${index + 1}`}
                      />
                      <div className="media-overlay">
                        <Button
                          size="sm"
                          className="download-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadMedia(photo.id, 'photo', photoFileName);
                          }}
                          title="Download photo"
                        >
                          <FaArrowDown />
                        </Button>
                      </div>
                    </div>
                    <div className="media-info">
                      <small className="text-muted">
                        {new Date(photo.uploaded_at).toLocaleDateString()}
                      </small>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="download-btn-alt"
                        onClick={() => downloadMedia(photo.id, 'photo', photoFileName)}
                      >
                        <FaArrowDown className="me-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Videos */}
        {media.videos.length > 0 && (
          <div className="media-section">
            <h6 className="media-section-title">
              <FaVideo className="me-2" />
              Videos ({media.videos.length})
            </h6>
            <div className="media-grid">
              {media.videos.map((video, index) => {
                // Generate filename for download
                const videoFileName = `door_${door.door_number || door.id}_video_${index + 1}_${new Date(video.uploaded_at).toISOString().split('T')[0]}.mp4`;
                
                return (
                  <div key={video.id} className="media-item">
                    <div className="media-container">
                      <video controls className="door-video" preload="metadata">
                        <source src={`/api/mobile/media/${video.id}/video`} />
                        Your browser does not support the video tag.
                      </video>
                      <div className="media-overlay">
                        <Button
                          size="sm"
                          className="download-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadMedia(video.id, 'video', videoFileName);
                          }}
                          title="Download video"
                        >
                          <FaArrowDown />
                        </Button>
                      </div>
                    </div>
                    <div className="media-info">
                      <small className="text-muted">
                        {new Date(video.uploaded_at).toLocaleDateString()}
                      </small>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="download-btn-alt"
                        onClick={() => downloadMedia(video.id, 'video', videoFileName)}
                      >
                        <FaArrowDown className="me-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDoorTimeAndActions = (door) => {
    console.log(`🎨 Rendering time and actions for door ${door.id}:`, door);
    
    const doorActionData = doorActions[door.id];
    console.log(`📊 Door ${door.id} action data:`, doorActionData);
    
    // Use safe action data with proper defaults
    const safeActionData = doorActionData || {
      lineItemsCompleted: [],
      totalActions: 0,
      timeSpent: 0,
      lastActivity: null,
      summary: {
        lineItemCompletions: 0,
        timeEntries: 0,
        mediaUploads: 0,
        signatures: 0,
        totalActions: 0
      },
      fallback: true,
      error: 'No action data available'
    };
    
    console.log(`🔧 Safe action data for door ${door.id}:`, safeActionData);

    // Get estimated time for this door
    const estimatedTime = safeActionData.timeSpent || 0;
    console.log(`⏰ Estimated time for door ${door.id}:`, estimatedTime, 'minutes');
    
    // Get completed items - prioritize action data over door data
    let completedItems = [];
    let totalItems = 0;
    
    if (safeActionData.lineItemsCompleted && safeActionData.lineItemsCompleted.length > 0) {
      // Use line items from actions data (more accurate)
      completedItems = safeActionData.lineItemsCompleted;
      totalItems = completedItems.length; // In this case, we only know about completed items
    } else if (door.line_items && door.line_items.length > 0) {
      // Fallback to door line items
      completedItems = door.line_items.filter(item => item.completed);
      totalItems = door.line_items.length;
    }
    
    console.log(`📋 Door ${door.id} items: ${completedItems.length} completed of ${totalItems} total`);

    // START FIX: Determine signature status independently of door.completed
    const hasSignature = (safeActionData?.summary?.signatures || 0) > 0;
    // END FIX

    return (
      <div className="door-time-actions">
        <h6 className="time-actions-title">
          <FaClock className="me-2" />
          Time & Actions
          <Badge bg="info" className="ms-2" style={{ fontSize: '0.7em' }}>
            {safeActionData.totalActions} actions
          </Badge>
          {safeActionData.fallback && (
            <Badge bg="warning" className="ms-1" style={{ fontSize: '0.7em' }}>
              Fallback
            </Badge>
          )}
        </h6>
        
        {/* Time Tracking Section */}
        <div className="time-tracking-section">
          {estimatedTime > 0 && (
            <div className="time-stat">
              <span className="time-label">Estimated Time Spent:</span>
              <span className="time-value">{formatDuration(estimatedTime)}</span>
            </div>
          )}
          
          {doorTimeTracking.sessions && doorTimeTracking.sessions.length > 0 && (
            <div className="time-stat">
              <span className="time-label">Sessions:</span>
              <span className="time-value">{doorTimeTracking.sessions.length}</span>
            </div>
          )}
          
          {safeActionData.lastActivity && (
            <div className="time-stat">
              <span className="time-label">Last Activity:</span>
              <span className="time-value">
                {new Date(safeActionData.lastActivity).toLocaleString()}
              </span>
            </div>
          )}
        </div>


        {/* Progress Summary */}
        <div className="progress-summary">
          <div className="progress-header">
            <span>Progress Summary</span>
            <span className="progress-percentage">
              {totalItems > 0 ? Math.round((completedItems.length / totalItems) * 100) : 
              completedItems.length > 0 ? 100 : 0}%
            </span>
          </div>
          <div className="progress-details">
            <div className="progress-item">
              <span>Work Items:</span>
              <span>{completedItems.length}{totalItems > completedItems.length ? `/${totalItems}` : ''}</span>
            </div>
            <div className="progress-item">
              <span>Photo:</span>
              <span className={door.has_photo ? 'status-complete' : 'status-pending'}>
                {door.has_photo ? 'Captured' : 'Pending'}
              </span>
            </div>
            <div className="progress-item">
              <span>Video:</span>
              <span className={door.has_video ? 'status-complete' : 'status-pending'}>
                {door.has_video ? 'Recorded' : 'Pending'}
              </span>
            </div>
            {/* START FIX: Use independent signature status */}
            <div className="progress-item">
              <span>Signature:</span>
              <span className={hasSignature ? 'status-complete' : 'status-pending'}>
                {hasSignature ? 'Signed Off' : 'Pending'}
              </span>
            </div>
            {/* END FIX */}
            <div className="progress-item">
              <span>Total Actions:</span>
              <span>{safeActionData.totalActions}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const parseDatePreservingDay = (dateStr) => {
    if (!dateStr) return null;
    console.log("Parsing date:", dateStr);
    try {
      if (dateStr.includes("T")) {
        dateStr = dateStr.split("T")[0];
      }
      if (dateStr.includes(",")) {
        const tempDate = new Date(dateStr);
        const year = tempDate.getUTCFullYear();
        const month = tempDate.getUTCMonth();
        const day = tempDate.getUTCDate();
        return new Date(year, month, day, 12, 0, 0);
      }
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateStr.split("-").map(Number);
        return new Date(year, month - 1, day, 12, 0, 0);
      }
      const date = new Date(dateStr);
      date.setHours(12, 0, 0, 0);
      return date;
    } catch (e) {
      console.error("Error parsing date:", e, dateStr);
      return null;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Not Scheduled";
    const parsedDate = parseDatePreservingDay(dateString);
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      console.warn("Invalid date:", dateString);
      return "Invalid Date";
    }
    const options = { year: "numeric", month: "short", day: "numeric" };
    return parsedDate.toLocaleDateString(undefined, options);
  };
  
  const renderDoorLineItems = (door) => {
    console.log(`🎨 Rendering line items for door ${door.id}:`, door);
    
    const doorActionData = doorActions[door.id];
    let lineItems = [];
    
    // Prioritize line items from actions data (more accurate)
    if (doorActionData && doorActionData.lineItemsCompleted && doorActionData.lineItemsCompleted.length > 0) {
      lineItems = doorActionData.lineItemsCompleted;
      console.log(`📋 Using line items from actions data for door ${door.id}:`, lineItems);
    } else if (door.line_items && door.line_items.length > 0) {
      lineItems = door.line_items;
      console.log(`📋 Using line items from door data for door ${door.id}:`, lineItems);
    }
    
    if (!lineItems || lineItems.length === 0) {
      return (
        <div className="door-line-items-empty">
          <FaClipboardList className="me-2" />
          <span>No work items completed</span>
          {doorActionData && doorActionData.totalActions > 0 && (
            <div className="text-muted" style={{ fontSize: '0.9em', marginTop: '5px' }}>
              {doorActionData.totalActions} other actions recorded
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="door-line-items">
        <h6 className="line-items-title">
          <FaClipboardList className="me-2" />
          Work Items ({lineItems.length})
        </h6>
        <ListGroup variant="flush" className="line-items-list">
          {lineItems.map((item, index) => (
            <ListGroup.Item key={item.id || index} className="line-item">
              <div className="line-item-content">
                <div className="line-item-header">
                  <span className="line-item-description">
                    {item.description || `Work item ${index + 1}`}
                  </span>
                  {item.completed && (
                    <Badge bg="success" className="ms-2">
                      <FaCheckCircle className="me-1" />
                      Completed
                    </Badge>
                  )}
                </div>
                {item.part_number && (
                  <div className="line-item-detail">
                    <small className="text-muted">Part: {item.part_number}</small>
                  </div>
                )}
                <div className="line-item-details">
                  <small className="text-muted">
                    Qty: {item.quantity || 1}
                    {item.price && ` | Price: $${(item.price || 0).toFixed(2)}`}
                    {item.labor_hours && ` | Labor: ${item.labor_hours}h`}
                  </small>
                </div>
                {item.completed_at && (
                  <div className="line-item-completion">
                    <small className="text-success">
                      <FaClock className="me-1" />
                      Completed: {new Date(item.completed_at).toLocaleString()}
                      {item.completed_by_name && ` by ${item.completed_by_name}`}
                    </small>
                  </div>
                )}
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </div>
    );
  };

  /**
   * Render door specifications
   */
  const renderDoorSpecs = (door) => {
    const specs = [];

    if (door.location) {
      specs.push({
        label: "Location",
        value: door.location,
        icon: FaMapMarkerAlt,
      });
    }

    if (door.door_type) {
      specs.push({ label: "Type", value: door.door_type, icon: FaTools });
    }

    if (door.width && door.height) {
      const dimensions = `${door.width} × ${door.height} ${
        door.dimension_unit || "ft"
      }`;
      specs.push({ label: "Dimensions", value: dimensions, icon: FaRuler });
    }

    if (door.labor_description) {
      specs.push({
        label: "Work Description",
        value: door.labor_description,
        icon: FaClipboardList,
      });
    }

    if (specs.length === 0) {
      return null; // Don't render anything if no specs
    }

    return (
      <div className="door-specifications">
        <h6 className="specs-title">
          <FaInfo className="me-2" />
          Specifications
        </h6>
        <div className="specs-grid">
          {specs.map((spec, index) => (
            <div key={index} className="spec-item">
              <div className="spec-label">
                <spec.icon className="me-2" />
                {spec.label}:
              </div>
              <div className="spec-value">{spec.value}</div>
            </div>
          ))}
        </div>
        {door.notes && (
          <div className="door-notes">
            <strong>Notes:</strong> {door.notes}
          </div>
        )}
      </div>
    );
  };

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner animation="border" variant="primary" />
        <p>Loading job details...</p>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <Alert variant="danger" className="error-alert">
        <Alert.Heading>Error Loading Job</Alert.Heading>
        <p>{error}</p>
        <div className="d-flex justify-content-between">
          <Button variant="outline-danger" onClick={() => navigate("/jobs")}>
            Back to Jobs
          </Button>
          <Button variant="primary" onClick={loadJob}>
            Try Again
          </Button>
        </div>
      </Alert>
    );
  }

  /**
   * Render not found state
   */
  if (!job) {
    return (
      <Alert variant="warning" className="not-found-alert">
        <Alert.Heading>Job Not Found</Alert.Heading>
        <p>The requested job could not be found.</p>
        <Button variant="primary" onClick={() => navigate("/jobs")}>
          Back to Jobs
        </Button>
      </Alert>
    );
  }

  // If showMobileWorker is true, render MobileJobWorker instead of JobDetails UI
  if (showMobileWorker) {
    return <MobileJobWorker jobId={job.id.toString()} />;
  }

  const displayDate = job.formatted_date || formatDate(job.scheduled_date);
  const isJobCancelled = job.status === "cancelled";
  const canStartJobMobile =
    job && !isJobCancelled && job.status !== "completed";

  return (
    <div className="job-details-container">
      <div className="job-details-header">
        <div className="job-title">
          <h2>Job #{job.job_number}</h2>
          <div className="d-flex align-items-center mb-2">
            <span className="status-label me-3">Status:</span>
            <span
              className={`status-text ${isJobCancelled ? "text-danger" : ""}`}
            >
              {job.status
                ? job.status.charAt(0).toUpperCase() +
                  job.status.slice(1).replace(/_/g, " ")
                : "No Status"}
            </span>
          </div>
        </div>
        <div className="job-actions">
          {canStartJobMobile && (
            <Button
              variant="success"
              className="action-button"
              onClick={() => setShowMobileWorker(true)}
            >
              <FaPlay className="me-2" /> Start Job (Mobile)
            </Button>
          )}
          {!isJobCancelled && (
            <>
              <Button
                variant="outline-primary"
                className="action-button"
                onClick={() => navigate(`/schedule/job/${job.id}`)}
              >
                <FaCalendarAlt className="me-2" /> Schedule
              </Button>
              <Button
                variant="outline-danger"
                className="action-button"
                onClick={() => setShowCancelModal(true)}
              >
                <FaTimesCircle className="me-2" /> Cancel Job
              </Button>
            </>
          )}
          <Button
            variant="outline-secondary"
            className="action-button"
            onClick={() => {
              if (showMobileWorker) setShowMobileWorker(false);
              else navigate("/jobs");
            }}
          >
            <FaArrowLeft className="me-2" /> Back to Jobs
          </Button>
        </div>
      </div>

      {isJobCancelled && (
        <Alert variant="danger" className="mb-4">
          <Alert.Heading>
            <FaExclamationTriangle className="me-2" /> This job has been
            cancelled
          </Alert.Heading>
          <p>
            This job is marked as cancelled and is no longer active. You can
            view the details, but no further actions can be taken.
          </p>
        </Alert>
      )}

      {/* Job Time Summary */}
      {doorTimeTracking.totalMinutes > 0 && (
        <Card className="time-summary-card mb-4">
          <Card.Header>
            <h5 className="mb-0">
              <FaClock className="me-2" /> Job Time Summary
            </h5>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={3}>
                <div className="time-stat-large">
                  <div className="time-stat-value">
                    {formatDuration(doorTimeTracking.totalMinutes)}
                  </div>
                  <div className="time-stat-label">Total Time</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="time-stat-large">
                  <div className="time-stat-value">
                    {doorTimeTracking.totalHours.toFixed(1)}h
                  </div>
                  <div className="time-stat-label">Billable Hours</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="time-stat-large">
                  <div className="time-stat-value">
                    {doorTimeTracking.sessions.length}
                  </div>
                  <div className="time-stat-label">Work Sessions</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="time-stat-large">
                  <div className="time-stat-value">
                    <span
                      className={`status-badge ${doorTimeTracking.jobTimingStatus}`}
                    >
                      {doorTimeTracking.jobTimingStatus
                        .replace("_", " ")
                        .toUpperCase()}
                    </span>
                  </div>
                  <div className="time-stat-label">Status</div>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      <Row className="job-info-row">
        <Col lg={6} className="mb-3 mb-lg-0">
          <Card className="info-card">
            <Card.Header>
              <h5 className="mb-0">
                <FaInfo className="me-2" /> Job Information
              </h5>
            </Card.Header>
            <Card.Body>
              <div className="info-row">
                <div className="info-item">
                  <span className="info-label">
                    <FaUserAlt className="me-2" /> Customer
                  </span>
                  <span className="info-value">{job.customer_name}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <FaMapMarkerAlt className="me-2" /> Address
                  </span>
                  <span className="info-value">{job.address || "N/A"}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <FaUserAlt className="me-2" /> Contact
                  </span>
                  <span className="info-value">
                    {job.contact_name || "N/A"}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <FaPhoneAlt className="me-2" /> Phone
                  </span>
                  <span className="info-value">{job.phone || "N/A"}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <FaGlobe className="me-2" /> Region
                  </span>
                  <span className="info-value">{job.region}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <FaTools className="me-2" /> Additional Notes
                  </span>
                  <span className="info-value">{job.job_scope || "N/A"}</span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="info-card">
            <Card.Header>
              <h5 className="mb-0">
                <FaInfo className="me-2" /> Status Information
              </h5>
            </Card.Header>
            <Card.Body>
              <div className="info-row">
                <div className="info-item">
                  <span className="info-label">Scheduled Date</span>
                  <span className="info-value">
                    <FaCalendarAlt className="me-2" />
                    {displayDate}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status</span>
                  <span
                    className={`status-text ${
                      isJobCancelled ? "text-danger" : ""
                    }`}
                  >
                    {job.status
                      ? job.status.charAt(0).toUpperCase() +
                        job.status.slice(1).replace(/_/g, " ")
                      : "No Status"}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Material Ready</span>
                  <span className="status-text">
                    {job.material_ready ? "Yes" : "No"}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Material Location</span>
                  <span className="info-value">
                    <FaBoxOpen className="me-2" />
                    {job.material_location === "S"
                      ? "Shop"
                      : job.material_location === "C"
                      ? "Client"
                      : job.material_location || "N/A"}
                  </span>
                </div>
              </div>

              {!isJobCancelled && (
                <div className="status-actions">
                  <div className="status-label">Update Status:</div>
                  <div className="status-buttons">
                    <Button
                      variant={
                        job.status === "unscheduled"
                          ? "secondary"
                          : "outline-secondary"
                      }
                      size="sm"
                      onClick={() => handleStatusChange("unscheduled")}
                      className="status-btn"
                    >
                      Unscheduled
                    </Button>
                    <Button
                      variant={
                        job.status === "scheduled"
                          ? "primary"
                          : "outline-primary"
                      }
                      size="sm"
                      onClick={() => handleStatusChange("scheduled")}
                      className="status-btn"
                    >
                      Scheduled
                    </Button>
                    <Button
                      variant={
                        job.status === "waiting_for_parts"
                          ? "warning"
                          : "outline-warning"
                      }
                      size="sm"
                      onClick={() => handleStatusChange("waiting_for_parts")}
                      className="status-btn"
                    >
                      Waiting
                    </Button>
                    <Button
                      variant={
                        job.status === "on_hold" ? "danger" : "outline-danger"
                      }
                      size="sm"
                      onClick={() => handleStatusChange("on_hold")}
                      className="status-btn"
                    >
                      On Hold
                    </Button>
                    <Button
                      variant={
                        job.status === "completed"
                          ? "success"
                          : "outline-success"
                      }
                      size="sm"
                      onClick={() => handleStatusChange("completed")}
                      className="status-btn"
                    >
                      Completed
                    </Button>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Enhanced Doors Section with Time Tracking and Actions */}
      <Card className="doors-card mt-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <FaTools className="me-2" /> Door Details, Time Tracking & Actions
          </h5>
          <Badge bg="info">
            {job.doors ? job.doors.length : 0}{" "}
            {job.doors && job.doors.length === 1 ? "Door" : "Doors"}
          </Badge>
        </Card.Header>
        <Card.Body>
          {job.doors && job.doors.length === 0 ? (
            <Alert variant="info">No doors associated with this job.</Alert>
          ) : (
            <div className="doors-detailed-list">
              {job.doors &&
                job.doors.map((door, index) => {
                  const isExpanded = expandedDoors.has(door.id);
                  const doorNumber = door.door_number || index + 1;
                  const hasSpecs = renderDoorSpecs(door) !== null;
                  const estimatedMinutes = estimateDoorTime(door);

                  return (
                    <Card
                      key={door.id}
                      className={`door-card ${isExpanded ? "expanded" : ""}`}
                    >
                      <Card.Header
                        className="door-card-header"
                        onClick={() => toggleDoorExpansion(door.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="door-header-content">
                          <div className="door-header-left">
                            <h6 className="door-title mb-0">
                              <FaTools className="me-2" />
                              Door #{doorNumber}
                              {door.location && (
                                <span className="door-location">
                                  {" "}
                                  - {door.location}
                                </span>
                              )}
                            </h6>
                            <div className="door-summary">
                              {door.door_type && (
                                <Badge bg="secondary" className="me-2">
                                  {door.door_type}
                                </Badge>
                              )}
                              {door.width && door.height && (
                                <Badge bg="info" className="me-2">
                                  {door.width} × {door.height}{" "}
                                  {door.dimension_unit || "ft"}
                                </Badge>
                              )}
                              {estimatedMinutes > 0 && (
                                <Badge bg="warning" className="me-2">
                                  <FaClock className="me-1" />
                                  {formatDuration(estimatedMinutes)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="door-header-right">
                            {door.completed ? (
                              <Badge bg="success">
                                <FaCheckCircle className="me-1" />
                                Completed
                              </Badge>
                            ) : (
                              <Badge bg="warning">In Progress</Badge>
                            )}
                            <FaExpand className="ms-3 expand-icon" />
                          </div>
                        </div>
                      </Card.Header>

                      {isExpanded && (
                        <Card.Body className="door-card-body">
                          <Row>
                            {/* Conditionally render Specifications Column */}
                            {hasSpecs && (
                              <Col lg={3} className="mb-3">
                                {renderDoorSpecs(door)}
                              </Col>
                            )}

                            {/* Time & Actions Column - larger if no specs */}
                            <Col lg={hasSpecs ? 3 : 4} className="mb-3">
                              {renderDoorTimeAndActions(door)}
                            </Col>

                            {/* Line Items Column - larger if no specs */}
                            <Col lg={hasSpecs ? 3 : 4} className="mb-3">
                              {renderDoorLineItems(door)}
                            </Col>

                            {/* Media Column - larger if no specs */}
                            <Col lg={hasSpecs ? 3 : 4} className="mb-3">
                              <div className="door-media-section">
                                <h6 className="media-title">
                                  <FaImage className="me-2" />
                                  Photos & Videos
                                </h6>
                                {renderDoorMedia(door)}
                              </div>
                            </Col>
                          </Row>

                          {/* Status Summary */}
                          <div className="door-status-summary">
                            {door.completed ? (
                              <div className="status-completed">
                                <FaCheckCircle className="me-2 text-success" />
                                <strong>Door Completed & Signed Off</strong>
                                <small className="text-muted ms-2">
                                  {door.completed_at
                                    ? new Date(
                                        door.completed_at
                                      ).toLocaleDateString()
                                    : "Completion date not available"}
                                </small>
                              </div>
                            ) : (
                              <div className="status-pending">
                                <FaExclamationTriangle className="me-2 text-warning" />
                                <strong>Door In Progress</strong>
                                <small className="text-muted ms-2">
                                  Complete work items and capture media/signature to finish
                                </small>
                              </div>
                            )}
                          </div>
                        </Card.Body>
                      )}
                    </Card>
                  );
                })}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Cancel Job Confirmation Modal */}
      <Modal
        show={showCancelModal}
        onHide={() => setShowCancelModal(false)}
        centered
        className="cancel-job-modal"
      >
        <Modal.Header closeButton className="bg-danger text-white">
          <Modal.Title>
            <FaExclamationTriangle className="me-2" />
            Confirm Job Cancellation
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center mb-4">
            <FaExclamationTriangle
              className="text-danger"
              style={{ fontSize: "3rem" }}
            />
          </div>

          <p className="fw-bold text-center">
            Are you sure you want to cancel Job #{job.job_number}?
          </p>

          <Alert variant="warning">
            <p className="mb-0">
              <strong>Warning:</strong> This action will mark the job as
              cancelled. Cancelled jobs cannot be scheduled or worked on. This
              action cannot be easily undone.
            </p>
          </Alert>

          <p>
            Customer: <strong>{job.customer_name}</strong>
            <br />
            Address: <strong>{job.address || "N/A"}</strong>
            <br />
            Scheduled Date: <strong>{displayDate}</strong>
          </p>

          <Form.Group className="mb-3">
            <Form.Label>Reason for cancellation (optional):</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Enter reason for cancellation..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
            />
            <Form.Text className="text-muted">
              This will be recorded in the job history for reference.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowCancelModal(false)}
            disabled={isCancelling}
          >
            No, Keep Job Active
          </Button>
          <Button
            variant="danger"
            onClick={handleCancelJob}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Cancelling...
              </>
            ) : (
              <>Yes, Cancel Job</>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default JobDetails;