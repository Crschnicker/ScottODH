# backend/routes/sites.py
from flask import Blueprint, request, jsonify
from flask_login import login_required
from models import db, Site
import logging

sites_bp = Blueprint('sites', __name__)  # Fixed: was **name**
logger = logging.getLogger(__name__)

def serialize_site(site):
    """Serialize a Site model object to a dictionary for JSON response"""
    return {
        'id': site.id,
        'customer_id': site.customer_id,
        'name': site.name,
        'address': site.address or '',
        'lockbox_location': site.lockbox_location or '',
        'contact_name': site.contact_name or '',
        'phone': site.phone or '',
        'email': site.email or '',
        'created_at': site.created_at.isoformat() if site.created_at else None
    }

@sites_bp.route('/<int:site_id>', methods=['GET'])
@login_required
def get_site(site_id):
    """Get a specific site"""
    try:
        site = Site.query.get_or_404(site_id)
        return jsonify(serialize_site(site))
    except Exception as e:
        logger.error(f"Error retrieving site {site_id}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve site'}), 500

@sites_bp.route('/<int:site_id>', methods=['PUT'])
@login_required
def update_site(site_id):
    """Update an existing site"""
    try:
        site = Site.query.get_or_404(site_id)
        data = request.json
        
        if 'name' in data:
            site.name = data['name']
        if 'address' in data:
            site.address = data['address']
        if 'lockbox_location' in data:
            site.lockbox_location = data['lockbox_location']
        if 'contact_name' in data:
            site.contact_name = data['contact_name']
        if 'phone' in data:
            site.phone = data['phone']
        if 'email' in data:
            site.email = data['email']
        
        db.session.commit()
        return jsonify(serialize_site(site))
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating site {site_id}: {str(e)}")
        return jsonify({'error': 'Failed to update site'}), 500

@sites_bp.route('/<int:site_id>', methods=['DELETE'])
@login_required
def delete_site(site_id):
    """Delete a site"""
    try:
        site = Site.query.get_or_404(site_id)
        db.session.delete(site)
        db.session.commit()
        return jsonify({'success': True, 'message': f'Site {site_id} deleted successfully'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting site {site_id}: {str(e)}")
        return jsonify({'error': 'Failed to delete site'}), 500