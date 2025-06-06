import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { Card, Button, Badge, ListGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getJobs } from '../../services/jobService';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css';

/**
 * JobCalendar Component
 * Displays scheduled jobs in a calendar view with detailed list for selected date
 * Optimized layout to match EstimateCalendar's space efficiency
 */
const JobCalendar = ({ region, onSelectDate }) => {
  // State management
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [jobs, setJobs] = useState([]);
  const [selectedDateJobs, setSelectedDateJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calendarView, setCalendarView] = useState('month');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
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
   * Format time for display
   * @param {Date} date - The date to format
   * @returns {string} Formatted time string (h:mm A)
   */
  const formatTime = (date) => {
    return moment(date).format('h:mm A');
  };
  
  const loadScheduledJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { status: 'scheduled' };
      if (region && region !== 'ALL') {
        params.region = region;
      }
      
      const fetchedJobs = await getJobs(params);
      
      // --- REVISED LOGIC: Filter and Map in one pass using reduce ---
      const jobEvents = fetchedJobs.reduce((events, job) => {
        // 1. First, check if a scheduled_date even exists and is not an empty string.
        if (!job.scheduled_date) {
          // This job is unscheduled, so we simply skip it.
          return events; // Return the accumulator unchanged.
        }

        // 2. Now, attempt to parse the date and move it to noon to avoid timezone issues.
        const startMoment = moment(job.scheduled_date, ['YYYY-MM-DD', 'MM/DD/YYYY'])
                              .startOf('day')
                              .add(12, 'hours');

        // 3. Check if the parsed date is valid.
        if (startMoment.isValid()) {
          // If valid, create the event object and add it to our array.
          const startDate = startMoment.toDate();
          const endDate = moment(startMoment).add(1, 'hour').toDate();

          events.push({
            id: job.id,
            title: `${job.job_number}: ${job.customer_name}`,
            start: startDate,
            end: endDate,
            resource: job
          });
        } else {
          // The date string was present but malformed. Log it for debugging and skip it.
          console.warn(
            `Skipping job due to malformed scheduled_date: '${job.scheduled_date}'`,
            job
          );
        }

        // Return the accumulator for the next iteration.
        return events;
      }, []); // The initial value of our accumulator is an empty array [].
      
      setJobs(jobEvents);
      
      // Update the sidebar list with the correctly filtered and formed events
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
   * Filter jobs displayed in the sidebar based on search text and status
   * @returns {Array} Filtered jobs
   */
  const getFilteredJobs = () => {
    if (!searchText && statusFilter === 'all') return selectedDateJobs;
    
    return selectedDateJobs.filter(job => {
      const matchesSearch = !searchText || 
        job.job_number?.toLowerCase().includes(searchText.toLowerCase()) ||
        job.customer_name?.toLowerCase().includes(searchText.toLowerCase()) ||
        job.address?.toLowerCase().includes(searchText.toLowerCase());
        
      const matchesStatus = statusFilter === 'all' || 
        job.status?.toLowerCase() === statusFilter.toLowerCase();
        
      return matchesSearch && matchesStatus;
    });
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
          {/* CORRECTED SYNTAX */}
          <Button variant="outline-secondary" size="sm" onClick={goToBack}>{'<'}</Button>
          <Button variant="outline-primary" size="sm" onClick={goToToday} className="mx-2">Today</Button>
          {/* CORRECTED SYNTAX */}
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
      <Badge bg={variant} className="me-2">
        {status ? status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1) : 'Scheduled'}
      </Badge>
    );
  };
  
  /**
   * HourlyTimeline component to display jobs in a timeline view
   */
  const HourlyTimeline = () => {
    const startHour = 6; 
    const endHour = 17;  
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
    
    const calculateJobPosition = (job) => {
      const jobHour = 9; 
      const jobDuration = 2;
      const totalTimelineSpanHours = endHour - startHour;
      const topPosition = ((jobHour - startHour) / totalTimelineSpanHours) * 100;
      const heightPercentage = (jobDuration / totalTimelineSpanHours) * 100;
      
      return {
        top: `${Math.max(0, topPosition)}%`, 
        height: `${Math.max(0, heightPercentage)}%`,
      };
    };
    
    const getJobColor = (job) => {
      switch (job.status?.toLowerCase()) {
        case 'completed': return '#28a745';
        case 'in_progress': return '#ffc107';
        case 'cancelled': return '#dc3545';
        default: return '#007bff';
      }
    };
    
    return (
      <div className="hourly-timeline p-3">
        <h6 className="mb-3">Day Schedule</h6>
        <div className="timeline-container" style={{ position: 'relative', height: '480px', overflow: 'hidden' }}>
          {hours.map((hour) => (
            <div 
              key={hour} 
              className="hour-row d-flex align-items-center" 
              style={{ 
                position: 'absolute', 
                width: '100%', 
                height: `${100 / hours.length}%`, 
                top: `${((hour - startHour) / hours.length) * 100}%`,
                borderBottom: (hour < endHour) ? '1px solid #e9ecef' : 'none',
              }}
            >
              <div className="hour-label" style={{ width: '50px', fontSize: '0.8rem', color: '#6c757d', paddingRight: '5px' }}>
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </div>
            </div>
          ))}
          
          {selectedDateJobs.map((job) => {
            const positionStyle = calculateJobPosition(job);
            
            return (
              <div
                key={job.id}
                className="job-block position-absolute rounded shadow-sm p-1"
                style={{
                  left: '60px', 
                  right: '10px', 
                  ...positionStyle,
                  backgroundColor: getJobColor(job),
                  color: job.status === 'in_progress' ? '#212529' : '#fff', 
                  cursor: 'pointer',
                  zIndex: 10,
                  overflow: 'hidden',
                  fontSize: '0.8rem', 
                }}
                onClick={() => navigate(`/jobs/${job.id}`)}
                title={`${job.customer_name}\nJob #: ${job.job_number}\nStatus: ${job.status || 'Scheduled'}`}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.job_number}
                  </div>
                  <JobStatusBadge status={job.status} />
                </div>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {job.customer_name}
                </div>
                <div style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {job.address && job.address.split(',')[0]}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
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
    <div className={`job-calendar-container ${calendarView !== 'month' ? 'single-column' : ''}`}>
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
                `${event.resource?.customer_name}\n` +
                `Status: ${event.resource?.status || 'Scheduled'}`
              }
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
              {(() => {
                if (selectedDateJobs.length === 0) {
                  return <p className="text-muted p-3 mb-0">No jobs scheduled for this date.</p>;
                }
                
                return (
                  <>
                    <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                      <h6 className="mb-0">{selectedDateJobs.length} Job{selectedDateJobs.length === 1 ? '' : 's'} Scheduled</h6>
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => loadScheduledJobs()}
                      >
                        Refresh
                      </Button>
                    </div>
                    
                    <HourlyTimeline />
                    
                    <div className="p-3 border-top">
                      <h6 className="mb-2">Job Details</h6>
                      <ListGroup variant="flush">
                        {getFilteredJobs().map(job => (
                          <ListGroup.Item 
                            key={job.id}
                            className="px-0 py-2 border-bottom"
                            action
                            onClick={() => navigate(`/jobs/${job.id}`)}
                          >
                            <div className="d-flex justify-content-between align-items-start">
                              <div className="job-info">
                                <div className="d-flex align-items-center mb-1">
                                  <span className="job-number me-2">{job.job_number}</span>
                                  <JobStatusBadge status={job.status} />
                                </div>
                                <div className="customer-name mb-1">
                                  {job.customer_name}
                                </div>
                                <div className="job-address text-muted small">
                                  {job.address || 'No address'}
                                  {job.region && <span className="ms-2 badge bg-light text-dark">{job.region}</span>}
                                </div>
                              </div>
                            </div>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    </div>
                  </>
                );
              })()}
              
              {onSelectDate && (
                <div className="p-3 border-top">
                  <Button 
                    variant="success"
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