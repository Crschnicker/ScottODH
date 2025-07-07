from flask import Blueprint, request, jsonify
from flask_login import login_required
from datetime import datetime, date
from models import db, Job, User  # We only need Job and User now for this logic
import logging

dispatch_bp = Blueprint('dispatch', __name__)
logger = logging.getLogger(__name__)

def serialize_job_for_dispatch(job):
    """
    Safely serializes a Job object for the Dispatch Calendar.
    Gets the region directly from the Job model.
    """
    customer_name = 'N/A'
    address = 'N/A'
    contact_name = None
    phone = None
    estimated_hours = None

    if job.bid and job.bid.estimate:
        if job.bid.estimate.customer_direct_link:
            customer_name = job.bid.estimate.customer_direct_link.name
        
        site = job.bid.estimate.site
        if site:
            # Get site-specific info
            address = getattr(site, 'address', address)
            contact_name = getattr(site, 'contact_name', contact_name)
            phone = getattr(site, 'phone', phone)

        # Get estimate-specific info
        estimated_hours = getattr(job.bid.estimate, 'estimated_hours', None)

    return {
        'id': job.id,
        'job_number': job.job_number,
        'customer_name': customer_name,
        'address': address,
        'contact_name': contact_name,
        'phone': phone,
        'job_scope': job.job_scope,
        'estimated_hours': estimated_hours,
        'material_ready': job.material_ready,
        'material_location': job.material_location,
        
        # *** THE FIX IS HERE: Get region directly from the job object ***
        'region': job.region,
        
        'status': job.status,
        'scheduled_date': job.scheduled_date.isoformat() if job.scheduled_date else None,
        'is_visible': job.is_visible,
        'job_order': job.job_order
    }
@dispatch_bp.route('/<string:date_str>', methods=['GET'])
@login_required
def get_dispatch_for_date(date_str):
    """
    Get dispatch assignments for a specific date by reading directly from the Job model.
    This ensures consistency with the save logic.
    """
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        # 1. Get all field users to prepare the truck columns.
        field_users = User.query.filter_by(role='field').all()
        
        # 2. Initialize the response structure.
        unassigned_jobs = []
        truck_assignments = {user.username: [] for user in field_users}
        
        # 3. Fetch all jobs scheduled for the target date. The Job model is our single source of truth.
        all_jobs_on_date = Job.query.filter(
            Job.scheduled_date == target_date
        ).order_by(Job.job_order).all()
        
        # 4. Process the jobs and place them in the correct column.
        for job in all_jobs_on_date:
            job_data = serialize_job_for_dispatch(job)
            
            # Check if the job has a truck assignment.
            if job.truck_assignment and job.truck_assignment in truck_assignments:
                # Job is assigned to a valid truck, add it to that truck's list.
                truck_assignments[job.truck_assignment].append(job_data)
            else:
                # Job has no assignment or an invalid one, it's unassigned.
                unassigned_jobs.append(job_data)
        
        # Sort jobs within each truck column by their order (already done by query, but good practice).
        for truck in truck_assignments:
            truck_assignments[truck].sort(key=lambda j: j.get('job_order', 999))

        logger.info(f"Dispatch data for {date_str} fetched. Unassigned: {len(unassigned_jobs)}. Trucks: { {k: len(v) for k, v in truck_assignments.items()} }")

        return jsonify({
            'unassigned': unassigned_jobs,
            'trucks': truck_assignments
        }), 200

    except ValueError:
        logger.error(f"Invalid date format for dispatch: {date_str}")
        return jsonify({'error': 'Invalid date format. Expected YYYY-MM-DD.'}), 400
    except Exception as e:
        logger.exception(f"Error fetching dispatch data for {date_str}")
        return jsonify({'error': f'Failed to retrieve dispatch data: {str(e)}'}), 500


@dispatch_bp.route('', methods=['POST'])
@login_required
def save_dispatch_assignments():
    """
    Saves dispatch assignments for a specific date by directly updating the Job model.
    This provides a single source of truth for the mobile/field interface.
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    dispatch_date_str = data.get('date')
    assignments_list = data.get('assignments')

    if not dispatch_date_str or not isinstance(assignments_list, list):
        return jsonify({'error': 'A valid date and assignments list are required'}), 400

    try:
        dispatch_date = datetime.strptime(dispatch_date_str, '%Y-%m-%d').date()

        # 1. Get all jobs that are currently scheduled for the target date.
        jobs_for_day = Job.query.filter(Job.scheduled_date == dispatch_date).all()
        job_map = {job.id: job for job in jobs_for_day}

        # 2. Reset all jobs for this day to a default "unassigned" state.
        for job in jobs_for_day:
            job.truck_assignment = None
            job.job_order = 0
            job.is_visible = False

        assignments_saved_count = 0
        # 3. Iterate through the assignments from the frontend and apply them.
        for assignment in assignments_list:
            job_id = assignment.get('job_id')
            
            job_to_update = job_map.get(job_id)

            if job_to_update:
                job_to_update.truck_assignment = assignment.get('truck_assignment')
                job_to_update.job_order = assignment.get('job_order', 0)
                job_to_update.is_visible = assignment.get('is_visible', False)

                if job_to_update.status in ['unscheduled', 'unassigned', None]:
                    job_to_update.status = 'scheduled'
                
                assignments_saved_count += 1
            else:
                logger.warning(
                    f"Dispatch Save: Job ID {job_id} was in the assignment list "
                    f"but is not scheduled for {dispatch_date_str}. Ignoring this assignment."
                )

        # 4. Commit all changes to the database in a single transaction.
        db.session.commit()

        logger.info(f"Successfully saved {assignments_saved_count} dispatch assignments for {dispatch_date_str}.")
        return jsonify({
            'success': True,
            'message': f'Dispatch for {dispatch_date_str} saved successfully.',
            'count': assignments_saved_count
        }), 200

    except ValueError:
        return jsonify({'error': 'Invalid date format. Please use YYYY-MM-DD.'}), 400
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Fatal error saving dispatch for {dispatch_date_str}")
        return jsonify({'error': f'An internal server error occurred: {str(e)}'}), 500