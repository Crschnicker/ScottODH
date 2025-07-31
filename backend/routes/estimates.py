# backend/routes/estimates.py
from flask import Blueprint, request, jsonify
from flask_login import login_required
from datetime import datetime
from models import db, Estimate, Customer, Site
import logging
import json

estimates_bp = Blueprint('estimates', __name__)
logger = logging.getLogger(__name__)

@estimates_bp.route('', methods=['GET'])
@login_required
def get_estimates():
    """Get all estimates with customer information"""
    try:
        estimates = Estimate.query.all()
        result = []
        
        for estimate in estimates:
            estimate_data = {
                'id': estimate.id,
                'customer_id': estimate.customer_id,
                'customer_name': estimate.customer_direct_link.name if estimate.customer_direct_link else 'Unknown',
                'site_id': estimate.site_id,
                'site_name': estimate.site.name if estimate.site else None,
                'site_address': estimate.site.address if estimate.site else None,
                'status': estimate.status,
                'estimated_hours': estimate.estimated_hours,
                'created_at': estimate.created_at.isoformat() if estimate.created_at else None,
                'doors_count': len(json.loads(estimate.doors_data)) if estimate.doors_data else 0,
                # Also return schedule info for the main list
                'scheduled_date': estimate.scheduled_date.isoformat() if estimate.scheduled_date else None,
                'estimator_name': estimate.estimator_name
            }
            result.append(estimate_data)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error retrieving estimates: {str(e)}")
        return jsonify({'error': 'Failed to retrieve estimates'}), 500

