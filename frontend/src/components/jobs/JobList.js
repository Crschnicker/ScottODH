import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Spinner, InputGroup, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { 
  FaSearch, 
  FaCalendarAlt, 
  FaTimes, 
  FaExclamationTriangle,
  FaSync
} from 'react-icons/fa';
import { getJobs } from '../../services/jobService';
import { toast } from 'react-toastify';
import './JobList.css';

/**
 * Enhanced JobList Component - 3 Column Region Layout
 * 
 * Displays jobs in a compact 3-column layout organized by region (OC, LA, IE)
 * 
 * @param {Function} onSelectJob - Optional callback when a job is selected
 */
const JobList = ({ onSelectJob }) => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Define regions for job organization
  const regions = [
    { code: 'OC', name: 'Orange County' },
    { code: 'LA', name: 'Los Angeles' },
    { code: 'IE', name: 'Inland Empire' }
  ];
  
  /**
   * Format job number to display single digit job numbers with leading zero
   * Handles the specific format: [2 Month Letters][Job Number][2 Year Digits]
   * Examples:
   * - MY125 → MY0125 (May, Job #1, Year 25)
   * - MY225 → MY0225 (May, Job #2, Year 25)  
   * - MY1025 → MY1025 (May, Job #10, Year 25 - no change needed)
   * - MY0125 → MY0125 (already formatted - no change)
   * 
   * @param {string|number} jobNumber - The original job number
   * @returns {string} Formatted job number with leading zero for single digit job numbers
   */
  const formatJobNumber = (jobNumber) => {
    if (!jobNumber) return '';
    
    const jobStr = String(jobNumber).trim();
    
    // Handle pure single digits (1, 2, 3, etc.)
    if (/^\d$/.test(jobStr)) {
      return `0${jobStr}`;
    }
    
    // Handle the specific format: [2 Letters][Job Number][25]
    // Match pattern: 2 letters + digits + 25 at the end
    const jobPatternMatch = jobStr.match(/^([A-Za-z]{2})(\d+)(25)$/);
    
    if (jobPatternMatch) {
      const [, monthCode, jobNum, year] = jobPatternMatch;
      
      // Check if job number is single digit and doesn't already have leading zero
      if (jobNum.length === 1) {
        return `${monthCode}0${jobNum}${year}`;
      }
      
      // If job number already has leading zero or is multi-digit, return as-is
      return jobStr;
    }
    
    // For any other format, return unchanged
    return jobStr;
  };
  
  /**
   * Load jobs from API with error handling and loading states
   */
  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsRefreshing(true);
    
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      
      const data = await getJobs(params);
      setJobs(data);
      setFilteredJobs(data);
    } catch (err) {
      console.error('Error loading jobs:', err);
      setError('Failed to load jobs. Please try again.');
      toast.error('Failed to load jobs. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter]);
  
  /**
   * Load jobs on component mount or when filters change
   */
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);
  
  /**
   * Filter jobs based on search term and status filter
   * Automatically excludes cancelled jobs unless specifically filtering for them
   * Note: Search uses original job_number to ensure compatibility with both formatted and unformatted numbers
   */
  useEffect(() => {
    let filtered = jobs;
    
    // Filter out cancelled jobs unless specifically looking for them
    if (statusFilter !== 'cancelled') {
      filtered = filtered.filter(job => job.status !== 'cancelled');
    }
    
    // Apply search filter if search term exists
    if (searchTerm && filtered.length) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(job => {
        const originalJobNumber = String(job.job_number || '').toLowerCase();
        const formattedJobNumber = formatJobNumber(job.job_number).toLowerCase();
        
        // Search both original and formatted job numbers to handle user expectations
        return originalJobNumber.includes(searchLower) ||
               formattedJobNumber.includes(searchLower) ||
               (job.customer_name && job.customer_name.toLowerCase().includes(searchLower)) ||
               (job.job_scope && job.job_scope.toLowerCase().includes(searchLower)) ||
               (job.address && job.address.toLowerCase().includes(searchLower));
      });
    }
    
    setFilteredJobs(filtered);
  }, [searchTerm, jobs, statusFilter]);
  
  /**
   * Get jobs filtered by specific region code
   * @param {string} regionCode - The region code to filter by (OC, LA, IE)
   * @returns {Array} Array of jobs for the specified region
   */
  const getJobsByRegion = (regionCode) => {
    return filteredJobs.filter(job => job.region === regionCode);
  };
  
  /**
   * Handle search input changes with real-time filtering
   * @param {Event} e - Input change event
   */
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  /**
   * Clear the search input and reset filtering
   */
  const clearSearch = () => {
    setSearchTerm('');
  };
  
  /**
   * Format date string for display, avoiding timezone conversion issues
   * @param {string} dateString - ISO date string from API
   * @returns {string|null} Formatted date string or null if no date
   */
  const formatDate = (dateString) => {
    if (!dateString) return null;
    
    try {
      // Parse the ISO date string (YYYY-MM-DD) as local date to avoid timezone conversion
      const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
      const localDate = new Date(year, month - 1, day); // month is 0-indexed
      
      const options = { month: 'short', day: 'numeric' };
      return localDate.toLocaleDateString(undefined, options);
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return null;
    }
  };
  
  /**
   * Get the best description for a job, prioritizing job scope over customer name
   * @param {Object} job - Job object from API
   * @returns {string} The job description to display
   */
  const getJobDescription = (job) => {
    // Return the full job scope if available and not empty, otherwise use customer name
    if (job.job_scope && job.job_scope.trim()) {
      return job.job_scope.trim();
    }
    return job.customer_name || 'No Description';
  };
  
  /**
   * Get formatted date display with calendar icon for scheduled jobs
   * @param {Object} job - Job object from API
   * @returns {JSX.Element|null} Formatted date component or null if no date
   */
  const getDateDisplay = (job) => {
    const formattedDate = formatDate(job.scheduled_date);
    if (formattedDate) {
      return (
        <span className="text-success">
          <FaCalendarAlt className="me-1" style={{ fontSize: '0.8em' }} />
          {formattedDate}
        </span>
      );
    }
    return null; // Return null for empty date column when not scheduled
  };

  /**
   * Generate status dot with appropriate color based on job status
   * @param {Object} job - Job object from API
   * @returns {JSX.Element} Status dot component with tooltip
   */
  const getStatusDot = (job) => {
    const status = job.status;
    let color = '#6c757d'; // Default grey for unknown/unscheduled
    
    // Map status values to appropriate colors
    switch(status) {
      case 'scheduled':
        color = '#28a745'; // Green - ready to go
        break;
      case 'waiting_for_parts':
        color = '#ffc107'; // Yellow - waiting
        break;
      case 'on_hold':
        color = '#dc3545'; // Red - blocked
        break;
      case 'completed':
        color = '#007bff'; // Blue - finished
        break;
      case 'cancelled':
        color = '#6c757d'; // Grey - inactive
        break;
      case 'unscheduled':
      default:
        color = '#6c757d'; // Grey - not scheduled
        break;
    }
    
    // Format status text for tooltip display
    const statusText = status ? 
      status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : 
      'No Status';
    
    return (
      <div 
        className="status-dot"
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block'
        }}
        title={statusText}
      />
    );
  };
  
  /**
   * Render a complete region column with header, job table, and empty state
   * @param {Object} region - Region object with code and name
   * @returns {JSX.Element} Complete region column component
   */
  const renderRegionColumn = (region) => {
    const regionJobs = getJobsByRegion(region.code);
    
    return (
      <div key={region.code} className="col-md-4 region-column">
        {/* Region Header with job count */}
        <div className="region-header">
          <h6 className="mb-2 text-center font-weight-bold">
            {region.name} ({region.code})
            <span className="badge badge-secondary ms-2">{regionJobs.length}</span>
          </h6>
        </div>
        
        {/* Jobs Table or Empty State */}
        {regionJobs.length === 0 ? (
          <div className="text-center py-4 text-muted">
            <small>No jobs in this region</small>
          </div>
        ) : (
          <div className="table-responsive">
            <Table size="sm" className="compact-job-table mb-0">
              <thead>
                <tr>
                  <th className="job-num-col">Job #</th>
                  <th className="description-col">Description</th>
                  <th className="date-col">Date</th>
                  <th className="status-col"></th>
                </tr>
              </thead>
              <tbody>
                {regionJobs.map(job => {
                  const isJobCancelled = job.status === 'cancelled';
                  
                  return (
                    <tr 
                      key={job.id} 
                      className={`compact-job-row ${isJobCancelled ? 'cancelled-job-row' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (onSelectJob) {
                          onSelectJob(job);
                        }
                      }}
                    >
                      {/* Job Number Column with Link - Now displays formatted job number */}
                      <td className="job-num-cell" data-label="Job #">
                        <Link 
                          to={`/jobs/${job.id}`} 
                          className="job-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {formatJobNumber(job.job_number)}
                        </Link>
                      </td>
                      
                      {/* Description Column with Tooltip */}
                      <td className="description-cell" data-label="Description">
                        <div title={job.job_scope || job.customer_name}>
                          {getJobDescription(job)}
                        </div>
                      </td>
                      
                      {/* Date Column */}
                      <td className="date-cell" data-label="Date">
                        {getDateDisplay(job)}
                      </td>
                      
                      {/* Status and Actions Column */}
                      <td className="status-cell">
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="status-dot-container">
                            {getStatusDot(job)}
                          </div>
                          {!isJobCancelled && (
                            <div className="job-actions">
                              <Link to={`/schedule/job/${job.id}`}>
                                <Button 
                                  variant="outline-success" 
                                  size="sm" 
                                  className="compact-btn"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Schedule Job"
                                >
                                  <FaCalendarAlt style={{ fontSize: '0.7em' }} />
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Render loading state with spinner
   */
  if (loading && !isRefreshing) {
    return (
      <div className="loading-container">
        <Spinner animation="border" variant="primary" />
        <p>Loading jobs...</p>
      </div>
    );
  }
  
  return (
    <div className="job-list-container">
      {/* Enhanced Page Header with Dark Theme */}
      <div className="page-header">
        <h4>Jobs by Region</h4>
        
        {/* Search and Filter Controls */}
        <div className="controls-row">
          <div className="row align-items-center">
            {/* Search Input */}
            <div className="col-md-6">
              <InputGroup size="sm">
                <InputGroup.Text className="search-icon">
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search jobs by number, customer, scope, or address..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="search-input"
                />
                {searchTerm && (
                  <Button 
                    variant="outline-secondary" 
                    onClick={clearSearch}
                    size="sm"
                    title="Clear search"
                  >
                    <FaTimes />
                  </Button>
                )}
              </InputGroup>
            </div>
            
            {/* Status Filter */}
            <div className="col-md-4">
              <Form.Select 
                size="sm" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by job status"
              >
                <option value="">All Statuses</option>
                <option value="unscheduled">Unscheduled</option>
                <option value="scheduled">Scheduled</option>
                <option value="waiting_for_parts">Waiting for Parts</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Form.Select>
            </div>
            
            {/* Refresh Button */}
            <div className="col-md-2">
              <Button 
                variant="outline-secondary" 
                size="sm" 
                onClick={loadJobs}
                disabled={isRefreshing}
                className="w-100 refresh-btn"
                title="Refresh job list"
              >
                <FaSync className={isRefreshing ? 'spin' : ''} /> 
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Area with Proper Padding */}
      <div className="job-list-content">
        {/* Error State */}
        {error ? (
          <div className="error-state">
            <FaExclamationTriangle className="me-2" />
            <p>{error}</p>
            <Button 
              variant="outline-primary" 
              onClick={loadJobs} 
              size="sm"
              className="mt-2"
            >
              Try again
            </Button>
          </div>
        ) : (
          /* Region Columns */
          <div className="row">
            {regions.map(region => renderRegionColumn(region))}
          </div>
        )}
        
        {/* Empty State when no jobs found */}
        {filteredJobs.length === 0 && !loading && !error && (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No jobs found</p>
            {(searchTerm || statusFilter) && (
              <Button 
                variant="outline-secondary" 
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
      
      {/* Footer with Job Counts */}
      {filteredJobs.length > 0 && (
        <div className="list-footer">
          <div className="d-flex justify-content-between align-items-center">
            <small className="text-muted">
              Showing {filteredJobs.length} of {jobs.length} jobs
              {(statusFilter || searchTerm) && ' (filtered)'}
            </small>
            <small className="text-muted">
              OC: {getJobsByRegion('OC').length} | 
              LA: {getJobsByRegion('LA').length} | 
              IE: {getJobsByRegion('IE').length}
            </small>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobList;