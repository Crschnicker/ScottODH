// Utility functions for date handling throughout the application

/**
 * Formats a Date object for HTML date inputs (YYYY-MM-DD)
 * 
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string in YYYY-MM-DD format
 */
export const formatDateForInput = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }
    
    const year = date.getFullYear();
    // Add leading zeros for month and day
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };
  
  /**
   * Formats a date string for display in the UI
   * 
   * @param {string|Date} date - The date to format (can be string or Date object)
   * @param {Object} options - Formatting options passed to toLocaleDateString
   * @returns {string} Formatted date string
   */
  export const formatDateForDisplay = (date, options = {}) => {
    if (!date) return 'N/A';
    
    // Default options for date formatting
    const defaultOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      ...options
    };
    
    // Handle both string dates and Date objects
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date provided to formatDateForDisplay:', date);
      return 'Invalid Date';
    }
    
    return dateObj.toLocaleDateString(undefined, defaultOptions);
  };
  
  /**
   * Formats a date with time for display
   * 
   * @param {string|Date} date - The date to format
   * @param {boolean} includeSeconds - Whether to include seconds in the time
   * @returns {string} Formatted date and time string
   */
  export const formatDateTimeForDisplay = (date, includeSeconds = false) => {
    if (!date) return 'N/A';
    
    // Handle both string dates and Date objects
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date provided to formatDateTimeForDisplay:', date);
      return 'Invalid Date';
    }
    
    // Format date portion
    const dateOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    };
    const dateString = dateObj.toLocaleDateString(undefined, dateOptions);
    
    // Format time portion
    const timeOptions = { 
      hour: '2-digit', 
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {})
    };
    const timeString = dateObj.toLocaleTimeString(undefined, timeOptions);
    
    return `${dateString} at ${timeString}`;
  };
  
  /**
   * Gets the start and end of a day for date range queries
   * 
   * @param {Date} date - The date to get bounds for
   * @returns {Object} Object with start and end Date objects
   */
  export const getDayBounds = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid date provided to getDayBounds');
    }
    
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  };
  
  /**
   * Gets a date range for the current week
   * 
   * @param {Date} date - A date within the desired week
   * @param {number} firstDayOfWeek - First day of week (0 = Sunday, 1 = Monday)
   * @returns {Object} Object with start and end Date objects
   */
  export const getWeekBounds = (date, firstDayOfWeek = 0) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid date provided to getWeekBounds');
    }
    
    const start = new Date(date);
    const day = start.getDay();
    
    // Calculate how many days we need to go back to reach the first day of the week
    const diff = (day < firstDayOfWeek ? 7 : 0) + day - firstDayOfWeek;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  };
  
  /**
   * Gets a date range for the current month
   * 
   * @param {Date} date - A date within the desired month
   * @returns {Object} Object with start and end Date objects
   */
  export const getMonthBounds = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid date provided to getMonthBounds');
    }
    
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  };
  
  /**
   * Adds days to a date
   * 
   * @param {Date} date - The original date
   * @param {number} days - Number of days to add (can be negative)
   * @returns {Date} New date with days added
   */
  export const addDays = (date, days) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid date provided to addDays');
    }
    
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };
  
  /**
   * Adds months to a date
   * 
   * @param {Date} date - The original date
   * @param {number} months - Number of months to add (can be negative)
   * @returns {Date} New date with months added
   */
  export const addMonths = (date, months) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid date provided to addMonths');
    }
    
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  };
  
  /**
   * Determines if two dates represent the same day (ignoring time)
   * 
   * @param {Date} date1 - First date to compare
   * @param {Date} date2 - Second date to compare
   * @returns {boolean} True if dates are the same day
   */
  export const isSameDay = (date1, date2) => {
    if (!date1 || !date2 || 
        !(date1 instanceof Date) || !(date2 instanceof Date) || 
        isNaN(date1.getTime()) || isNaN(date2.getTime())) {
      return false;
    }
    
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };
  
  /**
   * Determines if a date is today
   * 
   * @param {Date} date - The date to check
   * @returns {boolean} True if date is today
   */
  export const isToday = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return false;
    }
    
    return isSameDay(date, new Date());
  };
  
  /**
   * Parses a date string safely, returning null for invalid dates
   * 
   * @param {string} dateString - The date string to parse
   * @returns {Date|null} Parsed Date object or null if invalid
   */
  export const parseDateSafe = (dateString) => {
    if (!dateString) return null;
    
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  };
  
  /**
   * Gets the day of the week name
   * 
   * @param {Date} date - The date to get day name for
   * @param {string} format - Format: 'long' (Monday), 'short' (Mon), or 'narrow' (M)
   * @returns {string} Day of week name
   */
  export const getDayName = (date, format = 'long') => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }
    
    const options = { weekday: format };
    return date.toLocaleDateString(undefined, options);
  };
  
  /**
   * Gets the month name
   * 
   * @param {Date|number} dateOrMonth - Date object or month number (0-11)
   * @param {string} format - Format: 'long' (January), 'short' (Jan), or 'narrow' (J)
   * @returns {string} Month name
   */
  export const getMonthName = (dateOrMonth, format = 'long') => {
    let monthIndex;
    
    if (typeof dateOrMonth === 'number') {
      // If given a month index (0-11)
      monthIndex = dateOrMonth;
    } else if (dateOrMonth instanceof Date && !isNaN(dateOrMonth.getTime())) {
      // If given a valid date object
      monthIndex = dateOrMonth.getMonth();
    } else {
      return '';
    }
    
    // Ensure month index is valid
    if (monthIndex < 0 || monthIndex > 11) {
      return '';
    }
    
    const date = new Date();
    date.setMonth(monthIndex);
    
    const options = { month: format };
    return date.toLocaleDateString(undefined, options);
  };