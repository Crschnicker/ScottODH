# backend/routes/jobs.py
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime
from models import db, Job, Bid, Estimate, Customer, CompletedDoor, DispatchAssignment
from services.date_utils import parse_job_date, format_date_for_response
import logging

jobs_bp = Blueprint('jobs', __name__)
logger = logging.getLogger(__name__)

@jobs_bp.route('', methods=['GET'])
@login_required
def get_jobs():
    """Get all jobs with optional filtering and consistent date formatting"""
    try:
        region = request.args.get('region')
        status = request.args.get('status')
        search = request.args.get('search', '')
        scheduled_date = request.args.get('scheduled_date')
        
        # Build query with filters
        query = Job.query
        
        if region: 
            query = query.filter_by(region=region)
        
        if status: 
            query = query.filter_by(status=status)
        
        if search:
            query = query.join(Bid).join(Estimate).join(Customer, Estimate.customer_id == Customer.id).filter(
                (Job.job_number.like(f'%{search}%')) |
                (Customer.name.like(f'%{search}%')) |
                (Job.job_scope.like(f'%{search}%'))
            )
        
        # Handle date filtering
        if scheduled_date:
            try:
                parsed_date = parse_job_date(scheduled_date)
                query = query.filter(Job.scheduled_date == parsed_date)
                logger.info(f"Filtering jobs by scheduled_date: {parsed_date}")
            except ValueError as e:
                logger.error(f"Invalid date format for scheduled_date filter: {e}")
        
        jobs = query.all()
        
        # Format response with consistent date handling
        result = []
        for job in jobs:
            result.append({
                'id': job.id,
                'job_number': job.job_number,
                'customer_name': job.bid.estimate.customer_direct_link.name,
                'address': job.bid.estimate.site.address if job.bid.estimate.site else None,
                'job_scope': job.job_scope,
                'scheduled_date': format_date_for_response(job.scheduled_date),
                'status': job.status,
                'material_ready': job.material_ready,
                'material_location': job.material_location,
                'region': job.region
            })
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error retrieving jobs: {str(e)}")
        return jsonify({'error': f'Failed to retrieve jobs: {str(e)}'}), 500

@jobs_bp.route('/<int:job_id>', methods=['GET'])
@login_required
def get_job(job_id):
    """Get a job by ID with consistent date formatting"""
    try:
        job = Job.query.get_or_404(job_id)
        
        result = {
            'id': job.id,
            'job_number': job.job_number,
            'customer_name': job.bid.estimate.customer_direct_link.name,
            'address': job.bid.estimate.site.address if job.bid.estimate.site else None,
            'contact_name': job.bid.estimate.site.contact_name if job.bid.estimate.site else None,
            'phone': job.bid.estimate.site.phone if job.bid.estimate.site else None,
            'job_scope': job.job_scope,
            'scheduled_date': format_date_for_response(job.scheduled_date),
            'status': job.status,
            'material_ready': job.material_ready,
            'material_location': job.material_location,
            'region': job.region
        }
        
        # Get doors information
        doors = []
        for door_model in job.bid.doors:
            completed = CompletedDoor.query.filter_by(job_id=job.id, door_id=door_model.id).first()
            doors.append({
                'id': door_model.id,
                'door_number': door_model.door_number,
                'completed': completed is not None,
                'completed_at': completed.completed_at.isoformat() if completed and completed.completed_at else None
            })
        
        result['doors'] = doors
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error retrieving job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to retrieve job: {str(e)}'}), 500

@jobs_bp.route('/<int:job_id>/schedule', methods=['POST'])
@login_required
def schedule_job(job_id):
    """Schedule a job with proper date handling"""
    try:
        job = Job.query.get_or_404(job_id)
        data = request.json
        
        logger.info(f"Received job scheduling data for job {job_id}: {data}")
        
        scheduled_date_str = data.get('scheduled_date')
        
        if scheduled_date_str:
            try:
                parsed_date = parse_job_date(scheduled_date_str)
                job.scheduled_date = parsed_date
                job.status = 'scheduled'
                
                logger.info(f"Scheduled job {job_id} for date: {job.scheduled_date}")
            except ValueError as e:
                logger.error(f"Date parsing error for job {job_id}: {str(e)}")
                return jsonify({'error': f'Invalid date format: {str(e)}'}), 400
        
        # Update other job fields
        job.material_ready = data.get('material_ready', job.material_ready)
        job.material_location = data.get('material_location', job.material_location)
        job.region = data.get('region', job.region)
        job.job_scope = data.get('job_scope', job.job_scope)
        
        db.session.commit()
        
        result = {
            'id': job.id,
            'job_number': job.job_number,
            'scheduled_date': format_date_for_response(job.scheduled_date),
            'status': job.status,
            'material_ready': job.material_ready,
            'material_location': job.material_location,
            'region': job.region,
            'job_scope': job.job_scope
        }
        
        logger.info(f"Job scheduling response: {result}")
        
        return jsonify(result), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error scheduling job {job_id}: {str(e)}")
        return jsonify({'error': f'Failed to schedule job: {str(e)}'}), 500

