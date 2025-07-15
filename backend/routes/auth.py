# backend/routes/auth.py
from flask import Blueprint, request, jsonify, make_response
from flask_login import login_user, logout_user, login_required, current_user
from datetime import datetime, timedelta
import logging
import traceback

# Create the auth blueprint with comprehensive error handling
auth_bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

def safe_import_models():
    """Safely import models with comprehensive error handling and fallback"""
    try:
        from models import db, User
        logger.info("Successfully imported models from 'models' package")
        return db, User, None
    except ImportError as e:
        logger.error(f"Failed to import from 'models' package: {e}")
        
        # Try alternative import paths
        try:
            from models.user import User
            from models import db
            logger.info("Successfully imported User from 'models.user' and db from 'models'")
            return db, User, None
        except ImportError as e2:
            logger.error(f"Failed to import User from 'models.user': {e2}")
            
            try:
                # Try even more specific imports
                import sys
                import os
                sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                from models import db
                from models.user import User
                logger.info("Successfully imported after adjusting sys.path")
                return db, User, None
            except ImportError as e3:
                logger.error(f"All import attempts failed: {e3}")
                return None, None, f"Cannot import models: {e3}"

# Attempt to import models at module level
db, User, import_error = safe_import_models()

def handle_cors_preflight():
    """Handle CORS preflight requests for all auth routes"""
    if request.method == 'OPTIONS':
        response = make_response()
        origin = request.headers.get('Origin')
        
        # Allow requests from Choreo, ngrok, and localhost
        allowed_origins = [
            'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
            'https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'https://scottohd.ngrok.io'
        ]
        
        if origin and (origin in allowed_origins or 'ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Max-Age'] = '86400'
        
        return response, 200
    return None

def validate_models():
    """Validate that required models are available"""
    if import_error:
        return False, f"Model import error: {import_error}"
    
    if not db:
        return False, "Database connection not available"
    
    if not User:
        return False, "User model not available"
    
    return True, "Models available"

