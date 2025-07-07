from flask import Blueprint, jsonify, request, send_from_directory, abort, current_app
from flask_login import login_required, current_user
from datetime import datetime, date
from models import (db, Job, JobTimeTracking, JobSignature, DoorMedia,
                   MobileJobLineItem, LineItem, Door, User)
from services.mobile_service import (get_job_mobile_status, get_job_progress_and_time,
                                   create_upload_folder, allowed_file, generate_thumbnail)
import logging
import os

mobile_bp = Blueprint('mobile', __name__)
logger = logging.getLogger(__name__)

# Configuration for file uploads
MOBILE_UPLOAD_FOLDER = 'mobile_uploads'
ALLOWED_PHOTO_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'webm', 'mov', 'avi'}
MAX_PHOTO_SIZE = 10 * 1024 * 1024  # 10MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB

def serialize_job_for_mobile(job):
    """
    Serializes a Job object into a dictionary suitable for the mobile interface.
    """
    customer_name = 'N/A'
    address = 'N/A'
    contact_name = None
    phone = None
    email = None
    region = 'N/A'

    if job.bid and job.bid.estimate:
        if job.bid.estimate.customer_direct_link:
            customer_name = job.bid.estimate.customer_direct_link.name
        site = job.bid.estimate.site
        if site:
            address = site.address if site.address else address
            contact_name = site.contact_name
            phone = site.phone
            email = site.email
            if hasattr(site, 'region') and site.region:
                region = site.region

    mobile_status = get_job_mobile_status(job)
    progress_data = get_job_progress_and_time(job)

    total_doors = progress_data.get('total_doors', 0)
    completed_doors = progress_data.get('completed_doors', 0)
    completion_percentage = round((completed_doors / total_doors * 100)) if total_doors > 0 else 0

    return {
        'id': job.id,
        'job_number': job.job_number,
        'customer_name': customer_name,
        'address': address,
        'contact_name': contact_name,
        'phone': phone,
        'email': email,
        'region': region,
        'job_scope': job.job_scope,
        'scheduled_date': job.scheduled_date.isoformat() if job.scheduled_date else None,
        'status': job.status,
        'mobile_status': mobile_status,
        'material_ready': job.material_ready,
        'material_location': job.material_location,
        'truck_assignment': job.truck_assignment if hasattr(job, 'truck_assignment') else None,
        'total_doors': total_doors,
        'completed_doors': completed_doors,
        'completion_percentage': completion_percentage,
        'total_time_hours': progress_data.get('total_hours', 0),
        'time_tracking': {
            'total_hours': progress_data.get('total_hours', 0),
            'total_minutes': progress_data.get('total_minutes', 0),
            'segments': progress_data.get('time_segments', [])
        }
    }

@mobile_bp.route('/config', methods=['GET'])
def get_mobile_api_config():
    """Provide API configuration for mobile job worker offline functionality"""
    try:
        config = {
            'api_version': '1.0.2', 'base_url': request.url_root.rstrip('/'), 'api_prefix': '/api',
            'authentication': {'type': 'session', 'login_endpoint': '/api/auth/login', 'logout_endpoint': '/api/auth/logout', 'session_check_endpoint': '/api/auth/me'},
            'endpoints': {
                'jobs': {'get_jobs_list': '/api/mobile/field-jobs', 'get_job': '/api/mobile/jobs/{job_id}', 'start_job': '/api/mobile/jobs/{job_id}/start', 'complete_job': '/api/mobile/jobs/{job_id}/complete', 'pause_job': '/api/mobile/jobs/{job_id}/pause', 'resume_job': '/api/mobile/jobs/{job_id}/resume'},
                'doors': {'complete_door': '/api/mobile/doors/{door_id}/complete', 'upload_media': '/api/mobile/doors/{door_id}/media/upload', 'toggle_line_item': '/api/mobile/jobs/{job_id}/line-items/{line_item_id}/toggle'}
            },
            'offline': {'supported': True, 'cache_duration': 24 * 60 * 60 * 1000, 'sync_interval': 5 * 60 * 1000},
            'media': {'max_photo_size': MAX_PHOTO_SIZE, 'max_video_size': MAX_VIDEO_SIZE, 'allowed_photo_types': list(ALLOWED_PHOTO_EXTENSIONS), 'allowed_video_types': list(ALLOWED_VIDEO_EXTENSIONS)}
        }
        if current_user.is_authenticated:
            config['user'] = {'id': current_user.id, 'username': current_user.username, 'role': current_user.role, 'full_name': current_user.get_full_name()}
        return jsonify(config), 200
    except Exception as e:
        logger.error(f"Error generating mobile API config: {e}")
        return jsonify({'error': 'Failed to generate API configuration'}), 500

