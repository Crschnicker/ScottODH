import React, { useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

/**
 * A focused calendar view for scheduling modals.
 * Displays existing appointments to help avoid conflicts.
 *
 * @param {Array} estimates - All estimates to display as events.
 * @param {Function} onSelectSlot - Callback that fires when a time slot is clicked.
 */
const SchedulingCalendarView = ({ estimates = [], onSelectSlot }) => {
  // Memoize the events to prevent re-computation on every render
  const events = useMemo(() => {
    return estimates
      .filter(est => est.scheduled_date) // We only care about scheduled estimates
      .map(estimate => {
        const startDate = new Date(estimate.scheduled_date);
        // Calculate end time based on duration
        const endDate = new Date(startDate.getTime() + (estimate.duration || 60) * 60000);
        
        return {
          id: estimate.id,
          title: `EST-${estimate.id}: ${estimate.customer_name}`,
          start: startDate,
          end: endDate,
          resource: estimate,
        };
      });
  }, [estimates]);

  const eventStyleGetter = (event) => {
    // A simple style for all events in the scheduling view
    return {
      style: {
        backgroundColor: '#546E7A', // A neutral blue-gray color
        borderRadius: '4px',
        color: '#fff',
        border: 'none',
        display: 'block',
      }
    };
  };

  return (
    <div style={{ height: '65vh' }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        views={['week', 'day']}
        defaultView="week"
        selectable
        onSelectSlot={onSelectSlot}
        step={30}
        timeslots={2}
        scrollToTime={new Date(1970, 1, 1, 8)} // Default scroll to 8 AM
        eventPropGetter={eventStyleGetter}
        popup // Allows seeing overlapping events better
      />
    </div>
  );
};

export default SchedulingCalendarView;