@estimates_bp.route('/<int:estimate_id>', methods=['GET'])
@login_required
def get_estimate(estimate_id):
    """Get a specific estimate with all details"""
    try:
        estimate = Estimate.query.get_or_404(estimate_id)
        
        doors_data = []
        if estimate.doors_data:
            try:
                doors_data = json.loads(estimate.doors_data)
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON in doors_data for estimate {estimate_id}")
                doors_data = []
        
        return jsonify({
            'id': estimate.id,
            'customer_id': estimate.customer_id,
            'customer_name': estimate.customer_direct_link.name if estimate.customer_direct_link else 'Unknown',
            'site_id': estimate.site_id,
            'site_name': estimate.site.name if estimate.site else None,
            'site_address': estimate.site.address if estimate.site else None,
            'status': estimate.status,
            'estimated_hours': estimate.estimated_hours,
            'doors_data': doors_data,
            'created_at': estimate.created_at.isoformat() if estimate.created_at else None,
            'scheduled_date': estimate.scheduled_date.isoformat() if estimate.scheduled_date else None,
            'estimator_name': estimate.estimator_name,
            'duration': estimate.duration,
            'schedule_notes': estimate.schedule_notes
        })
    except Exception as e:
        logger.error(f"Error retrieving estimate {estimate_id}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve estimate'}), 500

@estimates_bp.route('', methods=['POST'])
@login_required
def create_estimate():
    """Create a new estimate"""
    try:
        data = request.json
        
        # Validate required fields
        if not data.get('customer_id'):
            return jsonify({'error': 'Customer ID is required'}), 400
        
        # Verify customer exists
        customer = Customer.query.get(data['customer_id'])
        if not customer:
            return jsonify({'error': 'Customer not found'}), 404
        
        # Verify site exists if provided
        site_id = data.get('site_id')
        if site_id:
            site = Site.query.get(site_id)
            if not site:
                return jsonify({'error': 'Site not found'}), 404
            if site.customer_id != data['customer_id']:
                return jsonify({'error': 'Site does not belong to the specified customer'}), 400
        
        estimate = Estimate(
            customer_id=data['customer_id'],
            site_id=site_id,
            status=data.get('status', 'pending'),
            estimated_hours=data.get('estimated_hours', 0),
            doors_data=json.dumps(data.get('doors_data', []))
        )
        
        db.session.add(estimate)
        db.session.commit()
        
        return jsonify({
            'id': estimate.id,
            'customer_id': estimate.customer_id,
            'customer_name': estimate.customer_direct_link.name,
            'site_id': estimate.site_id,
            'status': estimate.status,
            'estimated_hours': estimate.estimated_hours,
            'created_at': estimate.created_at.isoformat()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating estimate: {str(e)}")
        return jsonify({'error': 'Failed to create estimate'}), 500

# --- NEW ROUTE TO HANDLE SCHEDULING ---
@estimates_bp.route('/<int:estimate_id>/schedule', methods=['POST'])
@login_required
def schedule_estimate(estimate_id):
    """Schedule an estimate by updating its date, status, and other details"""
    try:
        estimate = Estimate.query.get_or_404(estimate_id)
        data = request.json

        if not data.get('scheduled_date'):
            return jsonify({'error': 'Scheduled date is required'}), 400

        # The frontend sends an ISO string (e.g., "2025-08-01T13:00:00.000Z")
        # Python's fromisoformat can parse this if we handle the 'Z' suffix
        iso_date_string = data['scheduled_date']
        if iso_date_string.endswith('Z'):
            iso_date_string = iso_date_string[:-1] + '+00:00'
        
        # Update the estimate record
        estimate.scheduled_date = datetime.fromisoformat(iso_date_string)
        estimate.estimator_name = data.get('estimator_name')
        estimate.estimator_id = data.get('estimator_id')
        estimate.duration = data.get('duration')
        estimate.schedule_notes = data.get('schedule_notes')
        estimate.status = 'scheduled'  # Update the status to 'scheduled'

        db.session.commit()

        # Return the complete, updated estimate object. The frontend will use this
        # to update its state, so it needs all the fields it displays.
        return jsonify({
            'id': estimate.id,
            'customer_id': estimate.customer_id,
            'customer_name': estimate.customer_direct_link.name,
            'site_id': estimate.site_id,
            'site_name': estimate.site.name if estimate.site else None,
            'site_address': estimate.site.address if estimate.site else None,
            'status': estimate.status,
            'estimated_hours': estimate.estimated_hours,
            'created_at': estimate.created_at.isoformat(),
            'doors_count': len(json.loads(estimate.doors_data)) if estimate.doors_data else 0,
            'scheduled_date': estimate.scheduled_date.isoformat(),
            'estimator_name': estimate.estimator_name,
            'duration': estimate.duration,
            'schedule_notes': estimate.schedule_notes
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error scheduling estimate {estimate_id}: {str(e)}")
        return jsonify({'error': 'Failed to schedule estimate'}), 500
# ------------------------------------

@estimates_bp.route('/<int:estimate_id>', methods=['PUT'])
@login_required
def update_estimate(estimate_id):
    """Update an existing estimate"""
    try:
        estimate = Estimate.query.get_or_404(estimate_id)
        data = request.json
        
        # Update fields if provided
        if 'status' in data:
            estimate.status = data['status']
        if 'estimated_hours' in data:
            estimate.estimated_hours = data['estimated_hours']
        if 'doors_data' in data:
            estimate.doors_data = json.dumps(data['doors_data'])
        
        db.session.commit()
        
        return jsonify({
            'id': estimate.id,
            'customer_id': estimate.customer_id,
            'customer_name': estimate.customer_direct_link.name,
            'site_id': estimate.site_id,
            'status': estimate.status,
            'estimated_hours': estimate.estimated_hours,
            'created_at': estimate.created_at.isoformat()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating estimate {estimate_id}: {str(e)}")
        return jsonify({'error': 'Failed to update estimate'}), 500

@estimates_bp.route('/<int:estimate_id>', methods=['DELETE'])
@login_required
def delete_estimate(estimate_id):
    """Delete an estimate"""
    try:
        estimate = Estimate.query.get_or_404(estimate_id)
        
        # Check if estimate has associated bids
        if hasattr(estimate, 'bids') and estimate.bids:
            return jsonify({'error': 'Cannot delete estimate with associated bids'}), 400
        
        db.session.delete(estimate)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Estimate {estimate_id} deleted successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting estimate {estimate_id}: {str(e)}")
        return jsonify({'error': 'Failed to delete estimate'}), 500