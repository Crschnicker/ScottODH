import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { Card, Button, ListGroup, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getJobs } from '../../services/jobService';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css';

/**
 * JobCalendar Component
 * Displays scheduled jobs in a calendar view with detailed list for selected date
 * Optimized for space efficiency and better layout
 */
const JobCalendar = ({ region, onSelectDate }) => {
  // State management
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [jobs, setJobs] = useState([]);
  const [selectedDateJobs, setSelectedDateJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarView, setCalendarView] = useState('month');
  
  const navigate = useNavigate();
  const localizer = momentLocalizer(moment);
  
  /**
   * Format date to consistent string format for comparison
   * @param {Date} date - The date to format
   * @returns {string} Formatted date string (YYYY-MM-DD)
   */
  const formatDateKey = (date) => {
    return moment(date).format('YYYY-MM-DD');
  };
  
  /**
   * Load jobs from the API with filtering options
   */
  const loadScheduledJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { status: 'scheduled' };
      if (region && region !== 'ALL') {
        params.region = region;
      }
      
      const fetchedJobs = await getJobs(params);
      
      // Transform jobs into events for the calendar
      const jobEvents = fetchedJobs.map(job => {
        // Create a date object from scheduled_date
        const jobDate = new Date(job.scheduled_date);
        
        // Create an end date (default to 1 hour after start)
        const endDate = new Date(jobDate);
        endDate.setHours(endDate.getHours() + 1);
        
        return {
          id: job.id,
          title: `${job.job_number}: ${job.customer_name}`, // More concise title
          start: jobDate,
          end: endDate,
          resource: job // Store the original job data
        };
      });
      
      setJobs(jobEvents);
      
      // Update selected date jobs
      updateSelectedDateJobs(calendarDate, jobEvents);
    } catch (error) {
      console.error('Error loading scheduled jobs:', error);
    } finally {
      setLoading(false);
    }
  }, [region, calendarDate]);
  
  // Load jobs when region changes
  useEffect(() => {
    loadScheduledJobs();
  }, [region, loadScheduledJobs]);
  
  /**
   * Update the selected date jobs whenever date or jobs change
   * @param {Date} date - The selected date
   * @param {Array} jobsList - List of jobs to filter (defaults to current jobs state)
   */
  const updateSelectedDateJobs = (date, jobsList = jobs) => {
    const dateStr = formatDateKey(date);
    const filtered = jobsList.filter(job => formatDateKey(job.start) === dateStr)
      .map(job => job.resource);
    
    setSelectedDateJobs(filtered);
  };
  
  /**
   * Handle date selection in the calendar
   * @param {Object} slotInfo - Information about the selected slot
   */
  const handleSelectSlot = ({ start }) => {
    setCalendarDate(start);
    updateSelectedDateJobs(start);
    
    if (onSelectDate) {
      onSelectDate(start);
    }
  };
  
  /**
   * Handle clicking on a job in the calendar
   * @param {Object} event - The calendar event that was clicked
   */
  const handleSelectEvent = (event) => {
    navigate(`/jobs/${event.id}`);
  };
  
  /**
   * Format the displayed date in header
   * @param {Date} date - The date to format
   * @returns {string} Formatted date string
   */
  const formatDisplayDate = (date) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };
  
  /**
   * Custom toolbar component for the calendar
   */
  const CustomToolbar = (toolbar) => {
    const goToBack = () => {
      toolbar.onNavigate('PREV');
    };
    
    const goToNext = () => {
      toolbar.onNavigate('NEXT');
    };
    
    const goToToday = () => {
      toolbar.onNavigate('TODAY');
    };
    
    const viewLabels = {
      month: 'Month',
      week: 'Week',
      day: 'Day',
      agenda: 'List'
    };
    
    return (
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div>
          <Button variant="outline-secondary" size="sm" onClick={goToBack}>
            &lt;
          </Button>
          <Button variant="outline-primary" size="sm" onClick={goToToday} className="mx-2">
            Today
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={goToNext}>
            &gt;
          </Button>
          <span className="ms-2 fw-bold">{toolbar.label}</span>
        </div>
        
        <div className="btn-group">
          {Object.keys(viewLabels).map(view => (
            <Button
              key={view}
              variant={toolbar.view === view ? "primary" : "outline-secondary"}
              size="sm"
              onClick={() => {
                toolbar.onView(view);
                setCalendarView(view);
              }}
            >
              {viewLabels[view]}
            </Button>
          ))}
        </div>
      </div>
    );
  };
  
  /**
   * Styling for the job events in the calendar
   * @returns {Object} Style object for events
   */
  const eventStyleGetter = () => {
    return {
      style: {
        backgroundColor: '#007bff',
        borderRadius: '4px',
        color: '#fff',
        border: 'none',
        display: 'block',
        fontSize: '0.85rem', // Smaller font for better fit
        padding: '2px 4px'
      }
    };
  };
  
  /**
   * Custom day cell component for month view
   * Shows the date number and optional indicator for jobs count
   */
  const DayCellWrapper = ({ value, children }) => {
    const dateStr = formatDateKey(value);
    const jobsForDate = jobs.filter(job => formatDateKey(job.start) === dateStr);
    const hasJobs = jobsForDate.length > 0;
    
    return (
      <div className="position-relative h-100">
        <div className="position-absolute" style={{ right: '5px', top: '2px' }}>
          {value.getDate()}
        </div>
        {children}
        {hasJobs && (
          <div 
            className="position-absolute"
            style={{ 
              bottom: '2px', 
              right: '5px',
              backgroundColor: '#007bff',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'white'
            }}
          >
            {jobsForDate.length}
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Component to display job status with appropriate styling
   */
  const JobStatusBadge = ({ status }) => {
    let variant = 'primary';
    
    switch (status?.toLowerCase()) {
      case 'completed':
        variant = 'success';
        break;
      case 'in_progress':
        variant = 'warning';
        break;
      case 'cancelled':
        variant = 'danger';
        break;
      default:
        variant = 'primary';
    }
    
    return (
      <Badge bg={variant} className="me-2">
        {status ? status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1) : 'Scheduled'}
      </Badge>
    );
  };
  
  if (loading && jobs.length === 0) {
    return (
      <div className="text-center p-3">
        <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span>Loading calendar...</span>
      </div>
    );
  }
  
  return (
    <div className={`job-calendar-container ${calendarView !== 'month' ? 'single-column' : ''}`}>
      <div className="calendar-section">
        <h3 className="calendar-title text-center mb-3">Job Schedule</h3>
        <Card className="shadow-sm">
          <Card.Body className="p-3">
            <Calendar 
              localizer={localizer}
              events={jobs}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 650 }}
              defaultView="month"
              views={['month', 'week', 'day', 'agenda']}
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              components={{
                toolbar: CustomToolbar,
                dateCellWrapper: DayCellWrapper
              }}
              onNavigate={date => {
                setCalendarDate(date);
                updateSelectedDateJobs(date);
              }}
              onView={view => setCalendarView(view)}
              popup
              tooltipAccessor={event => event.title}
            />
          </Card.Body>
        </Card>
      </div>

      {calendarView === 'month' && (
        <div className="date-details-section">
          <Card className="date-details">
            <Card.Header className="py-2">
              <h5 className="mb-0">{formatDisplayDate(calendarDate)}</h5>
            </Card.Header>
            <Card.Body className="p-0">
              {selectedDateJobs.length === 0 ? (
                <p className="text-muted p-3 mb-0">No jobs scheduled for this date.</p>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                    <h6 className="mb-0">{selectedDateJobs.length} Jobs Scheduled</h6>
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={() => loadScheduledJobs()}
                    >
                      Refresh
                    </Button>
                  </div>
                  <ListGroup variant="flush">
                    {selectedDateJobs.map(job => (
                      <ListGroup.Item 
                        key={job.id}
                        className="scheduled-job-item"
                        action
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        <div className="job-info">
                          <div className="job-name">
                            <span className="job-number">{job.job_number}</span>
                            <span>{job.customer_name}</span>
                            {job.status && <JobStatusBadge status={job.status} />}
                          </div>
                          <div className="job-address">
                            {job.address || 'No address'} 
                            {job.region && (
                              <span className="ms-2 badge bg-light text-dark">
                                {job.region}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="job-actions">
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                          >
                            View
                          </Button>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </>
              )}
              
              {onSelectDate && (
                <div className="p-3 border-top">
                  <Button 
                    variant="success"
                    size="sm"
                    className="w-100"
                    onClick={() => onSelectDate(calendarDate)}
                  >
                    Schedule Job for This Date
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
      )}
    </div>
  );
};

export default JobCalendar;