@login_required
def get_mobile_job_data(job_id):
    """Enhanced mobile job data endpoint - provides full detail for a single job."""
    try:
        job = Job.query.get_or_404(job_id)

        if not job.bid or not job.bid.estimate or not job.bid.estimate.customer_direct_link:
            return jsonify({'error': 'Job is missing critical associated data (bid, estimate, or customer).'}), 500

        if current_user.role == 'field' and hasattr(job, 'truck_assignment') and job.truck_assignment != current_user.username:
            return jsonify({'error': 'Forbidden: You are not assigned to this job.'}), 403

        mobile_status = get_job_mobile_status(job)
        progress_data = get_job_progress_and_time(job)

        doors_details = []
        job_doors = job.bid.doors if job.bid and hasattr(job.bid, 'doors') else []

        for door_model in job_doors:
            line_items_details = []
            if hasattr(door_model, 'line_items') and door_model.line_items:
                for line_item in door_model.line_items:
                    mobile_line_completion = MobileJobLineItem.query.filter_by(
                        job_id=job.id, line_item_id=line_item.id
                    ).first()
                    is_completed = mobile_line_completion.completed if mobile_line_completion else False

                    line_items_details.append({
                        'id': line_item.id,
                        'description': line_item.description or f'Work item {line_item.id}',
                        'part_number': line_item.part_number or '',
                        'quantity': line_item.quantity or 1,
                        'completed': is_completed
                    })

            latest_photo = DoorMedia.query.filter_by(
                job_id=job.id, door_id=door_model.id, media_type='photo'
            ).order_by(DoorMedia.uploaded_at.desc()).first()

            latest_video = DoorMedia.query.filter_by(
                job_id=job.id, door_id=door_model.id, media_type='video'
            ).order_by(DoorMedia.uploaded_at.desc()).first()

            door_completion_signature = JobSignature.query.filter_by(
                job_id=job.id, door_id=door_model.id, signature_type='door_complete'
            ).first()
            is_door_completed = door_completion_signature is not None

            door_detail = {
                'id': door_model.id,
                'door_number': door_model.door_number or (job_doors.index(door_model) + 1),
                'location': door_model.location or f'Door #{door_model.door_number or (job_doors.index(door_model) + 1)}',
                'labor_description': door_model.labor_description or 'Standard door work',
                'line_items': line_items_details,
                'completed': is_door_completed,
                'has_photo': bool(latest_photo),
                'has_video': bool(latest_video),
                'has_signature': is_door_completed
            }
            doors_details.append(door_detail)

        response_data = serialize_job_for_mobile(job)
        response_data['doors'] = doors_details

        return jsonify(response_data), 200

    except Exception as e:
        logger.error(f"Error retrieving mobile job data for job_id {job_id}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve job data. Please try again or contact support.'}), 500

@mobile_bp.route('/jobs/<int:job_id>/start', methods=['POST'])
@login_required
def start_mobile_job(job_id):
    """Start a job with signature for mobile workers"""
    try:
        job = Job.query.get_or_404(job_id)
        data = request.json

        if current_user.role == 'field' and hasattr(job, 'truck_assignment') and job.truck_assignment != current_user.username:
            return jsonify({'error': 'Forbidden: You cannot start a job not assigned to you.'}), 403

        existing_time_tracking = JobTimeTracking.query.filter_by(
            job_id=job_id,
            user_id=current_user.id,
            end_time=None
        ).first()

        if existing_time_tracking:
            return jsonify({'error': 'Job is already started by this user. Use resume if paused.'}), 400

        time_tracking = JobTimeTracking(
            job_id=job_id,
            user_id=current_user.id,
            start_time=datetime.utcnow(),
            status='active'
        )
        db.session.add(time_tracking)

        signature_data = data.get('signature', '')
        signer_name = data.get('signer_name', current_user.get_full_name())
        signer_title = data.get('signer_title', current_user.role)

        if signature_data:
            job_signature = JobSignature(
                job_id=job_id,
                user_id=current_user.id,
                signature_type='start',
                signature_data=signature_data,
                signer_name=signer_name,
                signer_title=signer_title
            )
            db.session.add(job_signature)

        if job.status == 'scheduled':
            job.status = 'in_progress'

        if hasattr(job, 'mobile_status') and job.mobile_status not in ['started', 'completed']:
             job.mobile_status = 'started'

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Job started successfully',
            'job_id': job_id,
            'time_tracking_id': time_tracking.id,
            'current_mobile_status': job.mobile_status if hasattr(job, 'mobile_status') else None
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error starting mobile job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to start job: {str(e)}'}), 500

@mobile_bp.route('/jobs/<int:job_id>/pause', methods=['POST'])
@login_required
def pause_mobile_job(job_id):
    """Pause an active job timer for the current user."""
    try:
        job = Job.query.get_or_404(job_id)
        data = request.json or {}

        active_tracking = JobTimeTracking.query.filter_by(
            job_id=job.id,
            user_id=current_user.id,
            status='active'
        ).first()

        if not active_tracking:
            return jsonify({'error': 'Job is not currently active for this user. Cannot pause.'}), 400

        active_tracking.end_time = datetime.utcnow()
        active_tracking.status = 'paused'
        duration = (active_tracking.end_time - active_tracking.start_time).total_seconds()
        active_tracking.duration_seconds = duration

        if hasattr(job, 'mobile_status'):
            job.mobile_status = 'paused'

        if data.get('signature'):
            job_signature = JobSignature(
                job_id=job.id,
                user_id=current_user.id,
                signature_type='pause',
                signature_data=data['signature'],
                signer_name=data.get('signer_name', current_user.get_full_name()),
                signer_title=data.get('signer_title', 'Site Contact')
            )
            db.session.add(job_signature)

        db.session.commit()
        logger.info(f"User {current_user.id} paused job {job_id}.")

        return jsonify({
            'success': True,
            'message': 'Job paused successfully.',
            'job_id': job_id,
            'current_mobile_status': 'paused'
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error pausing job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to pause job: {str(e)}'}), 500

@mobile_bp.route('/jobs/<int:job_id>/resume', methods=['POST'])
@login_required
def resume_mobile_job(job_id):
    """Resume a paused job timer for the current user."""
    try:
        job = Job.query.get_or_404(job_id)
        data = request.json or {}

        last_tracking = JobTimeTracking.query.filter_by(
            job_id=job.id,
            user_id=current_user.id,
        ).order_by(JobTimeTracking.start_time.desc()).first()

        if last_tracking and last_tracking.status == 'active':
             return jsonify({'error': 'Job is already active. Cannot resume.'}), 400

        new_tracking = JobTimeTracking(
            job_id=job.id,
            user_id=current_user.id,
            start_time=datetime.utcnow(),
            status='active'
        )
        db.session.add(new_tracking)

        if hasattr(job, 'mobile_status'):
            job.mobile_status = 'started'

        if data.get('signature'):
            job_signature = JobSignature(
                job_id=job.id,
                user_id=current_user.id,
                signature_type='resume',
                signature_data=data['signature'],
                signer_name=data.get('signer_name', current_user.get_full_name()),
                signer_title=data.get('signer_title', 'Site Contact')
            )
            db.session.add(job_signature)

        db.session.commit()
        logger.info(f"User {current_user.id} resumed job {job_id}.")

        return jsonify({
            'success': True,
            'message': 'Job resumed successfully.',
            'job_id': job_id,
            'time_tracking_id': new_tracking.id,
            'current_mobile_status': 'started'
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resuming job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to resume job: {str(e)}'}), 500

@mobile_bp.route('/jobs/<int:job_id>/complete', methods=['POST'])
@login_required
def complete_mobile_job(job_id):
    """Marks a job as complete from the mobile interface."""
    try:
        job = Job.query.get_or_404(job_id)
        data = request.json or {}

        active_tracking = JobTimeTracking.query.filter_by(job_id=job.id, user_id=current_user.id, status='active').first()
        if active_tracking:
            active_tracking.end_time = datetime.utcnow()
            active_tracking.status = 'completed'
            duration = (active_tracking.end_time - active_tracking.start_time).total_seconds()
            active_tracking.duration_seconds = duration

        job.status = 'completed'
        if hasattr(job, 'mobile_status'):
            job.mobile_status = 'completed'

        if data.get('signature'):
            job_signature = JobSignature(
                job_id=job.id,
                user_id=current_user.id,
                signature_type='final_completion',
                signature_data=data['signature'],
                signer_name=data.get('signer_name', current_user.get_full_name()),
                signer_title=data.get('signer_title', 'Site Contact')
            )
            db.session.add(job_signature)

        db.session.commit()
        logger.info(f"User {current_user.id} completed job {job_id}.")

        return jsonify({
            'success': True,
            'message': 'Job completed successfully.',
            'job_id': job_id
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error completing job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to complete job: {str(e)}'}), 500

@mobile_bp.route('/jobs/<int:job_id>/line-items/<int:line_item_id>/toggle', methods=['PUT'])
@login_required
def toggle_mobile_line_item(job_id, line_item_id):
    """Toggle completion status of a line item for mobile workers"""
    try:
        job = Job.query.get_or_404(job_id)
        line_item = LineItem.query.get_or_404(line_item_id)

        is_valid_line_item = False
        if job.bid and hasattr(job.bid, 'doors'):
            for door in job.bid.doors:
                if line_item.door_id == door.id:
                    is_valid_line_item = True
                    break

        if not is_valid_line_item:
            return jsonify({'error': 'Line item does not belong to this job or its associated bid doors.'}), 400

        mobile_completion = MobileJobLineItem.query.filter_by(
            job_id=job_id,
            line_item_id=line_item_id
        ).first()

        previous_completed = False
        if mobile_completion:
            previous_completed = mobile_completion.completed

        new_completed = not previous_completed

        if not mobile_completion:
            mobile_completion = MobileJobLineItem(
                job_id=job_id,
                line_item_id=line_item_id,
                completed=new_completed,
                completed_at=datetime.utcnow() if new_completed else None,
                completed_by=current_user.id if new_completed else None
            )
            db.session.add(mobile_completion)
        else:
            mobile_completion.completed = new_completed
            if new_completed:
                mobile_completion.completed_at = datetime.utcnow()
                mobile_completion.completed_by = current_user.id
            else:
                mobile_completion.completed_at = None
                mobile_completion.completed_by = None

        db.session.commit()

        return jsonify({
            'success': True,
            'line_item_id': line_item_id,
            'completed': new_completed,
            'previous_completed': previous_completed
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error toggling line item {line_item_id} for job {job_id}: {str(e)}")
        return jsonify({'error': 'Failed to toggle line item completion status'}), 500

@mobile_bp.route('/doors/<int:door_id>/media/upload', methods=['POST'])
@login_required
def upload_door_media(door_id):
    """
    Saves uploaded media to the correct subfolder (photos/videos)
    and stores the correct relative path in the database.
    """
    try:
        door = Door.query.get_or_404(door_id)
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        job_id = request.form.get('job_id')
        media_type = request.form.get('media_type', 'photo')

        if not job_id:
            return jsonify({'error': 'Missing job_id'}), 400

        job = Job.query.get_or_404(job_id)
        if not job.bid or door.bid_id != job.bid_id:
            return jsonify({'error': 'Door does not belong to the specified job'}), 400

        media_subfolder = f"{media_type}s"

        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')[:-3]
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        filename = f"door_{door_id}_{media_type}_{timestamp}.{file_extension}"
        relative_path_for_db = os.path.join(f'job_{job_id}', media_subfolder, filename)

        upload_folder = current_app.config['UPLOAD_FOLDER']
        full_save_path = os.path.join(upload_folder, relative_path_for_db)

        os.makedirs(os.path.dirname(full_save_path), exist_ok=True)
        file.save(full_save_path)

        file_size = os.path.getsize(full_save_path)

        thumbnail_relative_path = None
        if media_type == 'photo':
            try:
                thumb_dir = os.path.join(upload_folder, f'job_{job_id}', 'thumbnails')
                os.makedirs(thumb_dir, exist_ok=True)
                full_thumb_path = generate_thumbnail(full_save_path, os.path.join(thumb_dir, f"thumb_{filename}"))
                if full_thumb_path:
                    thumbnail_relative_path = os.path.relpath(full_thumb_path, upload_folder)
            except Exception as e:
                logger.warning(f"Could not generate thumbnail for {filename}: {e}")

        door_media = DoorMedia(
            door_id=door_id,
            job_id=int(job_id),
            media_type=media_type,
            file_path=relative_path_for_db,
            thumbnail_path=thumbnail_relative_path,
            file_size=file_size,
            uploaded_at=datetime.utcnow(),
            uploaded_by=current_user.id
        )
        db.session.add(door_media)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Media uploaded successfully.',
            'media_id': door_media.id
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Fatal error in upload_door_media for door {door_id}: {str(e)}", exc_info=True)
        return jsonify({'error': 'An internal server error occurred during file upload.'}), 500

# In backend/routes/mobile.py

@mobile_bp.route('/field-jobs', methods=['GET'])
@login_required
def get_field_jobs():
    """
    Get jobs assigned to the current field tech (or their truck) for today.
    This now filters for visibility and sorts by the dispatch order.
    """
    if not hasattr(current_user, 'role') or current_user.role not in ['field', 'admin']:
        return jsonify({"error": "Forbidden: Insufficient permissions to view field jobs."}), 403

    target_date_str = request.args.get('date')
    if target_date_str:
        try:
            target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({"error": "Invalid date format for 'date' parameter. Use YYYY-MM-DD."}), 400
    else:
        target_date = date.today()

    # --- MODIFIED AND MORE ROBUST QUERY ---
    jobs_query = Job.query.filter(
        # CRITICAL FIX: Ensure scheduled_date is not NULL before comparing it.
        Job.scheduled_date.isnot(None),
        
        # Now it is safe to compare the date part.
        db.func.date(Job.scheduled_date) == target_date,
        
        Job.truck_assignment == current_user.username,
        Job.is_visible == True
    )

    # Sort by the job_order set in the dispatch calendar.
    jobs = jobs_query.order_by(Job.job_order).all()
    # --- END OF MODIFICATION ---
    
    serialized_jobs = [serialize_job_for_mobile(job) for job in jobs]

    summary = {
        "date": target_date.isoformat(),
        "truck_assignment": current_user.username,
        "total_jobs": len(serialized_jobs),
        "completed_jobs": len([j for j in serialized_jobs if j.get('mobile_status') == 'completed'])
    }

    logger.info(f"Field tech '{current_user.username}' requested jobs for {target_date}. Found {len(serialized_jobs)} visible jobs.")
    return jsonify({"jobs": serialized_jobs, "summary": summary}), 200



@mobile_bp.route('/field-jobs/<int:job_id>', methods=['GET'])
@login_required
def get_field_job_detail_for_field_view(job_id):
    logger.info(f"Field tech '{current_user.username}' requested detailed job data for job ID {job_id} via /field-jobs route.")
    return get_mobile_job_data(job_id)

@mobile_bp.route('/field-summary', methods=['GET'])
@login_required
def get_field_summary():
    if not hasattr(current_user, 'role') or current_user.role not in ['field', 'admin']:
        return jsonify({"error": "Forbidden: Insufficient permissions to view field summary."}), 403

    today_jobs = Job.query.filter(
        db.func.date(Job.scheduled_date) == date.today(),
        Job.truck_assignment == current_user.username,
        Job.is_visible == True # Also apply visibility filter here for consistency
    ).all()

    completed_today = len([job for job in today_jobs if get_job_mobile_status(job) == 'completed'])
    in_progress_today = len([job for job in today_jobs if get_job_mobile_status(job) == 'started'])
    not_started_today = len([job for job in today_jobs if get_job_mobile_status(job) == 'not_started'])

    summary_data = {
        "truck_assignment": current_user.username,
        "today_total_jobs": len(today_jobs),
        "today_completed_jobs": completed_today,
        "today_in_progress_jobs": in_progress_today,
        "today_not_started_jobs": not_started_today,
        "last_updated": datetime.utcnow().isoformat()
    }
    logger.info(f"Field tech '{current_user.username}' requested field summary. Data: {summary_data}")
    return jsonify(summary_data), 200

@mobile_bp.route('/test', methods=['GET'])
def mobile_test_connection():
    """Simple endpoint to test mobile API connectivity."""
    user_info = current_user.username if current_user.is_authenticated else "anonymous"
    logger.info(f"Mobile API test connection requested by {user_info}.")
    return jsonify({
        "status": "mobile API healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "current_user": user_info,
        "user_id": current_user.id if current_user.is_authenticated else None,
        "user_role": current_user.role if current_user.is_authenticated else None
    }), 200

@mobile_bp.route('/media/jobs/<int:job_id>/doors/<int:door_id>/<path:filename>', methods=['GET'])
def serve_door_media(job_id, door_id, filename):
    """
    Serves media files from older structure. This is a deprecated route and can be removed later.
    """
    base_dir = os.path.join(os.getcwd(), MOBILE_UPLOAD_FOLDER, f'job_{job_id}')
    safe_path = os.path.normpath(os.path.join(base_dir, filename))
    if not safe_path.startswith(os.path.abspath(base_dir)):
        logger.warning(f"Directory traversal attempt blocked for filename: {filename}")
        abort(403)

    if os.path.exists(safe_path) and os.path.isfile(safe_path):
        directory = os.path.dirname(safe_path)
        actual_filename = os.path.basename(safe_path)
        try:
            return send_from_directory(directory, actual_filename)
        except Exception as e:
            logger.error(f"Error serving media file {filename} for job {job_id}, door {door_id}: {e}")
            abort(404)
    logger.warning(f"Media file not found at path: {safe_path}")
    abort(404)

@mobile_bp.route('/doors/<int:door_id>/complete', methods=['POST'])
@login_required
def complete_mobile_door(door_id):
    """Marks a single door as complete from the mobile interface."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required.'}), 400

        job_id = data.get('job_id')
        signature_data = data.get('signature')
        signer_name = data.get('signer_name', current_user.get_full_name())
        signer_title = data.get('signer_title', 'Site Contact')

        if not job_id or not signature_data:
            return jsonify({'error': 'job_id and signature are required fields.'}), 400

        job = Job.query.get_or_404(job_id)
        door = Door.query.get_or_404(door_id)

        if door.bid_id != job.bid_id:
            return jsonify({'error': 'This door does not belong to the specified job.'}), 400

        existing_signature = JobSignature.query.filter_by(
            job_id=job_id,
            door_id=door_id,
            signature_type='door_complete'
        ).first()

        if existing_signature:
            logger.warning(f"Attempted to re-complete door {door_id} for job {job_id}.")
            return jsonify({'success': True, 'message': 'Door was already marked as complete.'}), 200

        new_signature = JobSignature(
            job_id=job_id,
            door_id=door_id,
            user_id=current_user.id,
            signature_type='door_complete',
            signature_data=signature_data,
            signer_name=signer_name,
            signer_title=signer_title
        )
        db.session.add(new_signature)
        db.session.commit()

        logger.info(f"User {current_user.username} completed door {door_id} for job {job_id}.")

        return jsonify({
            'success': True,
            'message': f'Door {door_id} marked as complete.',
            'signature_id': new_signature.id
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error completing door {door_id}: {e}", exc_info=True)
        return jsonify({'error': 'An internal server error occurred while completing the door.'}), 500

@mobile_bp.route('/doors/<int:door_id>/media', methods=['GET'])
@login_required
def get_door_media(door_id):
    """
    Get all media (photos and videos) for a specific door on a specific job.
    This version provides a clean list of media objects with IDs, which the
    frontend will use to construct the correct request URLs.
    """
    job_id = request.args.get('job_id')
    if not job_id:
        return jsonify({'error': 'job_id query parameter is required'}), 400

    try:
        media_items = DoorMedia.query.filter_by(
            job_id=int(job_id),
            door_id=door_id
        ).order_by(DoorMedia.uploaded_at.asc()).all()
        
        photos = []
        videos = []
        for item in media_items:
            # Create a clean dictionary. The frontend only needs the ID to build the URL.
            media_dict = {
                'id': item.id,
                'uploaded_at': item.uploaded_at.isoformat()
            }
            
            # We don't need to build a 'file_url' here because the frontend does it correctly.
            # Just sort the media object into the correct list.
            if item.media_type == 'photo':
                photos.append(media_dict)
            elif item.media_type == 'video':
                videos.append(media_dict)

        return jsonify({'photos': photos, 'videos': videos}), 200

    except Exception as e:
        logger.error(f"Error fetching media for door {door_id} on job {job_id}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to retrieve media.'}), 500
@mobile_bp.route('/jobs/<int:job_id>/time-tracking', methods=['GET'])
@login_required
def get_job_time_tracking(job_id):
    """
    Get all time tracking sessions for a specific job.
    """
    try:
        sessions = JobTimeTracking.query.filter_by(job_id=job_id).order_by(JobTimeTracking.start_time.asc()).all()

        total_minutes = 0
        job_timing_status = 'not_started'
        last_status = None

        session_data = []
        for s in sessions:
            duration_minutes = 0
            if s.end_time:
                duration_minutes = int((s.end_time - s.start_time).total_seconds() / 60)
                total_minutes += duration_minutes

            session_data.append({
                'id': s.id,
                'user_id': s.user_id,
                'start_time': s.start_time.isoformat(),
                'end_time': s.end_time.isoformat() if s.end_time else None,
                'status': s.status,
                'duration_minutes': duration_minutes
            })
            last_status = s.status

        if last_status == 'active':
            job_timing_status = 'started'
        elif last_status == 'paused':
            job_timing_status = 'paused'
        elif last_status == 'completed' and sessions:
             job_timing_status = 'completed'
        elif sessions:
             job_timing_status = 'started'

        return jsonify({
            'job_id': job_id,
            'sessions': session_data,
            'total_minutes': total_minutes,
            'job_timing_status': job_timing_status
        }), 200

    except Exception as e:
        logger.error(f"Error fetching time tracking for job {job_id}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to retrieve time tracking data.'}), 500


# Add this route to your mobile.py file to replace/update the existing media serving route

@mobile_bp.route('/media/<int:media_id>/<string:media_type>', methods=['GET'])
def get_media_file(media_id, media_type):
    """
    Serves a specific media file by looking up its path in the database
    and using the centrally configured UPLOAD_FOLDER.
    """
    try:
        media_record = DoorMedia.query.get(media_id)

        if not media_record:
            logger.error(f"DATABASE MISS: Media with ID {media_id} not found.")
            abort(404)

        if media_record.media_type != media_type:
            logger.error(f"TYPE MISMATCH: Requested '{media_type}' for media ID {media_id}, but DB says it is a '{media_record.media_type}'.")
            abort(404)

        # Get the upload folder from config
        upload_directory = current_app.config.get('UPLOAD_FOLDER')
        if not upload_directory:
            logger.error("UPLOAD_FOLDER not configured in app config")
            abort(500)

        relative_file_path = media_record.file_path
        full_file_path = os.path.join(upload_directory, relative_file_path)

        logger.info(f"Serving request for media ID {media_id}")
        logger.info(f"Upload directory: {upload_directory}")
        logger.info(f"Relative file path: {relative_file_path}")
        logger.info(f"Full file path: {full_file_path}")
        logger.info(f"File exists: {os.path.exists(full_file_path)}")

        # Check if file exists
        if not os.path.exists(full_file_path):
            logger.error(f"PHYSICAL FILE NOT FOUND: {full_file_path}")
            
            # Try to find the file in alternative locations
            alternative_paths = [
                os.path.join(os.getcwd(), 'uploads', relative_file_path),
                os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads', relative_file_path),
                os.path.join('backend', 'uploads', relative_file_path)
            ]
            
            for alt_path in alternative_paths:
                logger.info(f"Trying alternative path: {alt_path}")
                if os.path.exists(alt_path):
                    logger.info(f"Found file at alternative path: {alt_path}")
                    directory = os.path.dirname(alt_path)
                    filename = os.path.basename(alt_path)
                    return send_from_directory(directory, filename)
            
            abort(404)

        # Use send_from_directory for security
        directory = os.path.dirname(full_file_path)
        filename = os.path.basename(full_file_path)
        
        logger.info(f"Serving from directory: {directory}, filename: {filename}")
        
        return send_from_directory(directory, filename)

    except Exception as e:
        logger.error(f"Error serving media file {media_id}: {str(e)}", exc_info=True)
        abort(500)


# Also add this debugging route to check what's in the database
@mobile_bp.route('/debug/media/<int:job_id>', methods=['GET'])
def debug_media_for_job(job_id):
    """Debug route to see what media records exist for a job"""
    try:
        media_records = DoorMedia.query.filter_by(job_id=job_id).all()
        
        debug_info = {
            'job_id': job_id,
            'upload_folder': current_app.config.get('UPLOAD_FOLDER'),
            'current_working_directory': os.getcwd(),
            'media_records': []
        }
        
        for record in media_records:
            full_path = os.path.join(current_app.config.get('UPLOAD_FOLDER', ''), record.file_path)
            debug_info['media_records'].append({
                'id': record.id,
                'door_id': record.door_id,
                'media_type': record.media_type,
                'file_path': record.file_path,
                'full_path': full_path,
                'file_exists': os.path.exists(full_path),
                'uploaded_at': record.uploaded_at.isoformat() if record.uploaded_at else None
            })
        
        return jsonify(debug_info), 200
        
    except Exception as e:
        logger.error(f"Error in debug route: {e}")
        return jsonify({'error': str(e)}), 500