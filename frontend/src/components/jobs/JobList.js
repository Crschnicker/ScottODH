import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Spinner, Dropdown, InputGroup, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { 
  FaSearch, 
  FaCalendarAlt, 
  FaFilter, 
  FaTimes, 
  FaSortAmountDown, 
  FaExclamationTriangle,
  FaSync 
} from 'react-icons/fa';
import { getJobs } from '../../services/jobService';
import './JobList.css';

/**
 * Enhanced JobList Component
 * 
 * Displays a modern, responsive list of jobs with advanced filtering
 * and sorting capabilities
 * 
 * @param {Function} onSelectJob - Optional callback when a job is selected
 */
const JobList = ({ onSelectJob }) => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortField, setSortField] = useState('scheduled_date');
  const [sortDirection, setSortDirection] = useState('desc');
  
  /**
   * Load jobs from API
   */
  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsRefreshing(true);
    
    try {
      const params = {};
      if (regionFilter) params.region = regionFilter;
      if (statusFilter) params.status = statusFilter;
      
      const data = await getJobs(params);
      setJobs(data);
      setFilteredJobs(data);
    } catch (err) {
      console.error('Error loading jobs:', err);
      setError('Failed to load jobs. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [regionFilter, statusFilter]);
  
  /**
   * Load jobs on component mount or when filters change
   */
  // Only run loadJobs when filters change, not when loadJobs reference changes
  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionFilter, statusFilter]);
  
  /**
   * Filter jobs based on search term
   */
  useEffect(() => {
    if (searchTerm && jobs.length) {
      const filtered = jobs.filter(job => 
        job.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.job_scope && job.job_scope.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (job.address && job.address.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredJobs(filtered);
    } else if (jobs.length) {
      setFilteredJobs(jobs);
    }
  }, [searchTerm, jobs]);
  
  /**
   * Sort jobs when sort criteria changes
   */
  useEffect(() => {
    if (!jobs.length) return;
    
    const sorted = [...filteredJobs].sort((a, b) => {
      // Handle null values for scheduled_date
      if (sortField === 'scheduled_date') {
        if (!a.scheduled_date && !b.scheduled_date) return 0;
        if (!a.scheduled_date) return sortDirection === 'asc' ? -1 : 1;
        if (!b.scheduled_date) return sortDirection === 'asc' ? 1 : -1;
      }
      
      const valueA = a[sortField] || '';
      const valueB = b[sortField] || '';
      
      // For strings
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      }
      
      // For dates
      if (sortField === 'scheduled_date') {
        const dateA = new Date(valueA);
        const dateB = new Date(valueB);
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      // For numbers or other types
      return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });
    
    setFilteredJobs(sorted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDirection]);
  
  /**
   * Handle search input changes
   */
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  /**
   * Clear search input
   */
  const clearSearch = () => {
    setSearchTerm('');
  };
  
  /**
   * Toggle sort direction
   */
  const toggleSort = (field) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  /**
  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'Not Scheduled';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  /**
   * Render loading state
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
      <Card className="job-list-card">
        <Card.Header>
          <div className="job-list-header">
            <h4 className="mb-0">Jobs</h4>
          </div>
        </Card.Header>
        
        <Card.Body>
          <div className="filters-row">
            <div className="filters-group">
              <Dropdown className="filter-dropdown">
                <Dropdown.Toggle variant="outline-secondary" id="region-dropdown" className="filter-toggle">
                  <FaFilter className="me-2" />
                  {regionFilter ? `Region: ${regionFilter}` : 'All Regions'}
                </Dropdown.Toggle>
                <Dropdown.Menu className="filter-menu">
                  <Dropdown.Item active={!regionFilter} onClick={() => setRegionFilter('')}>All Regions</Dropdown.Item>
                  <Dropdown.Item active={regionFilter === 'OC'} onClick={() => setRegionFilter('OC')}>Orange County (OC)</Dropdown.Item>
                  <Dropdown.Item active={regionFilter === 'LA'} onClick={() => setRegionFilter('LA')}>Los Angeles (LA)</Dropdown.Item>
                  <Dropdown.Item active={regionFilter === 'IE'} onClick={() => setRegionFilter('IE')}>Inland Empire (IE)</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              
              <Dropdown className="filter-dropdown">
                <Dropdown.Toggle variant="outline-secondary" id="status-dropdown" className="filter-toggle">
                  <FaFilter className="me-2" />
                  {statusFilter ? `Status: ${statusFilter.replace('_', ' ')}` : 'All Statuses'}
                </Dropdown.Toggle>
                <Dropdown.Menu className="filter-menu">
                  <Dropdown.Item active={!statusFilter} onClick={() => setStatusFilter('')}>All Statuses</Dropdown.Item>
                  <Dropdown.Item active={statusFilter === 'unscheduled'} onClick={() => setStatusFilter('unscheduled')}>Unscheduled</Dropdown.Item>
                  <Dropdown.Item active={statusFilter === 'scheduled'} onClick={() => setStatusFilter('scheduled')}>Scheduled</Dropdown.Item>
                  <Dropdown.Item active={statusFilter === 'waiting_for_parts'} onClick={() => setStatusFilter('waiting_for_parts')}>Waiting for Parts</Dropdown.Item>
                  <Dropdown.Item active={statusFilter === 'on_hold'} onClick={() => setStatusFilter('on_hold')}>On Hold</Dropdown.Item>
                  <Dropdown.Item active={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')}>Completed</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
            
            <InputGroup className="search-input-container">
              <InputGroup.Text className="search-icon">
                <FaSearch />
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Search jobs by number, customer, scope..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="search-input"
              />
              {searchTerm && (
                <Button 
                  variant="outline-secondary" 
                  onClick={clearSearch}
                  className="clear-search"
                >
                  <FaTimes />
                </Button>
              )}
            </InputGroup>
          </div>
          
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
          ) : filteredJobs.length === 0 ? (
            <div className="empty-state">
              <FaExclamationTriangle className="empty-icon" />
              <p>No jobs found with the selected filters.</p>
              <div className="mt-3">
                <Button 
                  variant="outline-primary" 
                  onClick={() => {
                    setRegionFilter('');
                    setStatusFilter('');
                    setSearchTerm('');
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="job-table">
                <thead>
                  <tr>
                    <th className="sortable-header" onClick={() => toggleSort('job_number')}>
                      <div className="header-content">
                        Job # 
                        {sortField === 'job_number' && (
                          <FaSortAmountDown className={`sort-icon ${sortDirection === 'desc' ? 'desc' : 'asc'}`} />
                        )}
                      </div>
                    </th>
                    <th className="sortable-header" onClick={() => toggleSort('customer_name')}>
                      <div className="header-content">
                        Customer
                        {sortField === 'customer_name' && (
                          <FaSortAmountDown className={`sort-icon ${sortDirection === 'desc' ? 'desc' : 'asc'}`} />
                        )}
                      </div>
                    </th>
                    <th>Location</th>
                    <th className="hide-sm">Scope</th>
                    <th className="sortable-header" onClick={() => toggleSort('scheduled_date')}>
                      <div className="header-content">
                        Scheduled Date
                        {sortField === 'scheduled_date' && (
                          <FaSortAmountDown className={`sort-icon ${sortDirection === 'desc' ? 'desc' : 'asc'}`} />
                        )}
                      </div>
                    </th>
                    <th>Status</th>
                    <th className="hide-sm">Material</th>
                    <th className="actions-column">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map(job => (
                    <tr key={job.id}>
                      <td data-label="Job #">{job.job_number}</td>
                      <td data-label="Customer">{job.customer_name}</td>
                      <td data-label="Location">
                        <div className="location-info">
                          <div className="address-text">{job.address || 'N/A'}</div>
                          {job.region}
                        </div>
                      </td>
                      <td data-label="Scope" className="hide-sm">{job.job_scope || 'N/A'}</td>
                      <td data-label="Scheduled Date">{formatDate(job.scheduled_date)}</td>
                      <td data-label="Status">{job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1).replace(/_/g, ' ') : 'No Status'}</td>
                      <td data-label="Material Ready">
                        {job.material_ready ? `Yes${job.material_location ? ' (' + (job.material_location === 'S' ? 'Shop' : job.material_location === 'C' ? 'Client' : job.material_location) + ')' : ''}` : 'No'}
                      </td>
                      <td data-label="Action" className="actions-column">
                        <div className="action-buttons">
                          {onSelectJob ? (
                            <Button 
                              variant="outline-primary" 
                              size="sm"
                              onClick={() => onSelectJob(job)}
                              className="action-btn"
                            >
                              Select
                            </Button>
                          ) : (
                            <Link to={`/jobs/${job.id}`} className="action-link">
                              <Button variant="outline-primary" size="sm" className="action-btn">
                                Details
                              </Button>
                            </Link>
                          )}
                          
                          <Link to={`/schedule/job/${job.id}`} className="action-link">
                            <Button variant="outline-success" size="sm" className="action-btn">
                              <FaCalendarAlt className="me-1" /> Schedule
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
        
        {filteredJobs.length > 0 && (
          <Card.Footer className="list-footer">
            <div className="d-flex justify-content-between align-items-center">
              <small className="text-muted">
                Showing {filteredJobs.length} of {jobs.length} jobs
                {(regionFilter || statusFilter || searchTerm) && ' (filtered)'}
              </small>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                onClick={loadJobs}
                disabled={isRefreshing}
                className="refresh-btn"
              >
                <FaSync className={isRefreshing ? 'spin' : ''} /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </Card.Footer>
        )}
      </Card>
    </div>
  );
};

export default JobList;