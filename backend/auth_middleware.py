"""
Authentication middleware and utilities for Scott Overhead Doors application.
Provides decorators and helper functions for route protection and user management.
"""

from functools import wraps
from flask import jsonify, request, current_app
from flask_login import current_user
import logging

logger = logging.getLogger(__name__)

def admin_required(f):
    """
    Decorator to require admin role for route access.
    Must be used after @login_required decorator.
    
    Usage:
        @app.route('/admin-only')
        @login_required
        @admin_required
        def admin_function():
            return "Admin only content"
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            logger.warning(f"Unauthenticated access attempt to admin route: {request.endpoint}")
            return jsonify({'error': 'Authentication required'}), 401
        
        if current_user.role != 'admin':
            logger.warning(f"Non-admin user {current_user.username} attempted to access admin route: {request.endpoint}")
            return jsonify({'error': 'Admin access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def field_or_admin_required(f):
    """
    Decorator to require either field or admin role for route access.
    Must be used after @login_required decorator.
    
    Usage:
        @app.route('/field-or-admin')
        @login_required
        @field_or_admin_required
        def field_function():
            return "Field or admin content"
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            logger.warning(f"Unauthenticated access attempt to protected route: {request.endpoint}")
            return jsonify({'error': 'Authentication required'}), 401
        
        if current_user.role not in ['admin', 'field']:
            logger.warning(f"User {current_user.username} with invalid role attempted to access route: {request.endpoint}")
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def active_user_required(f):
    """
    Decorator to ensure user account is active.
    Must be used after @login_required decorator.
    
    Usage:
        @app.route('/active-only')
        @login_required
        @active_user_required
        def active_function():
            return "Active user content"
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            logger.warning(f"Unauthenticated access attempt to active-user route: {request.endpoint}")
            return jsonify({'error': 'Authentication required'}), 401
        
        if not current_user.is_active:
            logger.warning(f"Inactive user {current_user.username} attempted to access route: {request.endpoint}")
            return jsonify({'error': 'Account is disabled'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def api_key_required(f):
    """
    Decorator for API key authentication (for external integrations).
    Checks for 'X-API-Key' header.
    
    Usage:
        @app.route('/api/external')
        @api_key_required
        def external_api():
            return "External API content"
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        
        if not api_key:
            logger.warning(f"API request without key to endpoint: {request.endpoint}")
            return jsonify({'error': 'API key required'}), 401
        
        # In production, validate against stored API keys
        valid_api_keys = current_app.config.get('VALID_API_KEYS', [])
        
        if api_key not in valid_api_keys:
            logger.warning(f"Invalid API key used for endpoint: {request.endpoint}")
            return jsonify({'error': 'Invalid API key'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

def rate_limit_by_user(f):
    """
    Decorator to apply rate limiting based on current user.
    Can be customized based on user role.
    
    Usage:
        @app.route('/limited')
        @login_required
        @rate_limit_by_user
        def limited_function():
            return "Rate limited content"
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Different rate limits based on user role
        if current_user.role == 'admin':
            # Admins get higher rate limits
            max_requests = 200
        else:
            # Field users get standard rate limits
            max_requests = 100
        
        # Here you would implement actual rate limiting logic
        # This is a placeholder for demonstration
        
        return f(*args, **kwargs)
    return decorated_function

def log_user_action(action_type):
    """
    Decorator to log user actions for audit trail.
    
    Usage:
        @app.route('/sensitive-action')
        @login_required
        @log_user_action('sensitive_action')
        def sensitive_function():
            return "Logged action"
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if current_user.is_authenticated:
                logger.info(f"User {current_user.username} performed action: {action_type} on endpoint: {request.endpoint}")
            else:
                logger.warning(f"Unauthenticated user attempted action: {action_type} on endpoint: {request.endpoint}")
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def validate_user_owns_resource(resource_user_id_param='user_id'):
    """
    Decorator to ensure a user can only access their own resources.
    Admin users can access any resource.
    
    Usage:
        @app.route('/user/<int:user_id>/profile')
        @login_required
        @validate_user_owns_resource('user_id')
        def user_profile(user_id):
            return f"Profile for user {user_id}"
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return jsonify({'error': 'Authentication required'}), 401
            
            # Admin users can access any resource
            if current_user.role == 'admin':
                return f(*args, **kwargs)
            
            # Get the resource user ID from the route parameters
            resource_user_id = kwargs.get(resource_user_id_param)
            
            if resource_user_id is None:
                logger.error(f"Resource ownership validation failed: {resource_user_id_param} not found in route")
                return jsonify({'error': 'Invalid resource'}), 400
            
            # Check if the current user owns the resource
            if current_user.id != resource_user_id:
                logger.warning(f"User {current_user.username} attempted to access resource owned by user {resource_user_id}")
                return jsonify({'error': 'Access denied'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def get_current_user_context():
    """
    Helper function to get current user context for templates and API responses.
    
    Returns:
        dict: User context information
    """
    if current_user.is_authenticated:
        return {
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'full_name': current_user.get_full_name(),
                'email': current_user.email,
                'role': current_user.role,
                'is_admin': current_user.role == 'admin',
                'is_field': current_user.role == 'field',
                'is_active': current_user.is_active,
                'last_login': current_user.last_login.isoformat() if current_user.last_login else None
            },
            'is_authenticated': True
        }
    else:
        return {
            'user': None,
            'is_authenticated': False
        }

def check_password_strength(password):
    """
    Helper function to validate password strength.
    
    Args:
        password (str): Password to validate
        
    Returns:
        tuple: (is_valid, error_message)
    """
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    
    if len(password) > 128:
        return False, "Password must be less than 128 characters long"
    
    # Check for at least one number and one letter (optional, can be customized)
    has_letter = any(c.isalpha() for c in password)
    has_number = any(c.isdigit() for c in password)
    
    if not has_letter:
        return False, "Password must contain at least one letter"
    
    if not has_number:
        return False, "Password must contain at least one number"
    
    # Check for common weak passwords
    weak_passwords = [
        'password', '123456', 'password123', 'admin', 'qwerty',
        'letmein', 'welcome', 'monkey', '1234567890'
    ]
    
    if password.lower() in weak_passwords:
        return False, "Password is too common. Please choose a stronger password"
    
    return True, "Password is valid"

def create_user_session_data(user):
    """
    Helper function to create session data for a user.
    
    Args:
        user: User model instance
        
    Returns:
        dict: Session data for the user
    """
    return {
        'user_id': user.id,
        'username': user.username,
        'role': user.role,
        'last_login': user.last_login.isoformat() if user.last_login else None,
        'session_created': logger.info(f"Session created for user: {user.username}")
    }