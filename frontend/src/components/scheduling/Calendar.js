import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { Card, Badge, Button, ListGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getJobs } from '../../services/jobService';
import 'react-calendar/dist/Calendar.css';
import './Calendar.css';

const JobCalendar = ({ region, onSelectDate }) => {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [scheduledJobs, setScheduledJobs] = useState({});
  const [selectedDateJobs, setSelectedDateJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  
  useEffect(() => {
    loadScheduledJobs();
  }, [region]);
  
  useEffect(() => {
    const dateStr = formatDateKey(calendarDate);
    setSelectedDateJobs(scheduledJobs[dateStr] || []);
  }, [calendarDate, scheduledJobs]);
  
  const loadScheduledJobs = async () => {
    try {
      const params = { status: 'scheduled' };
      if (region && region !== 'ALL') {
        params.region = region;
      }
      
      const jobs = await getJobs(params);
      
      // Group jobs by date
      const grouped = jobs.reduce((acc, job) => {
        if (job.scheduled_date) {
          const dateKey = formatDateKey(new Date(job.scheduled_date));
          
          if (!acc[dateKey]) {
            acc[dateKey] = [];
          }
          
          acc[dateKey].push(job);
        }
        return acc;
      }, {});
      
      setScheduledJobs(grouped);
    } catch (error) {
      console.error('Error loading scheduled jobs:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatDateKey = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  
  const handleDateChange = (date) => {
    setCalendarDate(date);
    
    if (onSelectDate) {
      onSelectDate(date);
    }
  };
  
  const getDateContent = (date) => {
    const dateStr = formatDateKey(date);
    const jobs = scheduledJobs[dateStr] || [];
    
    if (jobs.length === 0) {
      return null;
    }
    
    return (
      <div className="job-count-marker">
        <Badge bg="primary" pill>{jobs.length}</Badge>
      </div>
    );
  };
  
  const formatDisplayDate = (date) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };
  
  if (loading) {
    return <div>Loading calendar...</div>;
  }
  
  return (
    <div className="job-calendar-container">
      <div className="calendar-wrapper">
        <Calendar 
          onChange={handleDateChange}
          value={calendarDate}
          tileContent={({ date }) => getDateContent(date)}
          tileClassName={({ date }) => {
            const dateStr = formatDateKey(date);
            return scheduledJobs[dateStr]?.length > 0 ? 'has-jobs' : null;
          }}
        />
      </div>
      
      <Card className="date-details">
        <Card.Header>
          <h5>{formatDisplayDate(calendarDate)}</h5>
        </Card.Header>
        <Card.Body>
          {selectedDateJobs.length === 0 ? (
            <p className="text-muted">No jobs scheduled for this date.</p>
          ) : (
            <>
              <h6>{selectedDateJobs.length} Jobs Scheduled</h6>
              <ListGroup variant="flush">
                {selectedDateJobs.map(job => (
                  <ListGroup.Item 
                    key={job.id}
                    className="scheduled-job-item"
                  >
                    <div className="job-info">
                      <div className="job-name">
                        <span className="job-number">{job.job_number}</span>
                        {job.customer_name}
                      </div>
                      <div className="job-address">
                        {job.address || 'No address'} 
                        <Badge 
                          bg="secondary" 
                          className="region-badge"
                        >
                          {job.region}
                        </Badge>
                      </div>
                    </div>
                    <div className="job-actions">
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        Details
                      </Button>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </>
          )}
          
          {onSelectDate && (
            <div className="text-center mt-3">
              <Button 
                variant="success"
                onClick={() => onSelectDate(calendarDate)}
              >
                Schedule Job for This Date
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default JobCalendar;
