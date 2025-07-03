import React, { useState, useEffect } from "react";
import {
  Play,
  CheckCircle,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  Truck,
  ArrowLeft,
  RefreshCw,
  Loader,
  AlertTriangle,
  Calendar,
  Package,
  Wrench,
  ChevronRight,
  Wifi,
  WifiOff,
} from "lucide-react";
import "./FieldTechInterface.css"; // CSS file for field tech specific styles

// Import MobileJobWorker with proper error handling
let MobileJobWorker;
try {
  // Try to import the MobileJobWorker component
  const MobileWorkerModule = require("../components/jobs/MobileJobWorker");
  MobileJobWorker = MobileWorkerModule.default || MobileWorkerModule.MobileJobWorker || MobileWorkerModule;
} catch (error) {
  console.warn("MobileJobWorker component not found, using placeholder:", error);
  // Fallback placeholder component if import fails
  MobileJobWorker = ({ jobId }) => (
    <div className="mobile-worker-placeholder">
      <AlertTriangle className="icon-lg text-yellow-500" />
      <h3>Mobile Worker Component Unavailable</h3>
      <p>Job ID: {jobId}</p>
      <p>The mobile worker service component could not be loaded.</p>
    </div>
  );
}

// Enhanced API service for field tech operations with better error handling
const createFieldTechService = () => {
  // Dynamic API base URL detection (same as mobile worker service)
  const getApiBaseUrl = () => {
    const currentUrl = window.location.href;
    const currentHost = window.location.host;
    const currentProtocol = window.location.protocol;

    if (currentHost.includes("ngrok.io") || currentHost.includes("ngrok.app")) {
      return `${currentProtocol}//${currentHost}/api`;
    }

    if (currentHost.includes("localhost") || currentHost.includes("127.0.0.1")) {
      return "http://localhost:5000/api";
    }

    return "/api";
  };

  const API_BASE_URL = getApiBaseUrl();

  // Enhanced API request function with comprehensive error handling
  const apiRequest = async (url, options = {}) => {
    const fullUrl = `${API_BASE_URL}${url}`;

    const defaultOptions = {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    };

    const requestOptions = { ...defaultOptions, ...options };

    console.log("Field Tech API request:", {
      url: fullUrl,
      method: requestOptions.method || "GET",
    });

    try {
      const response = await fetch(fullUrl, requestOptions);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = {
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: "Unable to parse error response",
          };
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Field Tech API request successful:", { url: fullUrl });
      return data;
    } catch (fetchError) {
      console.error("Field Tech API request failed:", fetchError);
      throw fetchError;
    }
  };

  return {
    // Get field worker jobs for today or specified date
    getFieldJobs: async (date = null) => {
      try {
        const url = date ? `/mobile/field-jobs?date=${date}` : '/mobile/field-jobs';
        const response = await apiRequest(url);
        
        if (!response || !Array.isArray(response.jobs)) {
          throw new Error("Invalid job data received from server");
        }
        
        return response;
      } catch (error) {
        console.error("Error loading field jobs:", error);
        throw new Error(`Failed to load job assignments: ${error.message}`);
      }
    },

    // Get detailed information for a specific job
    getFieldJobDetail: async (jobId) => {
      try {
        if (!jobId || isNaN(jobId) || jobId <= 0) {
          throw new Error("Invalid job ID provided");
        }

        const jobDetail = await apiRequest(`/mobile/field-jobs/${jobId}`);
        
        if (!jobDetail || typeof jobDetail !== "object") {
          throw new Error("Invalid job detail data received from server");
        }

        return jobDetail;
      } catch (error) {
        console.error("Error loading job detail:", error);
        throw new Error(`Failed to load job details: ${error.message}`);
      }
    },

    // Get field worker summary dashboard data
    getFieldSummary: async () => {
      try {
        const summary = await apiRequest('/mobile/field-summary');
        return summary;
      } catch (error) {
        console.error("Error loading field summary:", error);
        throw new Error(`Failed to load summary: ${error.message}`);
      }
    },

    // Test connectivity
    testConnection: async () => {
      try {
        const response = await apiRequest("/mobile/test");
        return { success: true, data: response };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
  };
};

const fieldTechService = createFieldTechService();

/**
 * Main Field Tech Interface Component
 * Handles navigation between job list, job detail, and mobile worker
 */
const FieldTechInterface = ({ user }) => {
  const [currentView, setCurrentView] = useState("job_list"); // 'job_list', 'job_detail', 'mobile_worker'
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Update online status
  useEffect(() => {
    const handleOnlineStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnlineStatusChange);
    window.addEventListener("offline", handleOnlineStatusChange);
    return () => {
      window.removeEventListener("online", handleOnlineStatusChange);
      window.removeEventListener("offline", handleOnlineStatusChange);
    };
  }, []);

  // Navigation handlers
  const handleJobSelect = (jobId) => {
    setSelectedJobId(jobId);
    setCurrentView("job_detail");
  };

  const handleStartMobileWorker = (jobId) => {
    setSelectedJobId(jobId);
    setCurrentView("mobile_worker");
  };

  const handleBackToJobList = () => {
    setSelectedJobId(null);
    setCurrentView("job_list");
  };

  const handleBackToJobDetail = () => {
    setCurrentView("job_detail");
  };

  // Ensure MobileJobWorker is a valid React component
  const ValidMobileJobWorker = React.isValidElement(MobileJobWorker) ? MobileJobWorker : 
    (typeof MobileJobWorker === 'function' ? MobileJobWorker : 
    ({ jobId }) => (
      <div className="mobile-worker-placeholder">
        <AlertTriangle className="icon-lg text-yellow-500" />
        <h3>Mobile Worker Component Unavailable</h3>
        <p>Job ID: {jobId}</p>
        <p>The mobile worker service component could not be loaded.</p>
      </div>
    ));

  return (
    <div className="field-tech-interface">
      {/* Header Bar */}
      <div className="field-tech-header">
        <div className="field-tech-header-left">
          <h1 className="field-tech-title">Scott Overhead Doors</h1>
          <span className="field-tech-subtitle">Field Tech Portal</span>
        </div>
        <div className="field-tech-header-right">
          <div className="field-tech-user-info">
            <span className="field-tech-username">{user?.full_name || user?.username}</span>
          </div>
          <div className="field-tech-network-status">
            {isOnline ? (
              <Wifi className="icon-sm text-green-600" />
            ) : (
              <WifiOff className="icon-sm text-red-600" />
            )}
          </div>
        </div>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="field-tech-offline-banner">
          <AlertTriangle className="icon-sm" />
          <span>You are offline. Limited functionality available.</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="field-tech-main-content">
        {currentView === "job_list" && (
          <FieldJobList onJobSelect={handleJobSelect} />
        )}
        {currentView === "job_detail" && (
          <FieldJobDetail
            jobId={selectedJobId}
            onBack={handleBackToJobList}
            onStartMobileWorker={handleStartMobileWorker}
          />
        )}
        {currentView === "mobile_worker" && (
          <div className="mobile-worker-container">
            <div className="mobile-worker-header">
              <button
                onClick={handleBackToJobDetail}
                className="mobile-worker-back-button"
              >
                <ArrowLeft className="icon-md" />
                Back to Job Details
              </button>
            </div>
            <ValidMobileJobWorker jobId={selectedJobId} />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Field Job List Component
 * Shows jobs assigned to the current user's truck for today
 */
const FieldJobList = ({ onJobSelect }) => {
  const [jobs, setJobs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load jobs data
  const loadJobs = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);
      
      setError(null);

      const response = await fieldTechService.getFieldJobs();
      setJobs(response.jobs || []);
      setSummary(response.summary || {});
      
      console.log(`Loaded ${response.jobs?.length || 0} field jobs for truck ${response.summary?.truck_assignment || 'unknown'}`);
    } catch (err) {
      console.error("Error loading field jobs:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadJobs();
  }, []);

  // Refresh handler
  const handleRefresh = () => {
    loadJobs(true);
  };

  // Format status display
  const getStatusDisplay = (status) => {
    const statusMap = {
      scheduled: "Scheduled",
      in_progress: "In Progress", 
      waiting_for_parts: "Waiting for Parts",
      completed: "Completed"
    };
    return statusMap[status] || status;
  };

  // Get status color class
  const getStatusColorClass = (mobileStatus) => {
    switch (mobileStatus) {
      case "completed": return "status-completed";
      case "started": return "status-in-progress";
      case "not_started": return "status-scheduled";
      default: return "status-default";
    }
  };

  if (loading) {
    return (
      <div className="field-tech-loading">
        <Loader className="icon-lg animate-spin text-blue-600" />
        <p>Loading your job assignments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="field-tech-error">
        <AlertTriangle className="icon-lg text-red-500" />
        <h3>Error Loading Jobs</h3>
        <p>{error}</p>
        <button onClick={handleRefresh} className="field-tech-button field-tech-button-primary">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="field-job-list">
      {/* Header with Refresh and Truck Info */}
      <div className="field-job-list-header">
        <div className="field-job-list-title">
          <h3>Job Assignments</h3>
          {summary?.truck_assignment && (
            <span className="field-job-truck-badge">
              <Truck className="icon-sm" />
              Truck {summary.truck_assignment}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="field-tech-refresh-button"
        >
          <RefreshCw className={`icon-sm ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <div className="field-job-list-empty">
          <Calendar className="icon-lg text-gray-400" />
          <h4>No Jobs Assigned</h4>
          <p>
            {summary?.truck_assignment 
              ? `No jobs are assigned to Truck ${summary.truck_assignment} for today.`
              : "No visible jobs are assigned for today."
            }
          </p>
          <p className="text-sm text-gray-500">
            Check with dispatch or try refreshing to see if new jobs have been assigned.
          </p>
        </div>
      ) : (
        <div className="field-job-list-container">
          {jobs.map((job, index) => (
            <div
              key={job.id}
              className="field-job-card"
              onClick={() => onJobSelect(job.id)}
            >
              <div className="field-job-card-header">
                <div className="field-job-card-title">
                  <h4>Job #{job.job_number}</h4>
                  <div className="field-job-card-badges">
                    <span className="field-job-order-badge">#{index + 1}</span>
                    <span className={`field-job-status-badge ${getStatusColorClass(job.mobile_status)}`}>
                      {job.mobile_status === "not_started" ? "Not Started" :
                       job.mobile_status === "started" ? "In Progress" : "Completed"}
                    </span>
                  </div>
                </div>
                <ChevronRight className="icon-md text-gray-400" />
              </div>

              <div className="field-job-card-content">
                <div className="field-job-info-item">
                  <User className="icon-sm text-gray-500" />
                  <span className="field-job-customer">{job.customer_name}</span>
                </div>
                
                <div className="field-job-info-item">
                  <MapPin className="icon-sm text-gray-500" />
                  <span className="field-job-address">{job.address}</span>
                </div>

                {job.total_time_hours > 0 && (
                  <div className="field-job-info-item">
                    <Clock className="icon-sm text-gray-500" />
                    <span>{job.total_time_hours}h worked</span>
                  </div>
                )}

                {job.total_doors > 0 && (
                  <div className="field-job-progress">
                    <span className="field-job-progress-text">
                      Progress: {job.completed_doors}/{job.total_doors} doors ({job.completion_percentage}%)
                    </span>
                    <div className="field-job-progress-bar">
                      <div 
                        className="field-job-progress-fill"
                        style={{ width: `${job.completion_percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Field Job Detail Component
 * Shows detailed job information with mobile worker access
 */
const FieldJobDetail = ({ jobId, onBack, onStartMobileWorker }) => {
  const [jobDetail, setJobDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load job detail
  useEffect(() => {
    const loadJobDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        const detail = await fieldTechService.getFieldJobDetail(jobId);
        setJobDetail(detail);
        
        console.log(`Loaded job detail for job ${jobId}`);
      } catch (err) {
        console.error("Error loading job detail:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      loadJobDetail();
    }
  }, [jobId]);

  // Format date display
  const formatDate = (dateString) => {
    if (!dateString) return "Not scheduled";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short", 
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Get mobile status display
  const getMobileStatusDisplay = (status) => {
    switch (status) {
      case "not_started": return { text: "Ready to Start", color: "blue" };
      case "started": return { text: "In Progress", color: "orange" };
      case "completed": return { text: "Completed", color: "green" };
      default: return { text: status, color: "gray" };
    }
  };

  if (loading) {
    return (
      <div className="field-job-detail-loading">
        <Loader className="icon-lg animate-spin text-blue-600" />
        <p>Loading job details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="field-job-detail-error">
        <AlertTriangle className="icon-lg text-red-500" />
        <h3>Error Loading Job Details</h3>
        <p>{error}</p>
        <button onClick={onBack} className="field-tech-button field-tech-button-secondary">
          Back to Jobs
        </button>
      </div>
    );
  }

  if (!jobDetail) {
    return (
      <div className="field-job-detail-error">
        <AlertTriangle className="icon-lg text-gray-500" />
        <h3>Job Not Found</h3>
        <p>The requested job could not be found.</p>
        <button onClick={onBack} className="field-tech-button field-tech-button-secondary">
          Back to Jobs
        </button>
      </div>
    );
  }

  const statusDisplay = getMobileStatusDisplay(jobDetail.mobile_status);

  return (
    <div className="field-job-detail">
      {/* Header */}
      <div className="field-job-detail-header">
        <button onClick={onBack} className="field-job-detail-back-button">
          <ArrowLeft className="icon-md" />
        </button>
        <div className="field-job-detail-title">
          <h1>Job #{jobDetail.job_number}</h1>
          <span className={`field-job-detail-status status-${statusDisplay.color}`}>
            {statusDisplay.text}
          </span>
        </div>
      </div>

      {/* Job Information Card */}
      <div className="field-job-detail-card">
        <h2>Job Information</h2>
        <div className="field-job-detail-info">
          <div className="field-job-detail-info-item">
            <div className="field-job-detail-info-label">
              <User className="icon-sm" />
              Customer
            </div>
            <div className="field-job-detail-info-value">{jobDetail.customer_name}</div>
          </div>

          <div className="field-job-detail-info-item">
            <div className="field-job-detail-info-label">
              <MapPin className="icon-sm" />
              Address
            </div>
            <div className="field-job-detail-info-value">{jobDetail.address}</div>
          </div>

          {jobDetail.contact_name && (
            <div className="field-job-detail-info-item">
              <div className="field-job-detail-info-label">
                <User className="icon-sm" />
                Contact
              </div>
              <div className="field-job-detail-info-value">{jobDetail.contact_name}</div>
            </div>
          )}

          {jobDetail.phone && (
            <div className="field-job-detail-info-item">
              <div className="field-job-detail-info-label">
                <Phone className="icon-sm" />
                Phone
              </div>
              <div className="field-job-detail-info-value">
                <a href={`tel:${jobDetail.phone}`}>{jobDetail.phone}</a>
              </div>
            </div>
          )}

          {jobDetail.email && (
            <div className="field-job-detail-info-item">
              <div className="field-job-detail-info-label">
                <Mail className="icon-sm" />
                Email
              </div>
              <div className="field-job-detail-info-value">
                <a href={`mailto:${jobDetail.email}`}>{jobDetail.email}</a>
              </div>
            </div>
          )}

          <div className="field-job-detail-info-item">
            <div className="field-job-detail-info-label">
              <MapPin className="icon-sm" />
              Region
            </div>
            <div className="field-job-detail-info-value">{jobDetail.region}</div>
          </div>

          {jobDetail.job_scope && (
            <div className="field-job-detail-info-item">
              <div className="field-job-detail-info-label">
                <FileText className="icon-sm" />
                Additional Notes
              </div>
              <div className="field-job-detail-info-value">{jobDetail.job_scope}</div>
            </div>
          )}
        </div>
      </div>

      {/* Status Information Card */}
      <div className="field-job-detail-card">
        <h2>Status Information</h2>
        <div className="field-job-detail-info">
          <div className="field-job-detail-info-item">
            <div className="field-job-detail-info-label">
              <Calendar className="icon-sm" />
              Scheduled Date
            </div>
            <div className="field-job-detail-info-value">{formatDate(jobDetail.scheduled_date)}</div>
          </div>

          <div className="field-job-detail-info-item">
            <div className="field-job-detail-info-label">
              <Wrench className="icon-sm" />
              Status
            </div>
            <div className="field-job-detail-info-value">{jobDetail.status}</div>
          </div>

          <div className="field-job-detail-info-item">
            <div className="field-job-detail-info-label">
              <Package className="icon-sm" />
              Material Ready
            </div>
            <div className="field-job-detail-info-value">{jobDetail.material_ready ? "Yes" : "No"}</div>
          </div>

          <div className="field-job-detail-info-item">
            <div className="field-job-detail-info-label">
              <Package className="icon-sm" />
              Material Location
            </div>
            <div className="field-job-detail-info-value">{jobDetail.material_location}</div>
          </div>

          {jobDetail.truck_assignment && (
            <div className="field-job-detail-info-item">
              <div className="field-job-detail-info-label">
                <Truck className="icon-sm" />
                Truck Assignment
              </div>
              <div className="field-job-detail-info-value">{jobDetail.truck_assignment}</div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Information (if job has doors) */}
      {jobDetail.total_doors > 0 && (
        <div className="field-job-detail-card">
          <h2>Progress Information</h2>
          <div className="field-job-detail-progress">
            <div className="field-job-detail-progress-summary">
              <div className="field-job-detail-progress-item">
                <span className="field-job-detail-progress-number">{jobDetail.total_doors}</span>
                <span className="field-job-detail-progress-label">Total Doors</span>
              </div>
              <div className="field-job-detail-progress-item">
                <span className="field-job-detail-progress-number">{jobDetail.completed_doors}</span>
                <span className="field-job-detail-progress-label">Completed</span>
              </div>
              <div className="field-job-detail-progress-item">
                <span className="field-job-detail-progress-number">{jobDetail.completion_percentage}%</span>
                <span className="field-job-detail-progress-label">Complete</span>
              </div>
            </div>
            
            {jobDetail.time_tracking?.total_hours > 0 && (
              <div className="field-job-detail-time-info">
                <Clock className="icon-sm" />
                <span>Total Time: {jobDetail.time_tracking.total_hours} hours</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="field-job-detail-actions">
        <button
          onClick={() => onStartMobileWorker(jobDetail.id)}
          className="field-tech-button field-tech-button-primary field-tech-button-large"
        >
          <Play className="icon-md" />
          {jobDetail.mobile_status === "not_started" 
            ? "Start Mobile Job Worker"
            : jobDetail.mobile_status === "started"
            ? "Continue Working on Job"
            : "View Completed Job"}
        </button>
      </div>
    </div>
  );
};

export default FieldTechInterface;