# backend/middleware/auth.py

from functools import wraps
from flask import jsonify
from flask_login import current_user
import logging

# It's good practice to set up a logger for your modules
logger = logging.getLogger(__name__)

def admin_required(f):
    """
    Decorator to ensure a user is logged in and has the 'admin' role.
    This must be placed AFTER the @login_required decorator.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # First, ensure the user is authenticated.
        if not current_user.is_authenticated:
            logger.warning("Unauthenticated access attempt to an admin-only route.")
            return jsonify({'error': 'Authentication required'}), 401
        
        # Then, check if the authenticated user has the 'admin' role.
        if not hasattr(current_user, 'role') or current_user.role != 'admin':
            logger.warning(f"User '{current_user.username}' (role: {getattr(current_user, 'role', 'N/A')}) attempted to access an admin-only route.")
            return jsonify({'error': 'Admin access required'}), 403 # 403 Forbidden is more appropriate
        
        return f(*args, **kwargs)
    return decorated_function

def field_or_admin_required(f):
    """
    Decorator to ensure a user has either the 'field' or 'admin' role.
    This must be placed AFTER the @login_required decorator.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            logger.warning("Unauthenticated access attempt to a protected route.")
            return jsonify({'error': 'Authentication required'}), 401
        
        if not hasattr(current_user, 'role') or current_user.role not in ['admin', 'field']:
            logger.warning(f"User '{current_user.username}' (role: {getattr(current_user, 'role', 'N/A')}) attempted access without sufficient permissions.")
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def active_user_required(f):
    """
    Decorator to ensure the logged-in user's account is active.
    This must be placed AFTER the @login_required decorator.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        
        if not hasattr(current_user, 'is_active') or not current_user.is_active:
            logger.warning(f"Inactive user '{current_user.username}' attempted to access a resource.")
            return jsonify({'error': 'Your account is disabled. Please contact an administrator.'}), 403
            
        return f(*args, **kwargs)
    return decorated_function