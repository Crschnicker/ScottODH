import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  MapPin, 
  User,
  Play,
  CheckCircle,
  AlertCircle,
  Loader,
  RefreshCw
} from 'lucide-react';

/**
 * Mobile Job Calendar Component
 * Allows mobile workers to view and select scheduled jobs by date
 */
const MobileJobCalendar = ({ user, onJobSelect }) => {
  // State management
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [calendarView, setCalendarView] = useState('month'); // 'month' or 'week'

  // Calendar navigation
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /**
   * Load jobs for the current month/view
   */
  const loadJobs = async (date = currentDate) => {
    setLoading(true);
    setError('');

    try {
      // Get start and end dates for the current view
      const startDate = getViewStartDate(date);
      const endDate = getViewEndDate(date);

      // Format dates for API call
      const startStr = formatDateForAPI(startDate);
      const endStr = formatDateForAPI(endDate);

      // Build query parameters
      const params = new URLSearchParams({
        start_date: startStr,
        end_date: endStr,
        include_unscheduled: 'false' // Only show scheduled jobs
      });

      const response = await fetch(`/api/jobs?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load scheduled jobs');
      }

      const data = await response.json();
      setJobs(data);
    } catch (err) {
      console.error('Error loading jobs:', err);
      setError('Failed to load scheduled jobs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get jobs for a specific date
   */
  const getJobsForDate = (date) => {
    const dateStr = formatDateForAPI(date);
    return jobs.filter(job => job.scheduled_date === dateStr);
  };

  /**
   * Format date for API calls (YYYY-MM-DD)
   */
  const formatDateForAPI = (date) => {
    return date.toISOString().split('T')[0];
  };

  /**
   * Get start date for current view
   */
  const getViewStartDate = (date) => {
    if (calendarView === 'month') {
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      // Go back to start of week
      start.setDate(start.getDate() - start.getDay());
      return start;
    } else {
      // Week view
      const start = new Date(date);
      start.setDate(date.getDate() - date.getDay());
      return start;
    }
  };

  /**
   * Get end date for current view
   */
  const getViewEndDate = (date) => {
    if (calendarView === 'month') {
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      // Go to end of week
      end.setDate(end.getDate() + (6 - end.getDay()));
      return end;
    } else {
      // Week view
      const end = new Date(date);
      end.setDate(date.getDate() + (6 - date.getDay()));
      return end;
    }
  };

  /**
   * Navigate calendar
   */
  const navigateCalendar = (direction) => {
    const newDate = new Date(currentDate);
    
    if (calendarView === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setDate(newDate.getDate() + (direction * 7));
    }
    
    setCurrentDate(newDate);
  };

  /**
   * Check if date is today
   */
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  /**
   * Check if date is selected
   */
  const isSelected = (date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  /**
   * Get status color for job
   */
  const getJobStatusColor = (job) => {
    switch (job.status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  /**
   * Get status icon for job
   */
  const getJobStatusIcon = (job) => {
    switch (job.status) {
      case 'scheduled': return <Clock className="w-4 h-4" />;
      case 'in_progress': return <Play className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  /**
   * Handle job selection
   */
  const handleJobSelect = (job) => {
    if (onJobSelect) {
      onJobSelect(job);
    } else {
      // Default behavior - navigate to job detail
      window.location.href = `/job/${job.id}`;
    }
  };

  /**
   * Render calendar grid for month view
   */
  const renderMonthView = () => {
    const startDate = getViewStartDate(currentDate);
    const weeks = [];
    
    // Generate 6 weeks to cover all possible month layouts
    for (let week = 0; week < 6; week++) {
      const days = [];
      
      for (let day = 0; day < 7; day++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + (week * 7) + day);
        
        const isCurrentMonth = date.getMonth() === currentDate.getMonth();
        const dayJobs = getJobsForDate(date);
        
        days.push(
          <div
            key={date.toISOString()}
            className={`min-h-20 p-1 border-r border-b cursor-pointer transition-colors ${
              isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-100'
            } ${isSelected(date) ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setSelectedDate(new Date(date))}
          >
            <div className={`text-sm font-medium mb-1 ${
              isToday(date) ? 'text-blue-600' : 
              isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
            }`}>
              {date.getDate()}
            </div>
            
            {dayJobs.length > 0 && (
              <div className="space-y-1">
                {dayJobs.slice(0, 2).map(job => (
                  <div
                    key={job.id}
                    className={`text-xs p-1 rounded border ${getJobStatusColor(job)} truncate`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJobSelect(job);
                    }}
                  >
                    #{job.job_number}
                  </div>
                ))}
                {dayJobs.length > 2 && (
                  <div className="text-xs text-gray-500">
                    +{dayJobs.length - 2} more
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }
      
      weeks.push(
        <div key={week} className="grid grid-cols-7">
          {days}
        </div>
      );
    }
    
    return weeks;
  };

  /**
   * Render selected date jobs
   */
  const renderSelectedDateJobs = () => {
    const dayJobs = getJobsForDate(selectedDate);
    
    if (dayJobs.length === 0) {
      return (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No jobs scheduled for this date</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {dayJobs.map(job => (
          <div
            key={job.id}
            className="bg-white rounded-lg shadow-sm border p-4 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all"
            onClick={() => handleJobSelect(job)}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Job #{job.job_number}</h3>
              <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getJobStatusColor(job)} flex items-center gap-1`}>
                {getJobStatusIcon(job)}
                {job.status.replace('_', ' ')}
              </div>
            </div>
            
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span>{job.customer_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span>{job.address}</span>
              </div>
              {job.job_scope && (
                <p className="text-gray-500 mt-2 line-clamp-2">{job.job_scope}</p>
              )}
            </div>
            
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Scheduled: {selectedDate.toLocaleDateString()}
              </span>
              <button className="text-blue-600 text-sm font-medium hover:text-blue-700">
                View Details →
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Load jobs when component mounts or date changes
  useEffect(() => {
    loadJobs();
  }, [currentDate, calendarView]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Job Schedule</h1>
          <button
            onClick={() => loadJobs()}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {/* Calendar Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateCalendar(-1)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-medium min-w-48 text-center">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => navigateCalendar(1)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setCalendarView('month')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                calendarView === 'month' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setCalendarView('week')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                calendarView === 'week' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="m-4 bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading schedule...</span>
        </div>
      )}

      {/* Calendar View */}
      {!loading && (
        <div className="flex flex-col lg:flex-row">
          {/* Calendar Grid */}
          <div className="flex-1">
            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-gray-50 border-b">
              {dayNames.map(day => (
                <div key={day} className="p-3 text-center text-sm font-medium text-gray-700 border-r">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Body */}
            <div className="border-l">
              {renderMonthView()}
            </div>
          </div>
          
          {/* Selected Date Jobs */}
          <div className="lg:w-80 bg-white border-l">
            <div className="p-4 border-b">
              <h3 className="font-semibold">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
            </div>
            <div className="p-4">
              {renderSelectedDateJobs()}
            </div>
          </div>
        </div>
      )}
      
      {/* Quick Actions */}
      <div className="fixed bottom-4 right-4">
        <button
          onClick={() => setSelectedDate(new Date())}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Calendar className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default MobileJobCalendar;