# backend/routes/door.py

from flask import Blueprint, request, jsonify
from flask_login import login_required
from models import db, Door, LineItem, DoorMedia, MobileJobLineItem, JobSignature, User
import logging
import os

doors_bp = Blueprint('doors', __name__)
logger = logging.getLogger(__name__)

@doors_bp.route('/<int:door_id>/line-items', methods=['POST'])
@login_required
def add_line_item(door_id):
    """Add a line item to a specific door"""
    try:
        door = Door.query.get_or_404(door_id)
        data = request.json
        if not data or 'description' not in data:
            return jsonify({'error': 'Description is required for a line item'}), 400
        line_item = LineItem(
            door_id=door_id,
            description=data.get('description'),
            quantity=data.get('quantity', 1),
            price=data.get('price', 0.0),
            labor_hours=data.get('labor_hours', 0.0),
            hardware=data.get('hardware', 0.0),
            part_number=data.get('part_number')
        )
        db.session.add(line_item)
        db.session.commit()
        return jsonify({
            'id': line_item.id,
            'door_id': line_item.door_id,
            'description': line_item.description,
            'quantity': line_item.quantity,
            'price': line_item.price,
            'message': 'Line item added successfully'
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding line item to door {door_id}: {e}")
        return jsonify({'error': f'Failed to add line item: {str(e)}'}), 500

@doors_bp.route('/<int:door_id>/actions', methods=['GET'])
@login_required
def get_door_actions(door_id):
    """
    Get all actions performed on a specific door for a specific job.
    This includes line item completions, media uploads, signatures, etc.
    """
    try:
        job_id = request.args.get('job_id')
        if not job_id:
            return jsonify({'error': 'job_id parameter is required'}), 400
        
        job_id = int(job_id)
        
        # Get all actions for this door and job
        actions = []
        
        # 1. Media uploads
        media_records = DoorMedia.query.filter_by(
            door_id=door_id, 
            job_id=job_id
        ).order_by(DoorMedia.uploaded_at.asc()).all()
        
        for media in media_records:
            uploader_name = "Unknown User"
            if media.uploader:
                uploader_name = media.uploader.get_full_name()
            
            actions.append({
                'type': 'media_upload',
                'media_type': media.media_type,
                'timestamp': media.uploaded_at.isoformat() if media.uploaded_at else None,
                'user_id': media.uploaded_by,
                'user_name': uploader_name,
                'media_id': media.id,
                'file_path': media.file_path
            })
        
        # 2. Signatures
        # Query signatures without ordering first to avoid the attribute error
        signatures = JobSignature.query.filter_by(
            job_id=job_id,
            door_id=door_id
        ).all()
        
        # Try to sort by various possible timestamp field names
        # Check what timestamp field actually exists on the JobSignature model
        try:
            # Try different common timestamp field names
            if hasattr(JobSignature, 'created_at'):
                signatures = sorted(signatures, key=lambda x: getattr(x, 'created_at', None) or '')
            elif hasattr(JobSignature, 'date_created'):
                signatures = sorted(signatures, key=lambda x: getattr(x, 'date_created', None) or '')
            elif hasattr(JobSignature, 'timestamp'):
                signatures = sorted(signatures, key=lambda x: getattr(x, 'timestamp', None) or '')
            elif hasattr(JobSignature, 'signed_at'):
                signatures = sorted(signatures, key=lambda x: getattr(x, 'signed_at', None) or '')
            # If no timestamp field exists, keep original order
        except Exception as sort_error:
            logger.warning(f"Could not sort signatures by timestamp: {sort_error}")
        
        for signature in signatures:
            signer_name = signature.signer_name or "Unknown"
            if signature.user:
                signer_name = signature.user.get_full_name()
            
            # Safely get timestamp from various possible fields
            timestamp = None
            for field_name in ['created_at', 'date_created', 'timestamp', 'signed_at']:
                if hasattr(signature, field_name):
                    field_value = getattr(signature, field_name)
                    if field_value:
                        timestamp = field_value.isoformat()
                        break
            
            actions.append({
                'type': 'signature',
                'signature_type': signature.signature_type,
                'timestamp': timestamp,
                'user_id': signature.user_id,
                'user_name': signer_name,
                'signer_name': signature.signer_name,
                'signer_title': signature.signer_title
            })
        
        # 3. Line item completions
        line_item_completions = MobileJobLineItem.query.filter_by(
            job_id=job_id
        ).filter(MobileJobLineItem.completed == True).all()
        
        # Filter to only include line items that belong to this door
        # (This requires checking the line_item's door_id)
        for completion in line_item_completions:
            if hasattr(completion, 'line_item') and completion.line_item:
                if completion.line_item.door_id == door_id:
                    completer_name = "Unknown User"
                    if completion.completed_by:
                        user = User.query.get(completion.completed_by)
                        if user:
                            completer_name = user.get_full_name()
                    
                    actions.append({
                        'type': 'line_item_completion',
                        'line_item_id': completion.line_item_id,
                        'line_item_description': completion.line_item.description if completion.line_item else None,
                        'part_number': completion.line_item.part_number if completion.line_item else None,
                        'quantity': completion.line_item.quantity if completion.line_item else 1,
                        'completed': completion.completed,
                        'timestamp': completion.completed_at.isoformat() if completion.completed_at else None,
                        'user_id': completion.completed_by,
                        'completed_by_name': completer_name
                    })
        
        # Sort all actions by timestamp
        actions.sort(key=lambda x: x['timestamp'] or '', reverse=False)
        
        return jsonify({
            'door_id': door_id,
            'job_id': job_id,
            'actions': actions,
            'total_actions': len(actions)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting actions for door {door_id}: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Failed to retrieve door actions',
            'door_id': door_id,
            'actions': [],
            'total_actions': 0
        }), 500
        
# In backend/routes/door.py

@doors_bp.route('/<int:door_id>/duplicate', methods=['POST'])
@login_required
def duplicate_door_config(door_id):
    """
    Duplicates the line items from a source door to one or more target doors.
    If a target door does not exist, it will be created.
    Expects a JSON body: { "target_door_numbers": [2, 3, 4] }
    """
    source_door = Door.query.get(door_id)
    if not source_door:
        return jsonify({"error": "Source door not found"}), 404

    data = request.get_json()
    if not data or 'target_door_numbers' not in data:
        return jsonify({"error": "Missing 'target_door_numbers' in request body"}), 400
    
    target_door_numbers = data.get('target_door_numbers', [])
    if not isinstance(target_door_numbers, list) or not target_door_numbers:
        return jsonify({"error": "'target_door_numbers' must be a non-empty list of integers"}), 400

    source_line_items = source_door.line_items
    if not source_line_items:
        return jsonify({
            "message": "Source door has no line items to duplicate.",
            "created_doors": [],
            "not_found": []
        }), 200

    updated_or_created_doors_info = []

    try:
        for door_num in target_door_numbers:
            # --- LOGIC CHANGE: FIND OR CREATE THE TARGET DOOR ---
            target_door = Door.query.filter_by(
                bid_id=source_door.bid_id, 
                door_number=door_num
            ).first()

            if not target_door:
                # If the door doesn't exist, create it.
                target_door = Door(
                    bid_id=source_door.bid_id,
                    door_number=door_num,
                    # You can copy other default fields from the source door if you wish
                    location=source_door.location, 
                    door_type=source_door.door_type
                )
                db.session.add(target_door)
                # We need to flush to ensure the door is in the session before adding line items
                db.session.flush()

            # --- END LOGIC CHANGE ---

            # Now, proceed with the copy. First, clear any existing line items.
            LineItem.query.filter_by(door_id=target_door.id).delete(synchronize_session=False)

            # Copy line items from source to the (found or new) target door
            for source_item in source_line_items:
                new_item = LineItem(
                    door_id=target_door.id,
                    description=source_item.description,
                    quantity=source_item.quantity,
                    price=source_item.price,
                    part_number=source_item.part_number,
                    labor_hours=source_item.labor_hours,
                    hardware=source_item.hardware
                )
                db.session.add(new_item)
            
            updated_or_created_doors_info.append({
                "id": target_door.id,
                "door_number": target_door.door_number
            })
            
        db.session.commit()

        # A more accurate success message
        return jsonify({
            "message": f"Configuration from door {source_door.door_number} duplicated to {len(updated_or_created_doors_info)} doors.",
            "created_doors": updated_or_created_doors_info,
            "not_found": [] # This should always be empty now
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error during door duplication from source door {door_id}: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred during duplication."}), 500