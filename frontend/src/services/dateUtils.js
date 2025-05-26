/**
 * dateUtils.js - Utility functions for handling dates consistently throughout the application
 * Handles timezone-aware conversions and formatting to prevent scheduling issues
 */

/**
 * Formats a date to ISO date string (YYYY-MM-DD) without time component
 * @param {Date} date - The Date object to format
 * @returns {string} Formatted date string in YYYY-MM-DD format
 */
export const formatDateToISODate = (date) => {
    if (!(date instanceof Date)) {
      throw new Error('Invalid date object provided to formatDateToISODate');
    }
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };
  
  /**
   * Formats a date to a full ISO datetime string but preserves local time
   * by excluding timezone offset (YYYY-MM-DDTHH:MM:SS)
   * @param {Date} date - The Date object to format
   * @returns {string} Formatted datetime string in YYYY-MM-DDTHH:MM:SS format
   */
  export const formatToLocalISOString = (date) => {
    if (!(date instanceof Date)) {
      throw new Error('Invalid date object provided to formatToLocalISOString');
    }
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    // Format as local ISO string without timezone to preserve local time
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };
  
  /**
   * Parses a date string to a Date object, handling various formats consistently
   * @param {string} dateStr - The date string to parse
   * @returns {Date|null} Parsed Date object or null if invalid
   */
  export const parseDate = (dateStr) => {
    if (!dateStr) return null;
    
    try {
      // Handle ISO format with timezone (convert to local time correctly)
      if (typeof dateStr === 'string' && dateStr.includes('Z')) {
        return new Date(dateStr);
      }
      
      // Handle ISO format without timezone (interpret as local time)
      if (typeof dateStr === 'string' && dateStr.includes('T')) {
        const [datePart, timePart] = dateStr.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes, seconds] = timePart.split(':').map(Number);
        
        // Construct date using local timezone
        return new Date(year, month - 1, day, hours, minutes, seconds || 0);
      }
      
      // Handle YYYY-MM-DD format (set to noon local time to avoid timezone issues)
      if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0);
      }
      
      // Default parsing for other formats
      const parsedDate = new Date(dateStr);
      return isNaN(parsedDate.getTime()) ? null : parsedDate;
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  };
  
  
  /**
   * Safely handles date inputs for API requests
   * @param {Object} data - Object containing date fields
   * @param {string} fieldName - Name of the date field to process
   * @returns {Object} Modified data object with properly formatted date
   */
  export const prepareScheduledDateForApi = (data, fieldName = 'scheduled_date') => {
    if (!data || !data[fieldName]) return data;
    
    const result = { ...data };
    
    // Handle different input types
    if (result[fieldName] instanceof Date) {
      // For estimate scheduling with time component
      if (data.hour !== undefined || data.minute !== undefined) {
        // Use custom date/time from inputs
        const hours = data.hour !== undefined ? data.hour : result[fieldName].getHours();
        const minutes = data.minute !== undefined ? data.minute : result[fieldName].getMinutes();
        
        // Create a new date with the specified time
        const dateWithTime = new Date(result[fieldName]);
        dateWithTime.setHours(hours, minutes, 0, 0);
        
        // Format as local ISO string
        result[fieldName] = formatToLocalISOString(dateWithTime);
      } else if (data.includeTime === true) {
        // Include full time information
        result[fieldName] = formatToLocalISOString(result[fieldName]);
      } else {
        // For job scheduling where we only need the date
        result[fieldName] = formatDateToISODate(result[fieldName]);
      }
    } else if (typeof result[fieldName] === 'string' && result[fieldName].match(/^\d{4}-\d{2}-\d{2}$/)) {
      // It's already in YYYY-MM-DD format
      // Add time component if needed
      if (data.hour !== undefined && data.minute !== undefined) {
        const hour = data.hour.toString().padStart(2, '0');
        const minute = data.minute.toString().padStart(2, '0');
        result[fieldName] = `${result[fieldName]}T${hour}:${minute}:00`;
      }
    }
    
    return result;
  };


  // dateUtils.js - Create this file for consistent date handling
import { parse, format, parseISO } from 'date-fns';

