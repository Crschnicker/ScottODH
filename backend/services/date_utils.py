# backend/services/date_utils.py
import re
import pytz
import logging
from datetime import datetime, date
from models import Job

logger = logging.getLogger(__name__)

# Configure server timezone
SERVER_TIMEZONE = pytz.timezone('America/Los_Angeles')

def format_date_for_response(date_obj):
    """
    Format a date object for consistent API responses.
    For job scheduling, we want to preserve the exact date (without time) to
    prevent timezone conversion issues.
    
    Args:
        date_obj (date or datetime): The date to format
        
    Returns:
        str: Formatted date string in ISO format
    """
    if not date_obj:
        return None
        
    if isinstance(date_obj, datetime):
        # Make datetime timezone-aware if it isn't already
        if date_obj.tzinfo is None:
            date_obj = SERVER_TIMEZONE.localize(date_obj)
        # For jobs, we just want the date part in YYYY-MM-DD format
        return date_obj.date().isoformat()
    elif isinstance(date_obj, date):
        # Already just a date
        return date_obj.isoformat()
    
    # Fallback - shouldn't reach here
    return str(date_obj)

def parse_job_date(date_str):
    """
    Parse a date string for job scheduling, returning a date object
    without time component to prevent timezone issues.
    
    Args:
        date_str (str): Date string to parse
        
    Returns:
        date: Parsed date object (without time)
    """
    logger.info(f"Parsing job date: '{date_str}'")
    
    if not date_str:
        return None
    
    try:
        # Case 1: ISO format with timezone
        if 'T' in date_str and (date_str.endswith('Z') or '+' in date_str or '-' in date_str.split('T')[1]):
            logger.info(f"Parsing job date with timezone: {date_str}")
            # Parse the date and extract just the date part
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            # Convert to server timezone
            dt = dt.astimezone(SERVER_TIMEZONE)
            logger.info(f"Extracted date part: {dt.date()}")
            return dt.date()
            
        # Case 2: ISO format without timezone (2023-05-21T10:00:00)
        elif 'T' in date_str:
            logger.info(f"Parsing job date with time but no timezone: {date_str}")
            # Just parse the date part
            date_part = date_str.split('T')[0]
            year, month, day = map(int, date_part.split('-'))
            return date(year, month, day)
            
        # Case 3: Simple date format (2023-05-21)
        elif date_str.count('-') == 2:
            logger.info(f"Parsing simple YYYY-MM-DD format: {date_str}")
            year, month, day = map(int, date_str.split('-'))
            return date(year, month, day)
            
        # Case 4: Other date formats
        else:
            logger.info(f"Attempting to parse with datetime: {date_str}")
            # Try standard parsing but extract just the date part
            dt = datetime.fromisoformat(date_str)
            return dt.date()
            
    except Exception as e:
        logger.error(f"Error parsing job date '{date_str}': {str(e)}")
        raise ValueError(f"Invalid date format: {str(e)}")

