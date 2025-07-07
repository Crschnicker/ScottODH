import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { Card, Button, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getJobs } from '../../services/jobService';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css';

/**
 * JobCalendar Component
 * Displays scheduled jobs in a calendar view with enhanced sidebar for selected date
 */
const JobCalendar = ({ region, onSelectDate }) => {
  // State management
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [jobs, setJobs] = useState([]);
  const [selectedDateJobs, setSelectedDateJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
   * Get display name for customer, handling empty/temp values
   * @param {Object} job - Job object
   * @returns {string} Formatted customer name
   */
  const getDisplayCustomerName = (job) => {
    if (!job.customer_name || job.customer_name.toLowerCase() === 'temp' || job.customer_name.trim() === '') {
      return `Customer #${job.job_number || 'Unknown'}`;
    }
    return job.customer_name;
  };
  
  /**
   * Get display address for job, handling empty values
   * @param {Object} job - Job object
   * @returns {string} Formatted address or fallback
   */
  const getDisplayAddress = (job) => {
    if (!job.address || job.address.trim() === '') {
      return 'Address not specified';
    }
    // Get first line of address for cleaner display
    const addressParts = job.address.split(',');
    return addressParts[0].trim();
  };
  
  const loadScheduledJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { status: 'scheduled' };
      if (region && region !== 'ALL') {
        params.region = region;
      }
      
      const fetchedJobs = await getJobs(params);
      
      // Filter and Map in one pass using reduce
      const jobEvents = fetchedJobs.reduce((events, job) => {
        // First, check if a scheduled_date even exists and is not an empty string
        if (!job.scheduled_date) {
          return events;
        }

        // Attempt to parse the date and move it to noon to avoid timezone issues
        const startMoment = moment(job.scheduled_date, ['YYYY-MM-DD', 'MM/DD/YYYY'])
                              .startOf('day')
                              .add(12, 'hours');

        // Check if the parsed date is valid
        if (startMoment.isValid()) {
          const startDate = startMoment.toDate();
          const endDate = moment(startMoment).add(1, 'hour').toDate();

          events.push({
            id: job.id,
            title: `${job.job_number}: ${getDisplayCustomerName(job)}`,
            start: startDate,
            end: endDate,
            resource: job
          });
        } else {
          console.warn(
            `Skipping job due to malformed scheduled_date: '${job.scheduled_date}'`,
            job
          );
        }

        return events;
      }, []);
      
      setJobs(jobEvents);
      updateSelectedDateJobs(calendarDate, jobEvents);
    } catch (error) {
      console.error('Error loading scheduled jobs:', error);
      setError('Failed to load jobs. Please try again later.');
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
    const filtered = jobsList.filter(job => {
      const jobDateStr = formatDateKey(job.start);
      return jobDateStr === dateStr;
    }).map(job => job.resource);
    
    setSelectedDateJobs(filtered);
  };
  
  /**
   * Handle date selection in the calendar
   * @param {Object} slotInfo - Information about the selected slot
   */
  const handleSelectSlot = ({ start }) => {
    const selectedDate = new Date(start);
    selectedDate.setHours(12, 0, 0, 0);
    
    setCalendarDate(selectedDate);
    updateSelectedDateJobs(selectedDate);
    
    if (onSelectDate) {
      onSelectDate(selectedDate);
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
    if (!date) return '';
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };
  
  /**
   * Custom toolbar component for the calendar
   */
  const CustomToolbar = (toolbar) => {
    const goToBack = () => toolbar.onNavigate('PREV');
    const goToNext = () => toolbar.onNavigate('NEXT');
    const goToToday = () => toolbar.onNavigate('TODAY');
    
    const viewLabels = { month: 'Month', week: 'Week', day: 'Day', agenda: 'List' };
    
    return (
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div>
          <Button variant="outline-secondary" size="sm" onClick={goToBack}>{'<'}</Button>
          <Button variant="outline-primary" size="sm" onClick={goToToday} className="mx-2">Today</Button>
          <Button variant="outline-secondary" size="sm" onClick={goToNext}>{'>'}</Button>
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
   * Custom styling for calendar events
   */
  const eventStyleGetter = (event) => {
    const status = event.resource?.status?.toLowerCase() || 'scheduled';
    
    let backgroundColor = '#007bff';
    
    switch (status) {
      case 'completed': backgroundColor = '#28a745'; break;
      case 'in_progress': backgroundColor = '#ffc107'; break;
      case 'cancelled': backgroundColor = '#dc3545'; break;
      default: backgroundColor = '#007bff';
    }
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        color: status === 'in_progress' ? '#212529' : '#fff',
        border: 'none',
        display: 'block',
        fontSize: '0.85rem',
        padding: '2px 4px'
      }
    };
  };
  
  /**
   * Custom day cell component for month view
   */
  const DateCellWrapper = ({ value }) => {
    const date = value;
    const dateStr = formatDateKey(date);
    const jobsForDate = jobs.filter(job => formatDateKey(job.start) === dateStr);
    
    return (
      <div className="position-relative h-100">
        <div className="position-absolute" style={{ right: '5px', top: '2px' }}>{date.getDate()}</div>
        {jobsForDate.length > 0 && (
          <div 
            className="position-absolute" 
            style={{ 
              bottom: '2px', right: '5px',
              backgroundColor: '#007bff',
              borderRadius: '50%', width: '18px', height: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', color: '#fff'
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
      case 'completed': variant = 'success'; break;
      case 'in_progress': variant = 'warning'; break;
      case 'cancelled': variant = 'danger'; break;
      default: variant = 'primary';
    }
    
    return (
      <Badge bg={variant} className="status-badge">
        {status ? status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1) : 'Scheduled'}
      </Badge>
    );
  };
  
  /**
   * Enhanced empty state component
   */
  const EmptyJobsState = () => (
    <div className="empty-jobs-state">
      <span className="empty-jobs-icon">📅</span>
      <div className="empty-jobs-text">No jobs scheduled</div>
      <div className="empty-jobs-subtext">Select a different date or schedule a new job</div>
    </div>
  );
  
  if (loading && jobs.length === 0) {
    return (
      <div className="text-center p-3">
        <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span>Loading jobs...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
        <Button variant="outline-danger" size="sm" className="ms-2" onClick={() => loadScheduledJobs()}>Retry</Button>
      </div>
    );
  }
  
  return (
    <div className="job-calendar-container">
      <div className="calendar-section">
        <h3 className="calendar-title mb-3 text-center">Job Schedule</h3>
        <Card className="shadow-sm mb-0">
          <Card.Body className="p-3">
            <Calendar
              localizer={localizer}
              events={jobs}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              defaultView="month"
              views={['month', 'week', 'day', 'agenda']}
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              components={{
                toolbar: CustomToolbar,
                dateCellWrapper: DateCellWrapper
              }}
              onNavigate={date => {
                setCalendarDate(date);
                updateSelectedDateJobs(date, jobs);
              }}
              onView={view => setCalendarView(view)}
              popup
              tooltipAccessor={event => 
                `${event.resource?.job_number}\n` +
                `${getDisplayCustomerName(event.resource)}\n` +
                `Status: ${event.resource?.status || 'Scheduled'}`
              }
            />
          </Card.Body>
        </Card>
      </div>

      <div className="jobs-sidebar">
        <Card className="shadow-sm">
          <Card.Header className="py-3">
            <h6 className="mb-1 fw-bold">{formatDisplayDate(calendarDate)}</h6>
            <small>
              {selectedDateJobs.length} job{selectedDateJobs.length === 1 ? '' : 's'} scheduled
            </small>
          </Card.Header>
          <Card.Body className="p-0">
            {selectedDateJobs.length === 0 ? (
              <EmptyJobsState />
            ) : (
              <div className="jobs-list">
                {selectedDateJobs.map(job => (
                  <div 
                    key={job.id}
                    className="job-item cursor-pointer"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <div className="job-info">
                      <div className="job-header">
                        <div className="job-number">{job.job_number}</div>
                        <JobStatusBadge status={job.status} />
                      </div>
                      <div className="customer-name">{getDisplayCustomerName(job)}</div>
                      <div className="job-address">
                        {getDisplayAddress(job)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {onSelectDate && (
              <div className="schedule-button-container">
                <Button 
                  variant="success"
                  size="sm"
                  className="w-100"
                  onClick={() => onSelectDate(calendarDate)}
                >
                  📅 Schedule New Job
                </Button>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
};

export default JobCalendar;