@jobs_bp.route('/<int:job_id>/status', methods=['PUT'])
@login_required
def update_job_status(job_id):
    """Update job status"""
    try:
        if request.method == 'OPTIONS':
            return '', 200

        job = Job.query.get_or_404(job_id)
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
            
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({'error': 'status is required'}), 400
        
        valid_statuses = ['unscheduled', 'scheduled', 'in_progress', 'completed', 'cancelled', 'waiting_for_parts', 'on_hold']
        if new_status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {valid_statuses}'}), 400
        
        old_status = job.status
        job.status = new_status
        
        db.session.commit()
        
        logger.info(f"Job {job_id} status updated from '{old_status}' to '{new_status}' by user {current_user.username}")
        
        db.session.refresh(job)

        job_data = {
            'id': job.id,
            'job_number': job.job_number,
            'customer_name': job.bid.estimate.customer_direct_link.name,
            'status': job.status,
            'scheduled_date': job.scheduled_date.isoformat() if job.scheduled_date else None,
            'address': job.bid.estimate.site.address,
            'contact_name': job.bid.estimate.site.contact_name,
            'phone': job.bid.estimate.site.phone,
            'region': job.region,
            'job_scope': job.job_scope,
            'material_ready': job.material_ready,
            'material_location': job.material_location,
            'created_at': job.created_at.isoformat() if job.created_at else None,
            'updated_at': job.updated_at.isoformat() if job.updated_at else None,
            'doors': []
        }
        
        if job.bid and job.bid.doors:
            for door in job.bid.doors:
                completed_door = CompletedDoor.query.filter_by(job_id=job.id, door_id=door.id).first()
                door_data = {
                    'id': door.id,
                    'door_number': door.door_number,
                    'location': door.location,
                    'door_type': door.door_type,
                    'completed': completed_door is not None,
                    'completed_at': completed_door.completed_at.isoformat() if completed_door and completed_door.completed_at else None,
                }
                job_data['doors'].append(door_data)
        
        return jsonify(job_data), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating job status for job {job_id}: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update job status: {str(e)}'}), 500

