import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { Card, Button, Badge } from 'react-bootstrap'; // Removed ListGroup as it's not directly used for list items anymore
import { FaClock, FaUser } from 'react-icons/fa'; // Removed unused icons for now
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css'; // Assuming this file exists and has relevant styles

/**
 * EstimateCalendar Component
 * Displays estimates in a calendar view and shows details for selected date
 * Optimized for space efficiency and better visual presentation
 */
const EstimateCalendar = () => {
  // State management
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [estimates, setEstimates] = useState([]);
  const [selectedDateEstimates, setSelectedDateEstimates] = useState([]);
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
   * Format time for display
   * @param {Date} date - The date to format
   * @returns {string} Formatted time string (h:mm A)
   */
  const formatTime = (date) => {
    return moment(date).format('h:mm A');
  };
  
  /**
   * Fetch estimates from API
   * Handles data transformation for calendar display
   */
  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    try {
      // Replace with your actual API endpoint
      const response = await fetch('/api/estimates'); // Ensure this API endpoint is correct
      
      if (!response.ok) {
        throw new Error('Failed to fetch estimates');
      }
      
      const data = await response.json();
      
      const formattedEstimates = data.map(estimate => {
        let startDate, endDate;
        
        if (estimate.scheduled_date) {
          startDate = new Date(estimate.scheduled_date);
          endDate = new Date(startDate);
          endDate.setMinutes(endDate.getMinutes() + (estimate.duration || 60));
        } else {
          startDate = new Date(estimate.created_at);
          endDate = new Date(startDate);
          endDate.setHours(endDate.getHours() + 1); 
        }
        
        const estimatorName = estimate.estimator_name || 'Brett';
        
        return {
          id: estimate.id,
          title: `${estimate.customer_name}: ${estimatorName}`,
          customer_name: estimate.customer_name,
          site_address: estimate.site_address,
          site_name: estimate.site_name || '',
          estimated_value: estimate.estimated_cost || 0,
          start: startDate,
          end: endDate,
          status: estimate.status,
          rawEstimate: estimate,
          estimator_name: estimatorName,
          isScheduled: Boolean(estimate.scheduled_date),
          duration: estimate.duration || 60
        };
      });
      
      setEstimates(formattedEstimates);
      updateSelectedDateEstimates(calendarDate, formattedEstimates);
    } catch (err) {
      console.error('Error fetching estimates:', err);
      setError('Failed to load estimates. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [calendarDate]); 
  
  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);
  
  const updateSelectedDateEstimates = (date, estimatesList = estimates) => {
    const dateStr = formatDateKey(date);
    const filtered = estimatesList.filter(estimate => 
      formatDateKey(estimate.start) === dateStr
    );
    
    filtered.sort((a, b) => a.start - b.start);
    setSelectedDateEstimates(filtered);
  };
  
  const handleSelectSlot = ({ start }) => {
    setCalendarDate(start);
    updateSelectedDateEstimates(start, estimates);
  };
  
  const handleSelectEvent = (event) => {
    navigate(`/estimates/${event.id}/progress`);
  };
  
  const formatDisplayDate = (date) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };
  
  // eslint-disable-next-line no-unused-vars
  const handleMapRedirect = (address, e) => {
    e.stopPropagation(); 
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      window.open(`https://maps.google.com/?q=${encodedAddress}`, '_blank');
    }
  };
  
  const eventStyleGetter = (event) => {
    let backgroundColor = '#3174ad'; 
    
    if (event.isScheduled) {
      switch (event.status) {
        case 'approved': backgroundColor = '#28a745'; break;
        case 'declined': case 'rejected': backgroundColor = '#dc3545'; break;
        case 'pending': backgroundColor = '#ffc107'; break;
        case 'converted': backgroundColor = '#17a2b8'; break;
        default: backgroundColor = '#6f42c1';
      }
    } else {
      switch (event.status) {
        case 'approved': backgroundColor = '#8fd19e'; break;
        case 'declined': case 'rejected': backgroundColor = '#f1aeb5'; break;
        case 'pending': backgroundColor = '#ffe083'; break;
        case 'converted': backgroundColor = '#9fcdff'; break;
        default: backgroundColor = '#d2d2d2';
      }
    }
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        color: event.status === 'pending' && event.isScheduled ? '#212529' : '#fff',
        border: 'none',
        display: 'block',
        fontSize: '0.85rem',
        padding: '2px 4px'
      }
    };
  };
  
  const CustomToolbar = (toolbar) => {
    const goToBack = () => toolbar.onNavigate('PREV');
    const goToNext = () => toolbar.onNavigate('NEXT');
    const goToToday = () => toolbar.onNavigate('TODAY');
    
    const viewLabels = { month: 'Month', week: 'Week', day: 'Day', agenda: 'List' };
    
    return (
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div>
          <Button variant="outline-secondary" size="sm" onClick={goToBack}></Button>
          <Button variant="outline-primary" size="sm" onClick={goToToday} className="mx-2">Today</Button>
          <Button variant="outline-secondary" size="sm" onClick={goToNext}></Button>
          <span className="ms-2 fw-bold">{toolbar.label}</span>
        </div>
        <div>
          <Button variant="success" size="sm" onClick={() => navigate('/estimates')}>New Estimate</Button>
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
  
  const DateCellWrapper = ({ value }) => {
    const date = value;
    const dateStr = formatDateKey(date);
    const estimatesForDate = estimates.filter(estimate => formatDateKey(estimate.start) === dateStr);
    const scheduledEstimates = estimatesForDate.filter(est => est.isScheduled);
    
    return (
      <div className="position-relative h-100">
        <div className="position-absolute" style={{ right: '5px', top: '2px' }}>{date.getDate()}</div>
        {estimatesForDate.length > 0 && (
          <div 
            className="position-absolute" 
            style={{ 
              bottom: '2px', right: '5px',
              backgroundColor: scheduledEstimates.length > 0 ? '#6f42c1' : '#ffc107',
              borderRadius: '50%', width: '18px', height: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', color: scheduledEstimates.length > 0 ? '#fff' : '#212529'
            }}
          >
            {estimatesForDate.length}
          </div>
        )}
      </div>
    );
  };
  
  // eslint-disable-next-line no-unused-vars
  const StatusBadge = ({ status }) => {
    let variant = 'warning';
    switch (status) {
      case 'approved': variant = 'success'; break;
      case 'declined': case 'rejected': variant = 'danger'; break;
      case 'pending': variant = 'warning'; break;
      case 'converted': variant = 'info'; break;
      default: variant = 'secondary';
    }
    return <Badge bg={variant} className="me-2">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };
  
  const HourlyTimeline = () => {
    const startHour = 6; 
    const endHour = 17;  
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
    
    const calculateEstimatePosition = (estimate) => {
      const estimateStart = new Date(estimate.start);
      const estimateEnd = new Date(estimate.end);
      
      const startHourOfDay = estimateStart.getHours() + estimateStart.getMinutes() / 60;
      const endHourOfDay = estimateEnd.getHours() + estimateEnd.getMinutes() / 60;
      
      const totalTimelineSpanHours = endHour - startHour; 
      
      const topPosition = ((startHourOfDay - startHour) / totalTimelineSpanHours) * 100;
      const durationHours = endHourOfDay - startHourOfDay;
      const heightPercentage = (durationHours / totalTimelineSpanHours) * 100;
      
      return {
        top: `${Math.max(0, topPosition)}%`, 
        height: `${Math.max(0, heightPercentage)}%`,
      };
    };
    
    const getEstimateColor = (estimate) => {
      switch (estimate.status) {
        case 'approved': return '#28a745';
        case 'declined': case 'rejected': return '#dc3545';
        case 'pending': return '#ffc107';
        case 'converted': return '#17a2b8';
        default: return '#6f42c1';
      }
    };
    
    const scheduledEstimatesOnDate = selectedDateEstimates.filter(estimate => estimate.isScheduled);

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
                borderBottom: (hour < endHour) ? '1px solid #e9ecef' : 'none', // Add border to all but last
              }}
            >
              <div className="hour-label" style={{ width: '50px', fontSize: '0.8rem', color: '#6c757d', paddingRight: '5px' }}>
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </div>
              {/* Line removed from here, border applied to hour-row */}
            </div>
          ))}
          
          {scheduledEstimatesOnDate.map((estimate) => {
              const positionStyle = calculateEstimatePosition(estimate);
              if (parseFloat(positionStyle.height) <= 0) return null;

              return (
                <div
                  key={estimate.id}
                  className="estimate-block position-absolute rounded shadow-sm p-1"
                  style={{
                    left: '60px', 
                    right: '10px', 
                    ...positionStyle,
                    backgroundColor: getEstimateColor(estimate),
                    color: estimate.status === 'pending' ? '#212529' : '#fff', 
                    cursor: 'pointer',
                    zIndex: 10,
                    overflow: 'hidden',
                    fontSize: '0.8rem', 
                  }}
                  onClick={() => navigate(`/estimates/${estimate.id}/progress`)}
                  title={`${estimate.customer_name}\n${formatTime(estimate.start)} - ${formatTime(estimate.end)}\nEstimator: ${estimate.estimator_name}`}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {estimate.customer_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', flexShrink: 0, marginLeft: '4px' }}>
                      {formatTime(estimate.start)} - {formatTime(estimate.end)}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <FaUser size={10} className="me-1" />{estimate.estimator_name} 
                    {estimate.site_name && ` • ${estimate.site_name}`}
                    {!estimate.site_name && estimate.site_address && ` • ${estimate.site_address.split(',')[0]}`}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  };
  
  if (loading && estimates.length === 0) {
    return (
      <div className="text-center p-3">
        <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span>Loading estimates...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
        <Button variant="outline-danger" size="sm" className="ms-2" onClick={() => fetchEstimates()}>Retry</Button>
      </div>
    );
  }
  
  return (
    <div className={`job-calendar-container ${calendarView !== 'month' ? 'single-column' : ''}`}>
      <div className="calendar-section">
        <h3 className="calendar-title mb-3 text-center">Estimate Schedule</h3>
        <Card className="shadow-sm mb-0">
          <Card.Body className="p-3">
            <Calendar
              localizer={localizer}
              events={estimates}
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
                updateSelectedDateEstimates(date, estimates);
              }}
              onView={view => setCalendarView(view)}
              popup
              tooltipAccessor={event => 
                `${event.customer_name}\n` +
                `${event.isScheduled ? 'Scheduled: ' + formatTime(event.start) : 'Created: ' + formatDate(event.start)}\n` +
                `Estimator: ${event.estimator_name}\n` +
                `${event.estimated_value ? 'Value: $' + parseFloat(event.estimated_value).toLocaleString() : ''}`
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
                const scheduledForDisplay = selectedDateEstimates.filter(e => e.isScheduled);
                if (scheduledForDisplay.length === 0) {
                  return <p className="text-muted p-3 mb-0">No estimates scheduled for this date.</p>;
                }
                return (
                  <>
                    <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                      <h6 className="mb-0">{scheduledForDisplay.length} Estimate{scheduledForDisplay.length === 1 ? '' : 's'} Scheduled</h6>
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => fetchEstimates()}
                      >
                        Refresh
                      </Button>
                    </div>
                    
                    <HourlyTimeline />
                  </>
                );
              })()}
              
              <div className="p-3 border-top" style={{minHeight: '20px'}}> 
              </div>
            </Card.Body>
          </Card>
        </div>
      )}
    </div>
  );
  
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  }
};

export default EstimateCalendar;