def parse_datetime_with_logging(date_str, hour=None, minute=None):
    """
    Parse date string with detailed logging to diagnose timezone issues.
    
    Args:
        date_str (str): Date string to parse
        hour (int, optional): Hour value if provided separately
        minute (int, optional): Minute value if provided separately
        
    Returns:
        datetime: Parsed datetime object preserving the intended time
    """
    logger.info(f"Parsing date string: '{date_str}', hour: {hour}, minute: {minute}")
    
    if not date_str:
        logger.warning("Empty date string provided")
        return None
    
    try:
        # Case 1: ISO format with timezone information
        if ('T' in date_str and 
            (date_str.endswith('Z') or '+' in date_str or '-' in date_str.split('T')[1])):
            
            logger.info(f"Detected ISO format with timezone: {date_str}")
            
            # Replace Z with +00:00 for ISO format compatibility
            if date_str.endswith('Z'):
                date_str = date_str[:-1] + '+00:00'
                logger.info(f"Replaced Z with +00:00: {date_str}")
            
            # Parse ISO format with timezone
            dt = datetime.fromisoformat(date_str)
            logger.info(f"Parsed with timezone: {dt} (UTC)")
            
            # Convert to server timezone to preserve the time
            local_dt = dt.astimezone(SERVER_TIMEZONE)
            logger.info(f"Converted to server timezone: {local_dt} ({SERVER_TIMEZONE})")
            
            return local_dt
        
        # Case 2: ISO format without timezone (2023-05-21T10:00:00)
        elif 'T' in date_str:
            logger.info(f"Detected ISO format without timezone: {date_str}")
            
            # Parse the datetime components
            date_part, time_part = date_str.split('T')
            year, month, day = map(int, date_part.split('-'))
            
            # Parse time with proper handling of seconds/milliseconds
            time_parts = time_part.split(':')
            hour_val = int(time_parts[0])
            minute_val = int(time_parts[1])
            
            # Handle seconds if present
            second_val = 0
            if len(time_parts) > 2:
                # Remove milliseconds if present
                seconds_part = time_parts[2].split('.')[0]
                second_val = int(seconds_part)
            
            # Create datetime with the exact time specified
            naive_dt = datetime(year, month, day, hour_val, minute_val, second_val)
            logger.info(f"Created naive datetime: {naive_dt}")
            
            # Localize to server timezone
            local_dt = SERVER_TIMEZONE.localize(naive_dt)
            logger.info(f"Localized to server timezone: {local_dt}")
            
            return local_dt
        
        # Case 3: Simple date format (2023-05-21) with explicit time parameters
        elif re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
            logger.info(f"Detected date-only format: {date_str}")
            
            year, month, day = map(int, date_str.split('-'))
            
            # Use provided hour/minute or default to noon
            hour_val = hour if hour is not None else 12
            minute_val = minute if minute is not None else 0
            
            logger.info(f"Using time components: hour={hour_val}, minute={minute_val}")
            
            # Create datetime with specified or default time
            naive_dt = datetime(year, month, day, hour_val, minute_val, 0)
            logger.info(f"Created naive datetime with specified time: {naive_dt}")
            
            # Localize to server timezone
            local_dt = SERVER_TIMEZONE.localize(naive_dt)
            logger.info(f"Localized to server timezone: {local_dt}")
            
            return local_dt
            
        # Case 4: Any other format - try standard parsing
        else:
            logger.warning(f"Unrecognized date format: {date_str}, attempting standard parsing")
            dt = datetime.fromisoformat(date_str)
            logger.info(f"Parsed with standard method: {dt}")
            return dt
            
    except Exception as e:
        logger.error(f"Error parsing date '{date_str}': {str(e)}")
        raise ValueError(f"Invalid date format: {str(e)}")

def format_datetime_for_response(dt):
    """
    Format datetime for consistent API responses.
    
    Args:
        dt (datetime): Datetime object to format
        
    Returns:
        str: Formatted datetime string
    """
    if not dt:
        return None
        
    # Ensure timezone awareness
    if dt.tzinfo is None:
        dt = SERVER_TIMEZONE.localize(dt)
        
    # ISO format with timezone information
    iso_format = dt.isoformat()
    logger.info(f"Formatted datetime for response: {iso_format}")
    return iso_format

def parse_time_string(time_str):
    """
    Parse a time string in various formats and return hour and minute.
    
    Args:
        time_str (str): Time string in formats like "1:30 PM", "13:30", "1 PM"
        
    Returns:
        tuple: (hour, minute) as integers
    """
    if not time_str:
        return None, None
        
    try:
        # Normalize and clean the string
        time_str = time_str.strip().upper()
        is_pm = 'PM' in time_str
        is_am = 'AM' in time_str
        
        # Remove AM/PM indicators
        time_str = time_str.replace('AM', '').replace('PM', '').strip()
        
        # Parse hour and minute
        if ':' in time_str:
            # Format with hours and minutes (e.g., "1:30")
            hour_str, minute_str = time_str.split(':')
            hour = int(hour_str)
            minute = int(minute_str)
        else:
            # Format with just hours (e.g., "1")
            hour = int(time_str)
            minute = 0
            
        # Convert from 12-hour to 24-hour format if needed
        if is_pm and hour < 12:
            hour += 12
        if is_am and hour == 12:
            hour = 0
            
        logger.info(f"Parsed time string '{time_str}' to hour={hour}, minute={minute}")
        return hour, minute
    
    except Exception as e:
        logger.error(f"Error parsing time string '{time_str}': {str(e)}")
        return None, None

def generate_job_number():
    """Generate a unique job number based on current date and count"""
    today = date.today()
    
    # Use the specific 2-letter month codes
    month_codes = {
        1: "JA", 2: "FB", 3: "MR", 4: "AP", 5: "MY", 6: "JU",
        7: "JL", 8: "AG", 9: "SP", 10: "OT", 11: "NV", 12: "DC"
    }
    month_code = month_codes[today.month]
    
    # Get count of jobs created this month (INCLUDING today)
    month_start = date(today.year, today.month, 1)
    month_end = date(today.year, today.month + 1, 1) if today.month < 12 else date(today.year + 1, 1, 1)
    
    # Count ALL jobs in current month, including today
    month_jobs = Job.query.filter(
        Job.created_at >= month_start,
        Job.created_at < month_end
    ).count()
    
    # Add 1 to the count for the new job number
    job_number = f"{month_code}{month_jobs + 1}{str(today.year)[2:]}"
    return job_number