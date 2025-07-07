# backend/routes/auth.py
from flask import Blueprint, request, jsonify, make_response
from flask_login import login_user, logout_user, login_required, current_user
from datetime import datetime
from models import db, User
from middleware.auth import admin_required
import logging
from datetime import datetime, timedelta  # Add timedelta here

auth_bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """Handle user login"""
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        # Find user by username
        user = User.query.filter_by(username=username).first()
        
        if not user:
            return jsonify({'error': 'Invalid username or password'}), 401
        
        if not user.is_active:
            return jsonify({'error': 'Account is disabled'}), 401
        
        if not user.check_password(password):
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Log the user in
        login_user(user, remember=True)
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed'}), 500

@auth_bp.route('/logout', methods=['POST', 'OPTIONS'])
def logout():
    """Handle user logout with comprehensive session cleanup and CORS support"""
    try:
        # Handle CORS preflight requests for ngrok compatibility
        if request.method == 'OPTIONS':
            response = make_response()
            origin = request.headers.get('Origin')
            if origin and ('ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin):
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin'
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Max-Age'] = '86400'
            return response, 200

        # Get user information before logout (if available)
        user_info = "Unknown"
        user_was_authenticated = False
        
        try:
            if hasattr(current_user, 'is_authenticated') and current_user.is_authenticated:
                user_info = f"{current_user.username} (ID: {current_user.id})"
                user_was_authenticated = True
        except Exception as user_check_error:
            logger.warning(f"Could not check user authentication state: {str(user_check_error)}")
        
        # Log the logout attempt
        logger.info(f"Logout attempt for user: {user_info}, was_authenticated: {user_was_authenticated}")
        
        # Always attempt logout, regardless of current state
        try:
            logout_user()
            logger.info(f"Flask-Login logout_user() called successfully")
        except Exception as logout_error:
            logger.warning(f"logout_user() encountered error (continuing anyway): {str(logout_error)}")
        
        # Comprehensive session cleanup
        try:
            from flask import session
            session.clear()
            logger.info("Flask session cleared successfully")
        except Exception as session_error:
            logger.warning(f"Session clear encountered error: {str(session_error)}")
        
        # Create response with complete session termination
        response_data = {
            'message': 'Logout successful',
            'success': True,
            'timestamp': datetime.utcnow().isoformat(),
            'was_authenticated': user_was_authenticated,
            'cleared_session': True,
            'force_reauth_required': True
        }
        
        response = make_response(jsonify(response_data))
        response.headers['Content-Type'] = 'application/json'
        
        # Add CORS headers for ngrok tunnel compatibility
        origin = request.headers.get('Origin')
        if origin and ('ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        
        # Aggressively clear all possible session cookies
        cookie_names = ['session', 'remember_token', 'auth_token', 'user_session', 'flask_session']
        for cookie_name in cookie_names:
            response.set_cookie(
                cookie_name, 
                '', 
                expires=0, 
                path='/',
                domain=None,
                secure=False,
                httponly=True,
                samesite='Lax'
            )
        
        logger.info(f"Logout completed successfully for user: {user_info}, all cookies cleared")
        return response, 200
        
    except Exception as e:
        # Always succeed on logout for security - log the error but don't fail
        logger.error(f"Logout endpoint error (returning success anyway): {str(e)}")
        
        response_data = {
            'message': 'Logout completed',
            'success': True,
            'timestamp': datetime.utcnow().isoformat(),
            'note': 'Logout forced due to server error - session cleared',
            'force_reauth_required': True
        }
        
        response = make_response(jsonify(response_data))
        response.headers['Content-Type'] = 'application/json'
        
        # Add CORS headers even in error cases
        origin = request.headers.get('Origin')
        if origin and ('ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        # Clear session cookies even on error
        cookie_names = ['session', 'remember_token', 'auth_token', 'user_session', 'flask_session']
        for cookie_name in cookie_names:
            response.set_cookie(cookie_name, '', expires=0, path='/')
        
        return response, 200

@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current user information"""
    return jsonify(current_user.to_dict()), 200

@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """Allow user to change their password"""
    try:
        data = request.json
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not current_password or not new_password:
            return jsonify({'error': 'Current password and new password are required'}), 400
        
        if len(new_password) < 6:
            return jsonify({'error': 'New password must be at least 6 characters long'}), 400
        
        if not current_user.check_password(current_password):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        current_user.set_password(new_password)
        db.session.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        logger.error(f"Password change error: {str(e)}")
        return jsonify({'error': 'Failed to change password'}), 500

# User Management Routes (Admin Only)
@auth_bp.route('/users', methods=['GET'])
@login_required
@admin_required
def get_users():
    """Get all users (admin only)"""
    try:
        users = User.query.order_by(User.role, User.first_name).all()
        return jsonify([user.to_dict() for user in users]), 200
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        return jsonify({'error': 'Failed to fetch users'}), 500

@auth_bp.route('/extend-session', methods=['POST'])
@login_required
def extend_session():
    """Extend the current user session to prevent timeout during active work"""
    try:
        # Update the user's last activity
        current_user.last_login = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Session extended successfully',
            'expires_at': (datetime.utcnow() + timedelta(minutes=30)).isoformat(),
            'user_id': current_user.id
        }), 200
        
    except Exception as e:
        logger.error(f"Error extending session: {str(e)}")
        return jsonify({
            'error': 'Failed to extend session',
            'timestamp': datetime.utcnow().isoformat()
        }), 500
        
        
@auth_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@login_required # Ensure user is logged in
@admin_required # Ensure only admins can reset other users' passwords
def reset_user_password(user_id):
    """Admin endpoint to reset a specific user's password."""
    try:
        # Prevent an admin from resetting their own password via this endpoint
        # They should use the /change-password endpoint or login again if they forget
        if current_user.id == user_id:
            return jsonify({'error': 'You cannot reset your own password via this admin endpoint. Please use the "Change Password" feature if available or log in again.'}), 403

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        new_password = data.get('new_password')

        if not new_password:
            return jsonify({'error': 'New password is required'}), 400
        
        if len(new_password) < 6: # Basic validation matching frontend
            return jsonify({'error': 'New password must be at least 6 characters long'}), 400

        user.set_password(new_password)
        db.session.commit()
        logger.info(f"Admin {current_user.username} reset password for user ID {user_id} ({user.username}).")
        return jsonify({'message': f'Password for user {user.username} reset successfully'}), 200

    except Exception as e:
        logger.error(f"Error resetting password for user ID {user_id}: {str(e)}")
        return jsonify({'error': 'Failed to reset password'}), 500