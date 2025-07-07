# backend/routes/estimates.py

from flask import Blueprint, request, jsonify
from flask_login import login_required
from datetime import datetime
from models import db, Estimate, Customer, Site, AudioRecording
from services.date_utils import parse_datetime_with_logging
from services.audio_service import transcribe_audio_file, process_audio_with_ai
import logging
import json
import uuid
import os

estimates_bp = Blueprint('estimates', __name__)
logger = logging.getLogger(__name__)

@estimates_bp.route('', methods=['GET'])
@login_required
def get_estimates():
    """Get all estimates with related customer and site info."""
    try:
        estimates_query = Estimate.query.options(
            db.joinedload(Estimate.customer_direct_link),
            db.joinedload(Estimate.site)
        ).order_by(Estimate.created_at.desc()).all()
        
        # Use the to_dict() method for clean serialization
        result = [est.to_dict() for est in estimates_query]
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error retrieving estimates: {e}", exc_info=True)
        return jsonify({'error': 'Failed to retrieve estimates.'}), 500


@estimates_bp.route('', methods=['POST'])
@login_required
def create_estimate():
    """Create a new estimate. This function is now fully aligned with the updated model."""
    try:
        data = request.json
        logger.info(f"Received request to create estimate with data: {data}")
        
        customer_id = data.get('customer_id')
        site_id = data.get('site_id')

        if not customer_id or not site_id:
            return jsonify({'error': 'customer_id and site_id are required fields.'}), 400

        # Verify that the customer and site exist
        if not db.session.get(Customer, customer_id):
            return jsonify({'error': f'Customer with id {customer_id} not found.'}), 404
        if not db.session.get(Site, site_id):
            return jsonify({'error': f'Site with id {site_id} not found.'}), 404
        
        # Parse the scheduled date and time if provided
        scheduled_date_obj = None
        if data.get('scheduled_date'):
            try:
                # Assuming 'scheduled_date' is in a format parse_datetime_with_logging can handle
                scheduled_date_obj = parse_datetime_with_logging(data['scheduled_date'])
            except (ValueError, TypeError) as e:
                logger.warning(f"Could not parse scheduled_date '{data.get('scheduled_date')}': {e}")

        # Create the new Estimate object, passing all fields from the request
        new_estimate = Estimate(
            customer_id=customer_id,
            site_id=site_id,
            status='pending',
            title=data.get('title'),
            description=data.get('description'),
            reference_number=data.get('reference_number'),
            estimated_hours=float(data.get('estimated_hours')) if data.get('estimated_hours') else None,
            estimated_cost=float(data.get('estimated_cost')) if data.get('estimated_cost') else None,
            notes=data.get('notes'),
            scheduled_date=scheduled_date_obj,
            estimator_id=int(data.get('estimator_id')) if data.get('estimator_id') else None,
            estimator_name=data.get('estimator_name'),
            duration=int(data.get('duration')) if data.get('duration') else None,
            schedule_notes=data.get('schedule_notes')
        )
        
        db.session.add(new_estimate)
        db.session.commit()
        
        logger.info(f"Successfully created new estimate with ID: {new_estimate.id}")
        # Return the newly created estimate using its to_dict() method
        return jsonify(new_estimate.to_dict()), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating estimate: {e}", exc_info=True)
        return jsonify({'error': 'An internal server error occurred while creating the estimate.'}), 500


@estimates_bp.route('/<int:estimate_id>', methods=['GET'])
@login_required
def get_estimate(estimate_id):
    """Get a single estimate by ID"""
    try:
        estimate = Estimate.query.get_or_404(estimate_id)
        
        try:
            doors = json.loads(estimate.doors_data) if estimate.doors_data else []
        except (json.JSONDecodeError, AttributeError):
            doors = []
        
        # Start with the base dictionary from to_dict()
        response_data = estimate.to_dict()
        # Add extra fields that aren't part of the base model
        response_data.update({
            'site_lockbox_location': estimate.site.lockbox_location if estimate.site else None,
            'site_contact_name': estimate.site.contact_name if estimate.site else None,
            'site_phone': estimate.site.phone if estimate.site else None,
            'doors': doors,
        })
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"Error retrieving estimate {estimate_id}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to retrieve estimate'}), 500