/**
 * Converts a date to an ISO string without timezone information
 * to preserve the exact local time when sending to the server
 * @param {Date} date - The date to convert
 * @returns {string} ISO date string without timezone info
 */
export const toLocalISOString = (date) => {
  if (!(date instanceof Date)) return null;
  
  // Extract local date components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  // Format in ISO format without timezone information
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

/**
 * Prepares date for API request to prevent timezone issues
 * @param {Object} data - The data object containing scheduled_date
 * @returns {Object} Processed data with corrected date format
 */
export const prepareScheduledDate = (data) => {
  if (!data || !data.scheduled_date) return data;
  
  const processed = { ...data };
  const dateValue = processed.scheduled_date;
  
  // Handle Date objects
  if (dateValue instanceof Date) {
    // Extract time from scheduled_time if provided (for estimates)
    if (processed.schedule_time) {
      try {
        // Parse the time string
        const timeValue = processed.schedule_time;
        let hours = 0;
        let minutes = 0;
        
        // Handle different time formats
        if (timeValue.includes(':')) {
          const [hourStr, minuteStr] = timeValue.split(':');
          const isPM = minuteStr.includes('PM');
          
          // Extract hours (handling 12-hour format)
          hours = parseInt(hourStr, 10);
          if (isPM && hours < 12) hours += 12;
          if (!isPM && hours === 12) hours = 0;
          
          // Extract minutes
          minutes = parseInt(minuteStr.replace(/\s?[AP]M/, ''), 10);
        } else if (timeValue.includes('AM') || timeValue.includes('PM')) {
          // Handle "1 PM" format
          const isPM = timeValue.includes('PM');
          hours = parseInt(timeValue, 10);
          if (isPM && hours < 12) hours += 12;
          if (!isPM && hours === 12) hours = 0;
        }
        
        // Create a new date with the specified time
        const updatedDate = new Date(dateValue);
        updatedDate.setHours(hours, minutes, 0, 0);
        
        // Use the local ISO string format to preserve exact time
        processed.scheduled_date = toLocalISOString(updatedDate);
      } catch (error) {
        console.error('Error parsing schedule_time:', error);
        processed.scheduled_date = toLocalISOString(dateValue);
      }
    } else {
      // For job scheduling, remove time component
      if (processed.jobScheduling) {
        const year = dateValue.getFullYear();
        const month = String(dateValue.getMonth() + 1).padStart(2, '0');
        const day = String(dateValue.getDate()).padStart(2, '0');
        processed.scheduled_date = `${year}-${month}-${day}`;
      } else {
        // For estimates, preserve the exact time using local ISO string
        processed.scheduled_date = toLocalISOString(dateValue);
      }
    }
  } 
  // Handle ISO strings with timezone (like from date pickers)
  else if (typeof dateValue === 'string' && 
          (dateValue.endsWith('Z') || dateValue.includes('+') || dateValue.includes('-', 10))) {
    
    // Parse the string to a Date object to get local components
    const parsedDate = new Date(dateValue);
    
    // For job scheduling, use date only
    if (processed.jobScheduling) {
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      processed.scheduled_date = `${year}-${month}-${day}`;
    } else {
      // For estimates, preserve the exact time
      processed.scheduled_date = toLocalISOString(parsedDate);
    }
  }
  
  return processed;
};

/**
 * Formats a date for display in the UI
 * @param {string|Date} date - The date to format
 * @param {Object} options - Format options
 * @returns {string} Formatted date string
 */
export const formatDateForDisplay = (date, options = {}) => {
  if (!date) return '';
  
  const { includeTime = false, includeDay = false } = options;
  
  try {
    // Convert to Date object if it's a string
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return '';
    }
    
    // Format options
    const formatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    
    if (includeDay) {
      formatOptions.weekday = 'short';
    }
    
    if (includeTime) {
      formatOptions.hour = 'numeric';
      formatOptions.minute = '2-digit';
      formatOptions.hour12 = true;
    }
    
    return new Intl.DateTimeFormat('en-US', formatOptions).format(dateObj);
  } catch (error) {
    console.error('Error formatting date for display:', error);
    return '';
  }
};