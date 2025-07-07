# backend/routes/line_items.py
from flask import Blueprint, request, jsonify
from flask_login import login_required
from models import db, LineItem, Door
import logging

line_items_bp = Blueprint('line_items', __name__)
logger = logging.getLogger(__name__)

@line_items_bp.route('/doors/<int:door_id>/line-items', methods=['POST'])
@login_required
def add_line_item(door_id):
    """Add a line item to a door"""
    try:
        door = Door.query.get_or_404(door_id)
        data = request.json
        
        line_item = LineItem(
            door_id=door_id,
            part_number=data.get('part_number', ''),
            description=data.get('description', ''),
            quantity=data.get('quantity', 1),
            price=data.get('price', 0.0),
            labor_hours=data.get('labor_hours', 0.0),
            hardware=data.get('hardware', 0.0)
        )
        db.session.add(line_item)
        db.session.commit()
        
        return jsonify({
            'id': line_item.id,
            'door_id': line_item.door_id,
            'part_number': line_item.part_number,
            'description': line_item.description,
            'quantity': line_item.quantity,
            'price': line_item.price,
            'labor_hours': line_item.labor_hours,
            'hardware': line_item.hardware
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding line item: {str(e)}")
        return jsonify({'error': 'Failed to add line item'}), 500

@line_items_bp.route('/doors/<int:door_id>/line-items/<int:line_item_id>', methods=['PUT'])
@login_required
def update_line_item(door_id, line_item_id):
    """Update an existing line item for a door"""
    try:
        door = Door.query.get_or_404(door_id)
        line_item = LineItem.query.get_or_404(line_item_id)
        
        if line_item.door_id != door_id:
            return jsonify({'error': 'Line item does not belong to the specified door'}), 400
        
        data = request.json
        
        # Update line item fields
        if 'description' in data:
            line_item.description = data['description']
        if 'part_number' in data:
            line_item.part_number = data['part_number']
        if 'quantity' in data:
            line_item.quantity = data.get('quantity', 1)
        if 'price' in data:
            line_item.price = data.get('price', 0.0)
        if 'labor_hours' in data:
            line_item.labor_hours = data.get('labor_hours', 0.0)
        if 'hardware' in data:
            line_item.hardware = data.get('hardware', 0.0)
        
        db.session.commit()
        
        # Calculate total for the response
        item_total = line_item.price * line_item.quantity
        
        return jsonify({
            'id': line_item.id,
            'door_id': line_item.door_id,
            'part_number': line_item.part_number,
            'description': line_item.description,
            'quantity': line_item.quantity,
            'price': line_item.price,
            'labor_hours': line_item.labor_hours,
            'hardware': line_item.hardware,
            'total': item_total
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating line item: {str(e)}")
        return jsonify({'error': f'Failed to update line item: {str(e)}'}), 500

@line_items_bp.route('/doors/<int:door_id>/line-items/<int:line_item_id>', methods=['DELETE'])
@login_required
def delete_line_item(door_id, line_item_id):
    """Delete a line item from a door"""
    try:
        door = Door.query.get_or_404(door_id)
        line_item = LineItem.query.get_or_404(line_item_id)
        
        if line_item.door_id != door_id:
            return jsonify({'error': 'Line item does not belong to the specified door'}), 400
        
        db.session.delete(line_item)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Line item {line_item_id} deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting line item: {str(e)}")
        return jsonify({'error': f'Failed to delete line item: {str(e)}'}), 500

@line_items_bp.route('/doors/<int:door_id>/duplicate', methods=['POST'])
@login_required
def duplicate_door(door_id):
    """Duplicate a door and its line items to other door numbers"""
    try:
        data = request.json
        source_door = Door.query.get_or_404(door_id)
        target_door_numbers = data.get('target_door_numbers', [])
        
        created_doors = []
        
        for door_number in target_door_numbers:
            new_door = Door(bid_id=source_door.bid_id, door_number=door_number)
            db.session.add(new_door)
            db.session.flush()
            
            for item in source_door.line_items:
                new_item = LineItem(
                    door_id=new_door.id,
                    part_number=item.part_number,
                    description=item.description,
                    quantity=item.quantity,
                    price=item.price,
                    labor_hours=item.labor_hours,
                    hardware=item.hardware
                )
                db.session.add(new_item)
            
            created_doors.append({'id': new_door.id, 'door_number': new_door.door_number})
        
        db.session.commit()
        return jsonify({'source_door_id': door_id, 'created_doors': created_doors}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error duplicating door: {str(e)}")
        return jsonify({'error': 'Failed to duplicate door'}), 500