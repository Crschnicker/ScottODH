import api from './api';

// Get scheduled jobs for a date range
export const getScheduledJobs = async (startDate, endDate, region = null) => {
  try {
    const params = {
      start_date: startDate,
      end_date: endDate,
      status: 'scheduled'
    };
    
    if (region) {
      params.region = region;
    }
    
    const response = await api.get('/jobs', { params });
    return response.data;
  } catch (error) {
    console.error('Error getting scheduled jobs:', error);
    throw error;
  }
};

// Get jobs scheduled for a specific date
export const getJobsForDate = async (date, region = null) => {
  try {
    // Format date to YYYY-MM-DD
    const formattedDate = date instanceof Date 
      ? date.toISOString().split('T')[0]
      : date;
    
    const params = {
      scheduled_date: formattedDate,
      status: 'scheduled'
    };
    
    if (region) {
      params.region = region;
    }
    
    const response = await api.get('/jobs', { params });
    return response.data;
  } catch (error) {
    console.error(`Error getting jobs for date ${date}:`, error);
    throw error;
  }
};
