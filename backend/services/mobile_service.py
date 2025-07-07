# backend/services/mobile_service.py

import os
import logging
from datetime import datetime
from models import JobSignature, JobTimeTracking
from sqlalchemy import func

# It is good practice to install external libraries at the top.
# Make sure Pillow is installed: pip install Pillow
try:
    from PIL import Image, ImageOps
except ImportError:
    Image = None
    ImageOps = None
    logging.warning("Pillow library not found. Thumbnail generation will be disabled.")


logger = logging.getLogger(__name__)

def get_job_mobile_status(job):
    """Helper function to determine the mobile status of a job."""
    # Check if the job is definitively completed
    final_signature = JobSignature.query.filter_by(job_id=job.id, signature_type='final').first()
    if final_signature or job.status == 'completed':
        return "completed"

    # Check if the job has been started
    start_signature = JobSignature.query.filter_by(job_id=job.id, signature_type='start').first()
    time_tracking_entry = JobTimeTracking.query.filter_by(job_id=job.id).first()
    if start_signature or time_tracking_entry:
        return "started"

    # Otherwise, it's not started
    return "not_started"

def get_job_progress_and_time(job):
    """Helper function to calculate job progress and total time."""
    from models import db
    
    # Calculate door progress
    # --- THIS IS THE FIX ---
    # When using lazy='dynamic', we must use .count() instead of len().
    total_doors = job.bid.doors.count() if job.bid and job.bid.doors else 0
    # -----------------------

    completed_doors = 0
    if total_doors > 0:
        # This part of your code seems to be using JobSignature for completion tracking.
        # This is fine, just ensure it's what you intend.
        completed_doors = JobSignature.query.filter_by(
            job_id=job.id,
            signature_type='door_complete'
        ).count()

    completion_percentage = round((completed_doors / total_doors * 100), 1) if total_doors > 0 else 0

    # Calculate total time worked (This part seems okay)
    total_minutes = 0
    
    completed_minutes = db.session.query(func.sum(JobTimeTracking.total_minutes)).filter(
        JobTimeTracking.job_id == job.id,
        JobTimeTracking.status.in_(['completed', 'paused'])
    ).scalar() or 0
    total_minutes += completed_minutes
    
    active_session = JobTimeTracking.query.filter_by(job_id=job.id, status='active').first()
    if active_session and active_session.start_time:
        active_duration = datetime.utcnow() - active_session.start_time
        total_minutes += int(active_duration.total_seconds() / 60)
        
    total_time_hours = round(total_minutes / 60, 2)

    return {
        'total_doors': total_doors,
        'completed_doors': completed_doors,
        'completion_percentage': completion_percentage,
        'total_time_hours': total_time_hours,
        'total_minutes': total_minutes
    }
    
    
def create_upload_folder(job_id):
    """
    Create upload folder structure for job media.
    This version uses a relative path from the project root.
    """
    try:
        # Define the base folder relative to the current working directory (project root)
        MOBILE_UPLOAD_FOLDER = 'mobile_uploads'
        
        # Create base upload folder if it doesn't exist
        # 'mode=0o755' is for Linux/macOS permissions; it has little effect on Windows but is good practice.
        if not os.path.exists(MOBILE_UPLOAD_FOLDER):
            os.makedirs(MOBILE_UPLOAD_FOLDER, mode=0o755)
        
        # Create job-specific folder
        job_folder = os.path.join(MOBILE_UPLOAD_FOLDER, f"job_{job_id}")
        if not os.path.exists(job_folder):
            os.makedirs(job_folder, mode=0o755)
        
        # Create media type subfolders
        for media_type in ['photos', 'videos', 'thumbnails']:
            subfolder = os.path.join(job_folder, media_type)
            if not os.path.exists(subfolder):
                os.makedirs(subfolder, mode=0o755)
        
        return job_folder
        
    except Exception as e:
        logger.error(f"Error creating upload folder for job {job_id}: {str(e)}")
        # Raise the exception so the calling route can handle it.
        raise

def allowed_file(filename, allowed_extensions):
    """Enhanced file extension validation with case-insensitive checking."""
    if not filename or '.' not in filename:
        return False
    
    extension = filename.rsplit('.', 1)[1].lower()
    return extension in allowed_extensions

def generate_thumbnail(original_path, thumbnail_path, size=(300, 300)):
    """Enhanced thumbnail generation with better error handling."""
    # Check if Pillow was imported successfully
    if Image is None or ImageOps is None:
        logger.warning("Pillow not available; cannot generate thumbnail.")
        return None # Return None to indicate failure

    try:
        with Image.open(original_path) as img:
            # This handles EXIF orientation data to prevent rotated thumbnails
            img = ImageOps.exif_transpose(img)
            
            # Handle transparency by pasting on a white background
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                # Convert palette images to RGBA to handle transparency
                if img.mode == 'P':
                    img = img.convert('RGBA')
                # Use the alpha channel as a mask for pasting
                background.paste(img, mask=img.getchannel('A'))
                img = background
            # Convert other modes to RGB
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Create the thumbnail while maintaining aspect ratio
            img.thumbnail(size, Image.Resampling.LANCZOS)
            
            # Save the optimized thumbnail
            img.save(thumbnail_path, 'JPEG', quality=85, optimize=True, progressive=True)
            
        logger.info(f"Generated optimized thumbnail: {thumbnail_path}")
        return thumbnail_path
        
    except Exception as e:
        logger.error(f"Error generating thumbnail for {original_path}: {str(e)}")
        # Return None to indicate that thumbnail generation failed
        return None