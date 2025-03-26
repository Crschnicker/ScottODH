import React, { useState, useEffect } from 'react';
import { Table, Button, Badge, Form, InputGroup, Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaSearch, FaCalendarAlt } from 'react-icons/fa';
import { getJobs } from '../../services/jobService';
import './JobList.css';

const JobList = ({ onSelectJob }) => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadJobs();
  }, [regionFilter, statusFilter]);
  
  useEffect(() => {
    if (searchTerm) {
      const filtered = jobs.filter(job => 
        job.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.job_scope && job.job_scope.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (job.address && job.address.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredJobs(filtered);
    } else {
      setFilteredJobs(jobs);
    }
  }, [searchTerm, jobs]);
  
  const loadJobs = async () => {
    try {
      const params = {};
      if (regionFilter) params.region = regionFilter;
      if (statusFilter) params.status = statusFilter;
      
      const data = await getJobs(params);
      setJobs(data);
      setFilteredJobs(data);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  const getStatusBadge = (status) => {
    switch(status) {
      case 'unscheduled':
        return <Badge bg="secondary">Unscheduled</Badge>;
      case 'scheduled':
        return <Badge bg="primary">Scheduled</Badge>;
      case 'waiting_for_parts':
        return <Badge bg="warning">Waiting for Parts</Badge>;
      case 'on_hold':
        return <Badge bg="danger">On Hold</Badge>;
      case 'completed':
        return <Badge bg="success">Completed</Badge>;
      default:
        return <Badge bg="info">{status}</Badge>;
    }
  };
  
  const getMaterialBadge = (ready, location) => {
    if (!ready) {
      return <Badge bg="danger">No</Badge>;
    }
    
    return (
      <Badge bg="success">
        Yes ({location === 'S' ? 'Shop' : location === 'C' ? 'Client' : location})
      </Badge>
    );
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'Not Scheduled';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  if (loading) {
    return <div>Loading jobs...</div>;
  }
  
  return (
    <div className="job-list-container">
      <div className="job-list-header">
        <h2>Jobs</h2>
        <div className="job-list-filters">
          <Dropdown className="filter-dropdown">
            <Dropdown.Toggle variant="outline-secondary" id="region-dropdown">
              {regionFilter ? `Region: ${regionFilter}` : 'All Regions'}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => setRegionFilter('')}>All Regions</Dropdown.Item>
              <Dropdown.Item onClick={() => setRegionFilter('OC')}>Orange County (OC)</Dropdown.Item>
              <Dropdown.Item onClick={() => setRegionFilter('LA')}>Los Angeles (LA)</Dropdown.Item>
              <Dropdown.Item onClick={() => setRegionFilter('IE')}>Inland Empire (IE)</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          
          <Dropdown className="filter-dropdown">
            <Dropdown.Toggle variant="outline-secondary" id="status-dropdown">
              {statusFilter ? `Status: ${statusFilter.replace('_', ' ')}` : 'All Statuses'}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => setStatusFilter('')}>All Statuses</Dropdown.Item>
              <Dropdown.Item onClick={() => setStatusFilter('unscheduled')}>Unscheduled</Dropdown.Item>
              <Dropdown.Item onClick={() => setStatusFilter('scheduled')}>Scheduled</Dropdown.Item>
              <Dropdown.Item onClick={() => setStatusFilter('waiting_for_parts')}>Waiting for Parts</Dropdown.Item>
              <Dropdown.Item onClick={() => setStatusFilter('on_hold')}>On Hold</Dropdown.Item>
              <Dropdown.Item onClick={() => setStatusFilter('completed')}>Completed</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          
          <InputGroup className="search-input">
            <InputGroup.Text>
              <FaSearch />
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </InputGroup>
        </div>
      </div>
      
      {filteredJobs.length === 0 ? (
        <p>No jobs found with the selected filters.</p>
      ) : (
        <Table striped hover responsive className="job-table">
          <thead>
            <tr>
              <th>Job #</th>
              <th>Customer</th>
              <th>Location</th>
              <th>Scope</th>
              <th>Scheduled Date</th>
              <th>Status</th>
              <th>Material</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.map(job => (
              <tr key={job.id}>
                <td>{job.job_number}</td>
                <td>{job.customer_name}</td>
                <td>
                  {job.address ? job.address : 'N/A'}
                  <div className="region-tag">{job.region}</div>
                </td>
                <td>{job.job_scope || 'N/A'}</td>
                <td>{formatDate(job.scheduled_date)}</td>
                <td>{getStatusBadge(job.status)}</td>
                <td>{getMaterialBadge(job.material_ready, job.material_location)}</td>
                <td>
                  {onSelectJob ? (
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={() => onSelectJob(job)}
                      className="me-2"
                    >
                      Select
                    </Button>
                  ) : (
                    <Link to={`/jobs/${job.id}`}>
                      <Button variant="outline-primary" size="sm" className="me-2">
                        Details
                      </Button>
                    </Link>
                  )}
                  
                  <Link to={`/schedule?jobId=${job.id}`}>
                    <Button variant="outline-success" size="sm">
                      <FaCalendarAlt /> Schedule
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default JobList;
