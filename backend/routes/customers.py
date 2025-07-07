# backend/routes/customers.py
from flask import Blueprint, request, jsonify
from flask_login import login_required
from models import db, Customer, Site
import logging
import re

customers_bp = Blueprint('customers', __name__)
logger = logging.getLogger(__name__)

@customers_bp.route('', methods=['GET'])
@login_required
def get_customers():
    """Get all customers"""
    try:
        customers = Customer.query.all()
        result = []
        for customer in customers:
            result.append({
                'id': customer.id,
                'name': customer.name,
                'contact_name': customer.contact_name,
                'phone': customer.phone,
                'email': customer.email,
                'address': customer.address,
                'created_at': customer.created_at.isoformat() if customer.created_at else None
            })
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error retrieving customers: {str(e)}")
        return jsonify({'error': 'Failed to retrieve customers'}), 500

@customers_bp.route('', methods=['POST'])
@login_required
def create_customer():
    """Create a new customer"""
    try:
        data = request.json
        
        # Validate required fields
        if 'name' not in data or not data['name'].strip():
            return jsonify({'error': 'Customer name is required'}), 400
        
        # Validate email format if provided
        email = data.get('email', '').strip()
        if email:
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, email):
                return jsonify({'error': 'Please enter a valid email address'}), 400
        
        # Create customer with all fields
        customer = Customer(
            name=data['name'].strip(),
            contact_name=data.get('contact_name', '').strip() or None,
            phone=data.get('phone', '').strip() or None,
            email=email or None,
            address=data.get('address', '').strip() or None
        )
        
        db.session.add(customer)
        db.session.commit()
        
        # Return complete customer data
        return jsonify({
            'id': customer.id,
            'name': customer.name,
            'contact_name': customer.contact_name,
            'phone': customer.phone,
            'email': customer.email,
            'address': customer.address,
            'created_at': customer.created_at.isoformat() if customer.created_at else None
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating customer: {str(e)}")
        return jsonify({'error': f'Failed to create customer: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>', methods=['GET'])
@login_required
def get_customer(customer_id):
    """Get a specific customer"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        return jsonify({
            'id': customer.id,
            'name': customer.name,
            'contact_name': customer.contact_name,
            'phone': customer.phone,
            'email': customer.email,
            'address': customer.address,
            'created_at': customer.created_at.isoformat() if customer.created_at else None
        })
    except Exception as e:
        logger.error(f"Error retrieving customer {customer_id}: {str(e)}")
        return jsonify({'error': 'Failed to retrieve customer'}), 500

@customers_bp.route('/<int:customer_id>', methods=['PUT'])
@login_required
def update_customer(customer_id):
    """Update a customer"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.json
        
        # Validate email format if provided
        if 'email' in data and data['email']:
            email = data['email'].strip()
            if email:
                email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                if not re.match(email_pattern, email):
                    return jsonify({'error': 'Please enter a valid email address'}), 400
                customer.email = email
            else:
                customer.email = None
        
        # Update other fields
        if 'name' in data:
            if not data['name'].strip():
                return jsonify({'error': 'Customer name is required'}), 400
            customer.name = data['name'].strip()
        
        if 'contact_name' in data:
            customer.contact_name = data['contact_name'].strip() or None
        
        if 'phone' in data:
            customer.phone = data['phone'].strip() or None
        
        if 'address' in data:
            customer.address = data['address'].strip() or None
        
        db.session.commit()
        
        return jsonify({
            'id': customer.id,
            'name': customer.name,
            'contact_name': customer.contact_name,
            'phone': customer.phone,
            'email': customer.email,
            'address': customer.address,
            'created_at': customer.created_at.isoformat() if customer.created_at else None
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating customer {customer_id}: {str(e)}")
        return jsonify({'error': f'Failed to update customer: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>', methods=['DELETE'])
@login_required
def delete_customer(customer_id):
    """Delete a customer and all related records"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        db.session.delete(customer)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Customer {customer_id} and all related records deleted successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting customer {customer_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Failed to delete customer: {str(e)}',
            'error_type': type(e).__name__
        }), 500

# Site routes
@customers_bp.route('/<int:customer_id>/sites', methods=['GET'])
@login_required
def get_customer_sites(customer_id):
    """Get all sites for a customer"""
    customer = Customer.query.get_or_404(customer_id)
    sites = Site.query.filter_by(customer_id=customer.id).all()
    result = []
    for site in sites:
        result.append({
            'id': site.id,
            'customer_id': site.customer_id,
            'name': site.name,
            'address': site.address,
            'lockbox_location': site.lockbox_location,
            'contact_name': site.contact_name,
            'phone': site.phone,
            'email': site.email,
            'created_at': site.created_at.isoformat() if site.created_at else None
        })
    return jsonify(result)

@customers_bp.route('/<int:customer_id>/sites', methods=['POST'])
@login_required
def create_site(customer_id):
    """Create a new site for a customer"""
    customer = Customer.query.get_or_404(customer_id)
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Site name is required'}), 400
    
    site = Site(
        customer_id=customer_id,
        name=name,
        address=data.get('address', ''),
        lockbox_location=data.get('lockbox_location', ''),
        contact_name=data.get('contact_name', ''),
        phone=data.get('phone', ''),
        email=data.get('email', '')
    )
    db.session.add(site)
    db.session.commit()
    
    return jsonify({
        'id': site.id,
        'customer_id': site.customer_id,
        'name': site.name,
        'address': site.address,
        'lockbox_location': site.lockbox_location,
        'contact_name': site.contact_name,
        'phone': site.phone,
        'email': site.email,
        'created_at': site.created_at.isoformat() if site.created_at else None
    }), 201