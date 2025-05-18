import React, { useState, useEffect } from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaClipboardList, FaFileInvoiceDollar, FaTools, FaCalendarAlt } from 'react-icons/fa';
import { getEstimates } from '../services/estimateService';
import { getBids } from '../services/bidService';
import { getJobs } from '../services/jobService';
import './Dashboard.css';

const Dashboard = () => {
  const [estimates, setEstimates] = useState([]);
  const [bids, setBids] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [estimatesData, bidsData, jobsData] = await Promise.all([
          getEstimates(),
          getBids(),
          getJobs()
        ]);
        
        setEstimates(estimatesData);
        setBids(bidsData);
        setJobs(jobsData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const pendingEstimates = estimates.filter(e => e.status === 'pending');
  const draftBids = bids.filter(b => b.status === 'draft');
  const unscheduledJobs = jobs.filter(j => j.status === 'unscheduled');
  const scheduledJobs = jobs.filter(j => j.status === 'scheduled');
  

  
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  if (loading) {
    return <div>Loading dashboard data...</div>;
  }
  
  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Scott Overhead Doors</h1>
      
      <Row>
        <Col md={3} sm={6}>
          <Card className="dashboard-card">
            <Card.Body>
              <div className="card-icon-container estimates-icon">
                <FaClipboardList className="card-icon" />
              </div>
              <h3 className="metric-value">{pendingEstimates.length}</h3>
              <p className="metric-label">Pending Estimates</p>
            </Card.Body>
            <Card.Footer>
              <Link to="/estimates">View All Estimates</Link>
            </Card.Footer>
          </Card>
        </Col>
        
        <Col md={3} sm={6}>
          <Card className="dashboard-card">
            <Card.Body>
              <div className="card-icon-container bids-icon">
                <FaFileInvoiceDollar className="card-icon" />
              </div>
              <h3 className="metric-value">{draftBids.length}</h3>
              <p className="metric-label">Draft Bids</p>
            </Card.Body>
            <Card.Footer>
              <Link to="/bids">View All Bids</Link>
            </Card.Footer>
          </Card>
        </Col>
        
        <Col md={3} sm={6}>
          <Card className="dashboard-card">
            <Card.Body>
              <div className="card-icon-container jobs-icon">
                <FaTools className="card-icon" />
              </div>
              <h3 className="metric-value">{unscheduledJobs.length}</h3>
              <p className="metric-label">Unscheduled Jobs</p>
            </Card.Body>
            <Card.Footer>
              <Link to="/jobs">View All Jobs</Link>
            </Card.Footer>
          </Card>
        </Col>
        
        <Col md={3} sm={6}>
          <Card className="dashboard-card">
            <Card.Body>
              <div className="card-icon-container schedule-icon">
                <FaCalendarAlt className="card-icon" />
              </div>
              <h3 className="metric-value">{scheduledJobs.length}</h3>
              <p className="metric-label">Scheduled Jobs</p>
            </Card.Body>
            <Card.Footer>
              <Link to="/schedule">View Schedule</Link>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
      
      <Row className="mt-4">
        <Col md={6}>
          <Card>
            <Card.Header>Recent Estimates</Card.Header>
            <Card.Body>
              {estimates.length === 0 ? (
                <p className="text-muted">No estimates found.</p>
              ) : (
                <div className="recent-list">
                  {estimates.slice(0, 5).map(estimate => (
                    <div className="recent-item" key={estimate.id}>
                      <div className="recent-item-header">
                        <span className="recent-item-title">EST-{estimate.id}</span>
                        {estimate.status ? estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1) : 'No Status'}
                      </div>
                      <div className="recent-item-details">
                        <span>{estimate.customer_name}</span>
                        <span className="text-muted">{formatDate(estimate.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
            <Card.Footer>
              <Link to="/estimates">View All Estimates</Link>
            </Card.Footer>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card>
            <Card.Header>Upcoming Jobs</Card.Header>
            <Card.Body>
              {scheduledJobs.length === 0 ? (
                <p className="text-muted">No upcoming jobs found.</p>
              ) : (
                <div className="recent-list">
                  {scheduledJobs.slice(0, 5).map(job => (
                    <div className="recent-item" key={job.id}>
                      <div className="recent-item-header">
                        <span className="recent-item-title">{job.job_number}</span>
                        <span className="region-label">{job.region}</span>
                      </div>
                      <div className="recent-item-details">
                        <span>{job.customer_name}</span>
                        <span className="text-muted">
                          {job.scheduled_date ? formatDate(job.scheduled_date) : 'Not scheduled'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
            <Card.Footer>
              <Link to="/jobs">View All Jobs</Link>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
