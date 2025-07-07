# backend/middleware/auth.py
from flask import request, jsonify, url_for, redirect
from flask_login import current_user
from functools import wraps

def setup_auth_handlers(app, login_manager):
    """Setup authentication handlers and decorators"""
    
    @login_manager.user_loader
    def load_user(user_id):
        """Load user by ID for Flask-Login"""
        from models import User
        return User.query.get(int(user_id))
    
    @login_manager.unauthorized_handler
    def unauthorized_api_handler():
        """Handle unauthorized access attempts"""
        # Check if the request path starts with API prefix
        api_prefix = app.config.get("API_PREFIX", "/api/")

        if request.path.startswith(api_prefix):
            # For API requests, return a JSON 401 response
            return jsonify(
                error="Authentication required", 
                message="Please log in to access this resource."
            ), 401
        else:
            # For non-API requests (e.g., browser navigating to a protected page),
            # perform the default redirect to the login view.
            if login_manager.login_view:
                login_url = url_for(login_manager.login_view)
                # Preserve the 'next' URL if it was part of the original request
                if 'next' in request.args:
                    login_url = url_for(login_manager.login_view, next=request.args.get('next'))
                return redirect(login_url)
            else:
                # If no login view is configured, abort with 401
                from flask import abort
                abort(401)

def admin_required(f):
    """Decorator to require admin role for route access"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        if current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function