@estimates_bp.route('/<int:estimate_id>/doors', methods=['PUT'])
@login_required
def handle_estimate_doors(estimate_id):
    """Handle updating doors data for an estimate"""
    estimate = Estimate.query.get_or_404(estimate_id)
    
    try:
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
        
        data = request.get_json()
        if 'doors' not in data or not isinstance(data['doors'], list):
            return jsonify({'error': '`doors` array is required'}), 400
        
        processed_doors = []
        for i, door in enumerate(data['doors']):
            if not isinstance(door, dict):
                return jsonify({'error': f'Door at index {i} must be an object'}), 400
            
            processed_doors.append({
                'id': door.get('id', str(uuid.uuid4())),
                'door_number': door.get('door_number', i + 1),
                'description': door.get('description', ''),
                'details': door.get('details', [])
            })
        
        estimate.doors_data = json.dumps(processed_doors)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Successfully saved {len(processed_doors)} doors to estimate {estimate_id}.'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating doors for estimate {estimate_id}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to update doors'}), 500


@estimates_bp.route('/<int:estimate_id>/schedule', methods=['POST'])
@login_required
def schedule_estimate(estimate_id):
    """Schedule an estimate"""
    try:
        estimate = Estimate.query.get_or_404(estimate_id)
        data = request.json
        
        if not data.get('scheduled_date'):
            return jsonify({'error': 'scheduled_date is required'}), 400
            
        estimate.scheduled_date = parse_datetime_with_logging(data['scheduled_date'])
        estimate.estimator_id = data.get('estimator_id')
        estimate.estimator_name = data.get('estimator_name')
        estimate.duration = data.get('duration')
        estimate.schedule_notes = data.get('schedule_notes')
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Estimate scheduled successfully.'}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error scheduling estimate {estimate_id}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to schedule estimate'}), 500


@estimates_bp.route('/<int:estimate_id>/recordings', methods=['GET'])
@login_required
def get_recordings_for_estimate(estimate_id):
    """Get all recordings for a specific estimate"""
    try:
        if not Estimate.query.get(estimate_id):
            return jsonify({'error': 'Estimate not found'}), 404
            
        recordings = AudioRecording.query.filter_by(estimate_id=estimate_id).order_by(AudioRecording.created_at.asc()).all()
        return jsonify([rec.to_dict() for rec in recordings]) # Assuming AudioRecording has to_dict()
    except Exception as e:
        logger.error(f"Error getting recordings for estimate {estimate_id}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to retrieve recordings'}), 500


@estimates_bp.route('/<int:estimate_id>/recordings/<int:recording_id>/transcribe', methods=['POST'])
@login_required
def transcribe_estimate_audio(estimate_id, recording_id):
    """Transcribe an audio recording belonging to an estimate"""
    try:
        recording = AudioRecording.query.filter_by(id=recording_id, estimate_id=estimate_id).first_or_404()
        
        if not os.path.exists(recording.file_path):
            return jsonify({'error': 'Audio file not found on server'}), 404
        
        transcript = transcribe_audio_file(recording.file_path)
        recording.transcript = transcript
        db.session.commit()
        
        return jsonify(recording.to_dict()) # Assuming AudioRecording has to_dict()
    except Exception as e:
        logger.error(f"Transcription error for recording {recording_id}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@estimates_bp.route('/<int:estimate_id>/recordings/<int:recording_id>/process-ai', methods=['POST'])
@login_required
def process_estimate_audio_with_ai(estimate_id, recording_id):
    """Process an audio transcript with AI to extract door information"""
    try:
        recording = AudioRecording.query.filter_by(id=recording_id, estimate_id=estimate_id).first_or_404()
        
        if not recording.transcript:
            return jsonify({'error': 'No transcript available. Transcribe audio first.'}), 400
        
        doors = process_audio_with_ai(recording.transcript, recording.id)
        return jsonify({'doors': doors})
    except Exception as e:
        logger.error(f"AI processing error for recording {recording_id}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500