def create_error_response(message, status_code=500, include_debug=True):
    """Create standardized error response with optional debug info"""
    response_data = {
        'error': message,
        'status_code': status_code,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    if include_debug:
        response_data['debug_info'] = {
            'models_available': db is not None and User is not None,
            'import_error': import_error,
            'endpoint': request.endpoint,
            'method': request.method,
            'origin': request.headers.get('Origin')
        }
    
    return jsonify(response_data), status_code

@auth_bp.route('/login', methods=['POST', 'OPTIONS'])
def login():
    """Handle user login with comprehensive error handling and CORS support"""
    # Handle CORS preflight
    cors_response = handle_cors_preflight()
    if cors_response:
        return cors_response
    
    try:
        # Log the login attempt with comprehensive debugging
        logger.info(f"Login attempt from {request.remote_addr}, Origin: {request.headers.get('Origin')}")
        logger.info(f"Request method: {request.method}, Content-Type: {request.headers.get('Content-Type')}")
        
        # Validate models are available
        models_valid, models_message = validate_models()
        if not models_valid:
            logger.error(f"Models validation failed: {models_message}")
            return create_error_response(f"Authentication system not available: {models_message}", 500)
        
        # Get and validate request data
        try:
            data = request.json
            if not data:
                logger.warning("Login request with no JSON data")
                return create_error_response("No data provided", 400)
        except Exception as json_error:
            logger.error(f"JSON parsing error: {json_error}")
            return create_error_response("Invalid JSON data", 400)
        
        username = data.get('username', '').strip() if data.get('username') else ''
        password = data.get('password', '') if data.get('password') else ''
        
        logger.info(f"Login attempt for username: '{username}'")
        
        # Validate input data
        if not username or not password:
            logger.warning(f"Login validation failed: missing username or password")
            return create_error_response("Username and password are required", 400)
        
        if len(username) < 2:
            logger.warning(f"Login validation failed: username too short")
            return create_error_response("Username must be at least 2 characters", 400)
        
        if len(password) < 3:
            logger.warning(f"Login validation failed: password too short")
            return create_error_response("Password must be at least 3 characters", 400)
        
        # Find user by username with comprehensive error handling
        try:
            user = User.query.filter_by(username=username).first()
            logger.info(f"Database query completed for username: '{username}', user found: {user is not None}")
        except Exception as db_error:
            logger.error(f"Database error during user lookup: {db_error}")
            return create_error_response("Database error during authentication", 500)
        
        if not user:
            logger.warning(f"Login failed: User '{username}' not found")
            return create_error_response("Invalid username or password", 401)
        
        # Check if user is active
        if not user.is_active:
            logger.warning(f"Login failed: User '{username}' is inactive")
            return create_error_response("Account is disabled", 401)
        
        # Verify password
        try:
            password_valid = user.check_password(password)
            logger.info(f"Password check completed for user '{username}': {password_valid}")
        except Exception as password_error:
            logger.error(f"Password verification error: {password_error}")
            return create_error_response("Authentication error", 500)
        
        if not password_valid:
            logger.warning(f"Login failed: Invalid password for user '{username}'")
            return create_error_response("Invalid username or password", 401)
        
        # Update last login with error handling
        try:
            user.last_login = datetime.utcnow()
            db.session.commit()
            logger.info(f"Updated last login for user '{username}'")
        except Exception as update_error:
            logger.error(f"Database error updating last login: {update_error}")
            # Don't fail login for this error
        
        # Log the user in with comprehensive error handling
        try:
            login_user(user, remember=True)
            logger.info(f"Flask-Login session created for user '{username}'")
        except Exception as login_error:
            logger.error(f"Flask-Login error: {login_error}")
            return create_error_response("Session creation failed", 500)
        
        # Create user response data
        try:
            if hasattr(user, 'to_dict'):
                user_data = user.to_dict()
                logger.info(f"User data created using to_dict() method")
            else:
                # Fallback user data creation
                user_data = {
                    'id': user.id,
                    'username': user.username,
                    'first_name': getattr(user, 'first_name', ''),
                    'last_name': getattr(user, 'last_name', ''),
                    'email': getattr(user, 'email', ''),
                    'role': getattr(user, 'role', 'user'),
                    'is_active': getattr(user, 'is_active', True),
                    'last_login': user.last_login.isoformat() if user.last_login else None
                }
                logger.info(f"User data created using fallback method")
        except Exception as user_data_error:
            logger.error(f"Error creating user data: {user_data_error}")
            return create_error_response("User data creation failed", 500)
        
        logger.info(f"Login successful for user '{username}' (ID: {user.id})")
        
        # Create successful response
        response_data = {
            'message': 'Login successful',
            'user': user_data,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        response = make_response(jsonify(response_data))
        
        # Add CORS headers to response
        origin = request.headers.get('Origin')
        if origin:
            allowed_origins = [
                'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
                'https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'https://scottohd.ngrok.io'
            ]
            
            if origin in allowed_origins or 'ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        return response, 200
        
    except Exception as e:
        logger.error(f"Unexpected login error: {e}")
        logger.error(f"Login error traceback: {traceback.format_exc()}")
        return create_error_response("Login failed due to server error", 500)

@auth_bp.route('/logout', methods=['POST', 'OPTIONS'])
def logout():
    """Handle user logout with comprehensive session cleanup and CORS support"""
    # Handle CORS preflight
    cors_response = handle_cors_preflight()
    if cors_response:
        return cors_response
    
    try:
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
        
        # Add CORS headers
        origin = request.headers.get('Origin')
        if origin:
            allowed_origins = [
                'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
                'https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'https://scottohd.ngrok.io'
            ]
            
            if origin in allowed_origins or 'ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin:
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
        if origin:
            allowed_origins = [
                'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
                'https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'https://scottohd.ngrok.io'
            ]
            
            if origin in allowed_origins or 'ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        # Clear session cookies even on error
        cookie_names = ['session', 'remember_token', 'auth_token', 'user_session', 'flask_session']
        for cookie_name in cookie_names:
            response.set_cookie(cookie_name, '', expires=0, path='/')
        
        return response, 200

@auth_bp.route('/me', methods=['GET', 'OPTIONS'])
@login_required
def get_current_user():
    """Get current user information with comprehensive error handling"""
    # Handle CORS preflight
    cors_response = handle_cors_preflight()
    if cors_response:
        return cors_response
    
    try:
        # Validate models are available
        models_valid, models_message = validate_models()
        if not models_valid:
            logger.error(f"Models validation failed in get_current_user: {models_message}")
            return create_error_response(f"User system not available: {models_message}", 500)
        
        # Create user response data
        try:
            if hasattr(current_user, 'to_dict'):
                user_data = current_user.to_dict()
                logger.info(f"Current user data retrieved using to_dict() method")
            else:
                # Fallback user data creation
                user_data = {
                    'id': current_user.id,
                    'username': current_user.username,
                    'first_name': getattr(current_user, 'first_name', ''),
                    'last_name': getattr(current_user, 'last_name', ''),
                    'email': getattr(current_user, 'email', ''),
                    'role': getattr(current_user, 'role', 'user'),
                    'is_active': getattr(current_user, 'is_active', True),
                    'last_login': current_user.last_login.isoformat() if hasattr(current_user, 'last_login') and current_user.last_login else None
                }
                logger.info(f"Current user data created using fallback method")
        except Exception as user_data_error:
            logger.error(f"Error creating current user data: {user_data_error}")
            return create_error_response("User data creation failed", 500)
        
        response = make_response(jsonify(user_data))
        
        # Add CORS headers
        origin = request.headers.get('Origin')
        if origin:
            allowed_origins = [
                'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
                'https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'https://scottohd.ngrok.io'
            ]
            
            if origin in allowed_origins or 'ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        return response, 200
        
    except Exception as e:
        logger.error(f"Error in get_current_user: {e}")
        logger.error(f"get_current_user traceback: {traceback.format_exc()}")
        return create_error_response("Failed to get user information", 500)

@auth_bp.route('/change-password', methods=['POST', 'OPTIONS'])
@login_required
def change_password():
    """Allow user to change their password with comprehensive validation"""
    # Handle CORS preflight
    cors_response = handle_cors_preflight()
    if cors_response:
        return cors_response
    
    try:
        # Validate models are available
        models_valid, models_message = validate_models()
        if not models_valid:
            logger.error(f"Models validation failed in change_password: {models_message}")
            return create_error_response(f"Authentication system not available: {models_message}", 500)
        
        data = request.json
        if not data:
            return create_error_response("No data provided", 400)
        
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        
        if not current_password or not new_password:
            return create_error_response("Current password and new password are required", 400)
        
        if len(new_password) < 6:
            return create_error_response("New password must be at least 6 characters long", 400)
        
        # Verify current password
        try:
            if not current_user.check_password(current_password):
                logger.warning(f"Password change failed: incorrect current password for user {current_user.username}")
                return create_error_response("Current password is incorrect", 401)
        except Exception as password_check_error:
            logger.error(f"Error checking current password: {password_check_error}")
            return create_error_response("Password verification failed", 500)
        
        # Update password
        try:
            current_user.set_password(new_password)
            db.session.commit()
            logger.info(f"Password changed successfully for user {current_user.username}")
        except Exception as password_update_error:
            logger.error(f"Error updating password: {password_update_error}")
            return create_error_response("Failed to update password", 500)
        
        response_data = {
            'message': 'Password changed successfully',
            'timestamp': datetime.utcnow().isoformat()
        }
        
        response = make_response(jsonify(response_data))
        
        # Add CORS headers
        origin = request.headers.get('Origin')
        if origin:
            allowed_origins = [
                'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
                'https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'https://scottohd.ngrok.io'
            ]
            
            if origin in allowed_origins or 'ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        return response, 200
        
    except Exception as e:
        logger.error(f"Password change error: {str(e)}")
        logger.error(f"Password change traceback: {traceback.format_exc()}")
        return create_error_response("Failed to change password", 500)

# User Management Routes (Admin Only)
@auth_bp.route('/users', methods=['GET', 'OPTIONS'])
@login_required
def get_users():
    """Get all users (admin only) with comprehensive error handling"""
    # Handle CORS preflight
    cors_response = handle_cors_preflight()
    if cors_response:
        return cors_response
    
    try:
        # Import admin_required decorator safely
        try:
            from middleware.auth import admin_required
            # Check admin permissions
            if current_user.role != 'admin':
                logger.warning(f"Non-admin user {current_user.username} attempted to access users list")
                return create_error_response("Admin access required", 403)
        except ImportError:
            # Fallback admin check
            if not hasattr(current_user, 'role') or current_user.role != 'admin':
                logger.warning(f"Non-admin user attempted to access users list")
                return create_error_response("Admin access required", 403)
        
        # Validate models are available
        models_valid, models_message = validate_models()
        if not models_valid:
            logger.error(f"Models validation failed in get_users: {models_message}")
            return create_error_response(f"User system not available: {models_message}", 500)
        
        # Get all users with error handling
        try:
            users = User.query.order_by(User.role, User.first_name).all()
            logger.info(f"Retrieved {len(users)} users for admin {current_user.username}")
        except Exception as db_error:
            logger.error(f"Database error retrieving users: {db_error}")
            return create_error_response("Database error retrieving users", 500)
        
        # Create users response data
        try:
            users_data = []
            for user in users:
                if hasattr(user, 'to_dict'):
                    user_data = user.to_dict()
                else:
                    # Fallback user data creation
                    user_data = {
                        'id': user.id,
                        'username': user.username,
                        'first_name': getattr(user, 'first_name', ''),
                        'last_name': getattr(user, 'last_name', ''),
                        'email': getattr(user, 'email', ''),
                        'role': getattr(user, 'role', 'user'),
                        'is_active': getattr(user, 'is_active', True),
                        'last_login': user.last_login.isoformat() if hasattr(user, 'last_login') and user.last_login else None
                    }
                users_data.append(user_data)
        except Exception as user_data_error:
            logger.error(f"Error creating users data: {user_data_error}")
            return create_error_response("User data creation failed", 500)
        
        response = make_response(jsonify(users_data))
        
        # Add CORS headers
        origin = request.headers.get('Origin')
        if origin:
            allowed_origins = [
                'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
                'https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'https://scottohd.ngrok.io'
            ]
            
            if origin in allowed_origins or 'ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        return response, 200
        
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        logger.error(f"Get users traceback: {traceback.format_exc()}")
        return create_error_response("Failed to fetch users", 500)

@auth_bp.route('/extend-session', methods=['POST', 'OPTIONS'])
@login_required
def extend_session():
    """Extend the current user session to prevent timeout during active work"""
    # Handle CORS preflight
    cors_response = handle_cors_preflight()
    if cors_response:
        return cors_response
    
    try:
        # Validate models are available
        models_valid, models_message = validate_models()
        if not models_valid:
            logger.error(f"Models validation failed in extend_session: {models_message}")
            return create_error_response(f"Session system not available: {models_message}", 500)
        
        # Update the user's last activity
        try:
            current_user.last_login = datetime.utcnow()
            db.session.commit()
            logger.info(f"Session extended for user {current_user.username}")
        except Exception as update_error:
            logger.error(f"Error updating last activity: {update_error}")
            return create_error_response("Failed to extend session", 500)
        
        response_data = {
            'success': True,
            'message': 'Session extended successfully',
            'expires_at': (datetime.utcnow() + timedelta(minutes=30)).isoformat(),
            'user_id': current_user.id,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        response = make_response(jsonify(response_data))
        
        # Add CORS headers
        origin = request.headers.get('Origin')
        if origin:
            allowed_origins = [
                'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
                'https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'https://scottohd.ngrok.io'
            ]
            
            if origin in allowed_origins or 'ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        return response, 200
        
    except Exception as e:
        logger.error(f"Error extending session: {str(e)}")
        logger.error(f"Extend session traceback: {traceback.format_exc()}")
        return create_error_response("Failed to extend session", 500)

@auth_bp.route('/users/<int:user_id>/reset-password', methods=['POST', 'OPTIONS'])
@login_required
def reset_user_password(user_id):
    """Admin endpoint to reset a specific user's password with comprehensive validation"""
    # Handle CORS preflight
    cors_response = handle_cors_preflight()
    if cors_response:
        return cors_response
    
    try:
        # Check admin permissions
        if not hasattr(current_user, 'role') or current_user.role != 'admin':
            logger.warning(f"Non-admin user {current_user.username} attempted to reset password for user {user_id}")
            return create_error_response("Admin access required", 403)
        
        # Validate models are available
        models_valid, models_message = validate_models()
        if not models_valid:
            logger.error(f"Models validation failed in reset_user_password: {models_message}")
            return create_error_response(f"User system not available: {models_message}", 500)
        
        # Prevent an admin from resetting their own password via this endpoint
        if current_user.id == user_id:
            logger.warning(f"Admin {current_user.username} attempted to reset own password via admin endpoint")
            return create_error_response("You cannot reset your own password via this admin endpoint. Please use the 'Change Password' feature.", 403)
        
        # Find the user to reset
        try:
            user = User.query.get(user_id)
            if not user:
                logger.warning(f"Password reset failed: User ID {user_id} not found")
                return create_error_response("User not found", 404)
        except Exception as db_error:
            logger.error(f"Database error finding user {user_id}: {db_error}")
            return create_error_response("Database error finding user", 500)
        
        # Get and validate new password
        data = request.get_json()
        if not data:
            return create_error_response("No data provided", 400)
        
        new_password = data.get('new_password', '')
        
        if not new_password:
            return create_error_response("New password is required", 400)
        
        if len(new_password) < 6:
            return create_error_response("New password must be at least 6 characters long", 400)
        
        # Update password
        try:
            user.set_password(new_password)
            db.session.commit()
            logger.info(f"Admin {current_user.username} reset password for user ID {user_id} ({user.username})")
        except Exception as password_update_error:
            logger.error(f"Error resetting password for user ID {user_id}: {password_update_error}")
            return create_error_response("Failed to reset password", 500)
        
        response_data = {
            'message': f'Password for user {user.username} reset successfully',
            'timestamp': datetime.utcnow().isoformat()
        }
        
        response = make_response(jsonify(response_data))
        
        # Add CORS headers
        origin = request.headers.get('Origin')
        if origin:
            allowed_origins = [
                'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
                'https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'https://scottohd.ngrok.io'
            ]
            
            if origin in allowed_origins or 'ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        return response, 200
        
    except Exception as e:
        logger.error(f"Error resetting password for user ID {user_id}: {str(e)}")
        logger.error(f"Reset password traceback: {traceback.format_exc()}")
        return create_error_response("Failed to reset password", 500)

@auth_bp.route('/test', methods=['GET', 'POST', 'OPTIONS'])
def test():
    """Test endpoint for debugging auth blueprint and model availability"""
    # Handle CORS preflight
    cors_response = handle_cors_preflight()
    if cors_response:
        return cors_response
    
    try:
        # Validate models
        models_valid, models_message = validate_models()
        
        test_data = {
            'message': 'Auth blueprint is working',
            'timestamp': datetime.utcnow().isoformat(),
            'method': request.method,
            'endpoint': '/api/auth/test',
            'models_available': models_valid,
            'models_message': models_message,
            'import_error': import_error,
            'db_available': db is not None,
            'user_model_available': User is not None
        }
        
        # Test database connection if models are available
        if models_valid:
            try:
                user_count = User.query.count()
                test_data['database'] = {
                    'connected': True,
                    'user_count': user_count
                }
                logger.info(f"Auth test successful: {user_count} users in database")
            except Exception as db_error:
                test_data['database'] = {
                    'connected': False,
                    'error': str(db_error)
                }
                logger.error(f"Auth test database error: {db_error}")
        else:
            test_data['database'] = {
                'connected': False,
                'error': 'Models not available'
            }
        
        # Add current user info if authenticated
        try:
            if hasattr(current_user, 'is_authenticated') and current_user.is_authenticated:
                test_data['current_user'] = {
                    'authenticated': True,
                    'username': current_user.username,
                    'role': getattr(current_user, 'role', 'unknown'),
                    'id': current_user.id
                }
            else:
                test_data['current_user'] = {
                    'authenticated': False,
                    'username': None,
                    'role': None,
                    'id': None
                }
        except Exception as user_error:
            test_data['current_user'] = {
                'authenticated': False,
                'error': str(user_error)
            }
        
        response = make_response(jsonify(test_data))
        
        # Add CORS headers
        origin = request.headers.get('Origin')
        if origin:
            allowed_origins = [
                'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
                'https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'https://scottohd.ngrok.io'
            ]
            
            if origin in allowed_origins or 'ngrok' in origin or 'localhost' in origin or '127.0.0.1' in origin:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        return response, 200
        
    except Exception as e:
        logger.error(f"Auth test error: {e}")
        logger.error(f"Auth test traceback: {traceback.format_exc()}")
        return create_error_response("Auth test failed", 500)

# Log blueprint creation and route registration
logger.info("Auth blueprint created with enhanced error handling and CORS support")
logger.info("Available routes:")
logger.info("  POST /login - User authentication")
logger.info("  POST /logout - User logout")
logger.info("  GET /me - Get current user")
logger.info("  POST /change-password - Change password")
logger.info("  GET /users - Get all users (admin)")
logger.info("  POST /extend-session - Extend user session")
logger.info("  POST /users/<id>/reset-password - Reset user password (admin)")
logger.info("  GET/POST /test - Test endpoint for debugging")
logger.info(f"Models import status: {models_valid if db and User else 'FAILED'}")
if import_error:
    logger.error(f"Models import error: {import_error}")