@jobs_bp.route('/<int:job_id>/cancel', methods=['POST'])
@login_required
def cancel_job(job_id):
    """Cancel a job by setting its status to 'cancelled'"""
    try:
        job = Job.query.get_or_404(job_id)
        
        if job.status == 'cancelled':
            return jsonify({
                'id': job.id, 
                'job_number': job.job_number, 
                'status': job.status,
                'message': 'Job was already cancelled'
            }), 200
        
        data = request.json or {}
        cancellation_reason = data.get('reason', '')
        
        job.status = 'cancelled'
        
        if cancellation_reason:
            if job.job_scope:
                job.job_scope = f"{job.job_scope}\n\nCANCELLATION NOTE: {cancellation_reason}"
            else:
                job.job_scope = f"CANCELLATION NOTE: {cancellation_reason}"
        
        # Optional: Record cancellation timestamp
        job.cancelled_at = datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f"Job {job_id} (Job #{job.job_number}) cancelled successfully.")
        
        return jsonify({
            'id': job.id,
            'job_number': job.job_number,
            'status': job.status,
            'message': 'Job cancelled successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error cancelling job {job_id}: {str(e)}")
        
        return jsonify({
            'error': f'Failed to cancel job: {str(e)}',
            'error_type': type(e).__name__
        }), 500

@jobs_bp.route('/<int:job_id>/doors/<int:door_id>/complete', methods=['POST'])
@login_required
def complete_door(job_id, door_id):
    """Complete a door for a job"""
    try:
        job = Job.query.get_or_404(job_id)
        door_instance = Door.query.get_or_404(door_id)
        data = request.json
        
        photo_path = f"uploads/{job.job_number}/door_{door_instance.door_number}_photo.jpg"
        video_path = f"uploads/{job.job_number}/door_{door_instance.door_number}_video.mp4"
        
        completed_door = CompletedDoor(
            job_id=job_id,
            door_id=door_id,
            signature=data.get('signature', ''),
            photo_path=photo_path,
            video_path=video_path
        )
        db.session.add(completed_door)
        
        total_doors = len(job.bid.doors)
        completed_doors_count = CompletedDoor.query.filter_by(job_id=job_id).count() + 1
        
        if completed_doors_count >= total_doors:
            job.status = 'completed'
        
        db.session.commit()
        
        return jsonify({
            'id': completed_door.id,
            'job_id': completed_door.job_id,
            'door_id': completed_door.door_id,
            'completed_at': completed_door.completed_at,
            'all_completed': completed_doors_count >= total_doors
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error completing door {door_id} for job {job_id}: {str(e)}")
        return jsonify({'error': 'Failed to complete door'}), 500

# Dispatch management routes
@jobs_bp.route('/dispatch/<string:date_str>', methods=['GET'])
@login_required
def get_dispatch_for_date(date_str):
    """Get all jobs for a specific date, organized by unassigned and truck assignments"""
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD.'}), 400

    # Get all jobs scheduled for the target date
    scheduled_jobs = Job.query.filter(
        Job.scheduled_date == target_date,
        Job.status.notin_(['completed', 'cancelled'])
    ).all()

    # Get all assignments for that date
    assignments = DispatchAssignment.query.filter_by(assignment_date=target_date).all()
    assigned_job_ids = {a.job_id for a in assignments}
    
    # Find unassigned jobs
    unassigned_jobs = [
        job for job in scheduled_jobs if job.id not in assigned_job_ids
    ]
    
    # Organize assigned jobs by truck
    trucks = {}
    for assignment in assignments:
        job = next((j for j in scheduled_jobs if j.id == assignment.job_id), None)
        if not job:
            continue

        truck_id_str = str(assignment.truck_id)
        if truck_id_str not in trucks:
            trucks[truck_id_str] = []
        
        serialized_job = serialize_job_for_dispatch(job, assignment)
        if serialized_job:
            trucks[truck_id_str].append(serialized_job)
            
    # Sort jobs within each truck by their order
    for truck_id_str in trucks:
        trucks[truck_id_str].sort(key=lambda x: x.get('job_order', 0))

    serialized_unassigned = [serialize_job_for_dispatch(j) for j in unassigned_jobs]
    
    response_data = {
        'unassigned': [j for j in serialized_unassigned if j is not None],
        'trucks': trucks
    }
    
    return jsonify(response_data)

@jobs_bp.route('/dispatch', methods=['POST'])
@login_required
def save_dispatch_for_date():
    """Save the entire dispatch board state for a given date"""
    data = request.get_json()
    date_str = data.get('date')
    assignments_data = data.get('assignments', [])

    if not date_str:
        return jsonify({'error': 'Date is required.'}), 400

    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD.'}), 400

    try:
        # Delete all existing assignments for the target date
        DispatchAssignment.query.filter_by(assignment_date=target_date).delete()

        # Create new assignments from the request
        for item in assignments_data:
            new_assignment = DispatchAssignment(
                assignment_date=target_date,
                job_id=item['job_id'],
                truck_id=item['truck_id'],
                job_order=item['job_order'],
                is_visible=item.get('is_visible', True)
            )
            db.session.add(new_assignment)
        
        db.session.commit()
        return jsonify({'success': True, 'message': f'Dispatch for {date_str} saved successfully.'}), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error saving dispatch for {date_str}: {e}", exc_info=True)
        return jsonify({'error': 'An internal error occurred while saving the dispatch board.'}), 500

def serialize_job_for_dispatch(job, assignment=None):
    """Helper to format job data for the dispatch board"""
    if not job or not job.bid or not job.bid.estimate or not job.bid.estimate.site:
        return None
    
    data = {
        'id': job.id,
        'job_number': job.job_number,
        'customer_name': job.bid.estimate.customer_direct_link.name,
        'address': job.bid.estimate.site.address,
        'contact_name': job.bid.estimate.site.contact_name,
        'phone': job.bid.estimate.site.phone,
        'job_scope': job.job_scope,
        'estimated_hours': job.bid.estimate.estimated_hours,
        'material_ready': job.material_ready,
        'material_location': job.material_location,
        'region': job.region,
        'status': job.status,
    }
    
    if assignment:
        data['is_visible'] = assignment.is_visible
        data['job_order'] = assignment.job_order
    
    return data