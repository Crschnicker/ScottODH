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
  
  // Create recent actions by combining all activities
  const getRecentActions = () => {
    const actions = [];
    
    // Add estimates as actions
    estimates.forEach(estimate => {
      actions.push({
        id: `estimate-${estimate.id}`,
        type: 'estimate',
        title: `EST-${estimate.id}`,
        description: `Estimate created for ${estimate.customer_name}`,
        status: estimate.status,
        date: estimate.created_at,
        link: '/estimates'
      });
    });
    
    // Add bids as actions
    bids.forEach(bid => {
      actions.push({
        id: `bid-${bid.id}`,
        type: 'bid',
        title: `BID-${bid.id}`,
        description: `Bid ${bid.status} for ${bid.customer_name}`,
        status: bid.status,
        date: bid.updated_at || bid.created_at,
        link: '/bids'
      });
    });
    
    // Add jobs as actions
    jobs.forEach(job => {
      const actionType = job.scheduled_date ? 'scheduled' : 'created';
      actions.push({
        id: `job-${job.id}`,
        type: 'job',
        title: job.job_number,
        description: `Job ${actionType} for ${job.customer_name}`,
        status: job.status,
        date: job.scheduled_date || job.updated_at || job.created_at,
        link: '/jobs',
        region: job.region
      });
    });
    
    // Sort by date (most recent first) and return top 10
    return actions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
  };
  
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  const getActionIcon = (type) => {
    switch (type) {
      case 'estimate':
        return <FaClipboardList className="action-icon estimates-color" />;
      case 'bid':
        return <FaFileInvoiceDollar className="action-icon bids-color" />;
      case 'job':
        return <FaTools className="action-icon jobs-color" />;
      default:
        return <FaCalendarAlt className="action-icon" />;
    }
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
        <Col md={12}>
          <Card className="recent-actions-card">
            <Card.Header>Recent Actions</Card.Header>
            <Card.Body>
              {getRecentActions().length === 0 ? (
                <p className="text-muted">No recent actions found.</p>
              ) : (
                <div className="recent-actions-list">
                  {getRecentActions().map(action => (
                    <div className="recent-action-item" key={action.id}>
                      <div className="action-icon-wrapper">
                        {getActionIcon(action.type)}
                      </div>
                      <div className="action-content">
                        <div className="action-header">
                          <span className="action-title">{action.title}</span>
                          <div className="action-badges">
                            {action.region && (
                              <span className="region-label">{action.region}</span>
                            )}
                            <span className={`status-badge status-${action.status}`}>
                              {action.status ? action.status.charAt(0).toUpperCase() + action.status.slice(1) : 'No Status'}
                            </span>
                          </div>
                        </div>
                        <div className="action-details">
                          <span className="action-description">{action.description}</span>
                          <span className="action-date">{formatDate(action.date)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;