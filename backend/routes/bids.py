# backend/routes/bids.py
from flask import Blueprint, request, jsonify, make_response
from flask_login import login_required
from datetime import datetime
from models import db, Bid, Estimate, Door, LineItem, Job
from services.file_utils import generate_bid_report, generate_bid_proposal
from services.date_utils import generate_job_number
import logging
import json

bids_bp = Blueprint('bids', __name__)
logger = logging.getLogger(__name__)

@bids_bp.route('', methods=['GET'])
@login_required
def get_bids():
    """Get all bids with customer information and site details"""
    try:
        bids = Bid.query.all()
        result = []
        
        for bid in bids:
            bid_data = {
                'id': bid.id,
                'estimate_id': bid.estimate_id,
                'customer_name': bid.estimate.customer_direct_link.name,
                'site_address': bid.estimate.site.address if bid.estimate.site else None,
                'site_name': bid.estimate.site.name if bid.estimate.site else None,
                'status': bid.status,
                'total_cost': bid.total_cost,
                'created_at': bid.created_at
            }
            result.append(bid_data)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error retrieving bids: {str(e)}")
        return jsonify({'error': 'Failed to retrieve bids'}), 500

@bids_bp.route('/<int:bid_id>', methods=['GET'])
@login_required
def get_bid(bid_id):
    """Get a specific bid with all details"""
    try:
        bid = Bid.query.get_or_404(bid_id)

        # ==========================================================
        # === FIX #1: REFRESH THE OBJECT FROM THE DATABASE       ===
        # ==========================================================
        # This forces SQLAlchemy to reload the bid and all its related
        # doors and line items, ensuring we have the latest data
        # after the duplication operation.
        db.session.refresh(bid)
        # ==========================================================
        
        doors_data = []
        total_parts_cost = 0
        total_labor_cost = 0
        total_hardware_cost = 0
        
        # Now, this loop will iterate over the fresh, up-to-date data
        for door in bid.doors:
            line_items = []
            door_parts_cost = 0
            door_labor_cost = 0
            door_hardware_cost = 0
            
            for item in door.line_items:
                item_total = item.price * item.quantity
                door_parts_cost += item_total
                door_labor_cost += item.labor_hours * 47.02
                door_hardware_cost += item.hardware
                
                line_items.append({
                    'id': item.id,
                    'part_number': item.part_number,
                    'description': item.description,
                    'quantity': item.quantity,
                    'price': item.price,
                    'labor_hours': item.labor_hours,
                    'hardware': item.hardware,
                    'total': item_total
                })
            
            door_total = door_parts_cost + door_labor_cost + door_hardware_cost
            
            door_display_name = f"Door #{door.door_number}"
            if door.location:
                door_display_name = f"Door #{door.door_number} ({door.location})"
            
            door_info = []
            if door.location:
                door_info.append(f"Location: {door.location}")
            if door.width and door.height:
                door_info.append(f"Size: {door.width}x{door.height} {door.dimension_unit or 'inches'}")
            if door.door_type:
                door_info.append(f"Type: {door.door_type}")
            if door.labor_description:
                door_info.append(f"Work: {door.labor_description}")
            
            doors_data.append({
                'id': door.id,
                'door_number': door.door_number,
                'display_name': door_display_name,
                'location': door.location,
                'door_type': door.door_type,
                'width': door.width,
                'height': door.height,
                'dimension_unit': door.dimension_unit,
                'labor_description': door.labor_description,
                'notes': door.notes,
                'door_info': door_info,
                'line_items': line_items,
                'parts_cost': door_parts_cost,
                'labor_cost': door_labor_cost,
                'hardware_cost': door_hardware_cost,
                'total': door_total
            })
            
            total_parts_cost += door_parts_cost
            total_labor_cost += door_labor_cost
            total_hardware_cost += door_hardware_cost
        
        tax_rate = 0.0875
        tax_amount = (total_parts_cost + total_hardware_cost) * tax_rate
        total_cost_val = total_parts_cost + total_labor_cost + total_hardware_cost + tax_amount
        
        # ==========================================================
        # === FIX #2: REMOVE THE DATABASE WRITE FROM A GET REQUEST ===
        # ==========================================================
        # A GET request should only read data, not change it.
        # Removing these lines prevents unnecessary database writes.
        # The calculated total is still returned in the JSON below.
        # bid.total_cost = total_cost_val
        # db.session.commit()
        # ==========================================================
        
        return jsonify({
            'id': bid.id,
            'estimate_id': bid.estimate_id,
            'customer_name': bid.estimate.customer_direct_link.name,
            'customer_address': bid.estimate.site.address if bid.estimate.site else None,
            'customer_contact': bid.estimate.site.contact_name if bid.estimate.site else None,
            'customer_phone': bid.estimate.site.phone if bid.estimate.site else None,
            'status': bid.status,
            'doors': doors_data,
            'total_parts_cost': total_parts_cost,
            'total_labor_cost': total_labor_cost,
            'total_hardware_cost': total_hardware_cost,
            'tax': tax_amount,
            'total_cost': total_cost_val,
            'created_at': bid.created_at
        })
    except Exception as e:
        logger.error(f"Error retrieving bid {bid_id}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve bid'}), 500
    
    
@bids_bp.route('/estimates/<int:estimate_id>', methods=['POST'])
@login_required
def create_bid(estimate_id):
    """Create a new bid from an estimate"""
    try:
        estimate = Estimate.query.get_or_404(estimate_id)
        
        bid = Bid(
            estimate_id=estimate_id,
            status='draft',
            total_cost=0.0
        )
        db.session.add(bid)
        db.session.flush()
        
        estimate.status = 'converted'
        
        doors_count = 0
        try:
            doors_data = json.loads(estimate.doors_data) if estimate.doors_data else []
            doors_count = len(doors_data)
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Error reading doors data from estimate: {str(e)}")
            doors_count = 0
        
        db.session.commit()
        
        return jsonify({
            'id': bid.id,
            'estimate_id': bid.estimate_id,
            'customer_name': bid.estimate.customer_direct_link.name,
            'site_address': bid.estimate.site.address if bid.estimate.site else None,
            'status': bid.status,
            'total_cost': bid.total_cost,
            'created_at': bid.created_at,
            'doors_available_for_transfer': doors_count,
            'message': 'Bid created successfully. Doors will be added by frontend.'
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating bid: {str(e)}")
        return jsonify({'error': 'Failed to create bid'}), 500

@bids_bp.route('/<int:bid_id>/doors', methods=['POST'])
@login_required
def add_door(bid_id):
    """Add a door to a bid"""
    try:
        bid = Bid.query.get_or_404(bid_id)
        data = request.json
        
        highest_door = Door.query.filter_by(bid_id=bid_id).order_by(Door.door_number.desc()).first()
        next_door_number = 1
        if highest_door:
            next_door_number = highest_door.door_number + 1
        
        door_number = data.get('door_number', next_door_number)
        
        door = Door(
            bid_id=bid_id, 
            door_number=door_number,
            location=data.get('location'),
            door_type=data.get('door_type'),
            width=data.get('width'),
            height=data.get('height'),
            dimension_unit=data.get('dimension_unit'),
            labor_description=data.get('labor_description'),
            notes=data.get('notes')
        )
        db.session.add(door)
        db.session.commit()
        
        return jsonify({
            'id': door.id,
            'bid_id': door.bid_id,
            'door_number': door.door_number,
            'location': door.location,
            'door_type': door.door_type,
            'width': door.width,
            'height': door.height,
            'dimension_unit': door.dimension_unit,
            'labor_description': door.labor_description,
            'notes': door.notes,
            'created_at': door.created_at
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding door: {str(e)}")
        return jsonify({'error': 'Failed to add door'}), 500

@bids_bp.route('/<int:bid_id>/doors/<int:door_id>', methods=['DELETE'])
@login_required
def delete_door(bid_id, door_id):
    """Delete a door and all its line items from a bid"""
    try:
        bid = Bid.query.get_or_404(bid_id)
        door = Door.query.get_or_404(door_id)
        
        if door.bid_id != bid_id:
            return jsonify({'error': 'Door does not belong to the specified bid'}), 400
            
        doors_count = Door.query.filter_by(bid_id=bid_id).count()
        if doors_count <= 1:
            return jsonify({'error': 'Cannot delete the last door in a bid'}), 400
            
        LineItem.query.filter_by(door_id=door_id).delete()
        db.session.delete(door)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Door {door_id} and all its line items deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting door: {str(e)}")
        return jsonify({'error': f'Failed to delete door: {str(e)}'}), 500

@bids_bp.route('/<int:bid_id>/save-changes', methods=['PUT'])
@login_required
def save_bid_changes(bid_id):
    """Save bulk changes to a bid including multiple doors and their line items"""
    try:
        bid = Bid.query.get_or_404(bid_id)
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        doors_data = data.get('doors', [])
        if not doors_data:
            return jsonify({'error': 'No doors data provided'}), 400
            
        updated_items = []
        errors = []
        
        for door_change in doors_data:
            door_id = door_change.get('door_id')
            line_items_data = door_change.get('line_items', [])
            
            if not door_id:
                errors.append('Missing door_id in door data')
                continue
                
            door = Door.query.get(door_id)
            if not door:
                errors.append(f'Door {door_id} not found')
                continue
                
            if door.bid_id != bid_id:
                errors.append(f'Door {door_id} does not belong to bid {bid_id}')
                continue
                
            for item_data in line_items_data:
                item_id = item_data.get('id')
                if not item_id:
                    errors.append('Missing line item ID')
                    continue
                    
                line_item = LineItem.query.get(item_id)
                if not line_item:
                    errors.append(f'Line item {item_id} not found')
                    continue
                    
                if line_item.door_id != door_id:
                    errors.append(f'Line item {item_id} does not belong to door {door_id}')
                    continue
                    
                try:
                    if 'description' in item_data:
                        line_item.description = str(item_data['description']).strip()
                        
                    if 'quantity' in item_data:
                        quantity = float(item_data['quantity'])
                        if quantity <= 0:
                            errors.append(f'Invalid quantity {quantity} for item {item_id}')
                            continue
                        line_item.quantity = quantity
                        
                    if 'price' in item_data:
                        price = float(item_data['price'])
                        if price < 0:
                            errors.append(f'Invalid price {price} for item {item_id}')
                            continue
                        line_item.price = price
                        
                    if 'labor_hours' in item_data:
                        labor_hours = float(item_data['labor_hours'])
                        if labor_hours < 0:
                            errors.append(f'Invalid labor_hours {labor_hours} for item {item_id}')
                            continue
                        line_item.labor_hours = labor_hours
                        
                    if 'hardware' in item_data:
                        hardware = float(item_data['hardware'])
                        if hardware < 0:
                            errors.append(f'Invalid hardware cost {hardware} for item {item_id}')
                            continue
                        line_item.hardware = hardware
                        
                    updated_items.append({
                        'item_id': item_id,
                        'door_id': door_id,
                        'description': line_item.description
                    })
                    
                except (ValueError, TypeError) as e:
                    errors.append(f'Invalid data for item {item_id}: {str(e)}')
                    continue
        
        if errors:
            return jsonify({
                'success': False,
                'errors': errors,
                'message': 'Validation errors occurred. No changes were saved.'
            }), 400
            
        db.session.commit()
        
        # Recalculate bid totals
        total_parts_cost = 0
        total_labor_cost = 0
        total_hardware_cost = 0
        
        for door in bid.doors:
            for item in door.line_items:
                item_total = item.price * item.quantity
                total_parts_cost += item_total
                total_labor_cost += item.labor_hours * 47.02
                total_hardware_cost += item.hardware
        
        tax_rate = 0.0875
        tax_amount = (total_parts_cost + total_hardware_cost) * tax_rate
        total_cost = total_parts_cost + total_labor_cost + total_hardware_cost + tax_amount
        
        bid.total_cost = total_cost
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Successfully updated {len(updated_items)} line items',
            'updated_items': updated_items,
            'bid_totals': {
                'total_parts_cost': total_parts_cost,
                'total_labor_cost': total_labor_cost,
                'total_hardware_cost': total_hardware_cost,
                'tax_amount': tax_amount,
                'total_cost': total_cost
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error saving bid changes for bid {bid_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to save bid changes: {str(e)}',
            'error_type': type(e).__name__
        }), 500

@bids_bp.route('/<int:bid_id>/approve', methods=['POST'])
@login_required
def approve_bid(bid_id):
    """Approve a bid and create a job"""
    try:
        bid = Bid.query.get_or_404(bid_id)
        bid.status = 'approved'
        job_number = generate_job_number()
        
        job = Job(
            job_number=job_number,
            bid_id=bid_id,
            status='unscheduled',
            material_ready=False,
            material_location='S',
            region=request.json.get('region', 'OC'),
            job_scope=request.json.get('job_scope', '')
        )
        db.session.add(job)
        db.session.commit()
        
        return jsonify({
            'bid_id': bid_id,
            'status': bid.status,
            'job_id': job.id,
            'job_number': job.job_number
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error approving bid {bid_id}: {str(e)}")
        return jsonify({'error': 'Failed to approve bid'}), 500

@bids_bp.route('/<int:bid_id>/report', methods=['GET'])
@login_required
def get_bid_report(bid_id):
    """Generate a PDF report for a bid"""
    try:
        bid = Bid.query.get_or_404(bid_id)
        response = generate_bid_report(bid)
        return response
    except Exception as e:
        logger.error(f"Error generating bid report: {str(e)}")
        return jsonify({'error': 'Failed to generate report'}), 500

@bids_bp.route('/<int:bid_id>/proposal', methods=['GET'])
@login_required
def get_bid_proposal(bid_id):
    """Generate a PDF proposal for a bid"""
    try:
        bid = Bid.query.get_or_404(bid_id)
        response = generate_bid_proposal(bid)
        return response
    except Exception as e:
        logger.error(f"Error generating bid proposal: {str(e)}")
        return jsonify({'error': 'Failed to generate proposal'}), 500