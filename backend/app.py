# backend/app.py
# Complete Flask backend optimized for Choreo's multi-service architecture
# Handles communication between frontend and backend services properly

import os
import logging
from flask import Flask, jsonify, request, make_response, session
from flask_migrate import Migrate
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from datetime import datetime, timedelta
import secrets

# Local Imports
from config import config, get_config_name
from models import db

def create_app(config_name=None):
    """
    Production Flask application factory optimized for Choreo's service architecture.
    Ensures proper communication between scott-frontend and backend services.
    """
    if config_name is None:
        config_name = get_config_name()

    app = Flask(__name__)
    
    # Load configuration with proper error handling
    config_class = config[config_name]
    if isinstance(config_class, type):
        config_obj = config_class()
    else:
        config_obj = config_class
    
    app.config.from_object(config_obj)
    
    # Ensure SECRET_KEY exists for session management
    if not app.config.get('SECRET_KEY'):
        app.config['SECRET_KEY'] = secrets.token_urlsafe(32)
        app.logger.warning('Generated temporary SECRET_KEY - set environment variable')
    
    # Configure session for Choreo's cross-service communication
    app.config.update(
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='None',  # Critical for cross-origin requests in Choreo
        PERMANENT_SESSION_LIFETIME=timedelta(hours=24),
        SESSION_COOKIE_NAME='scott_auth',
        SESSION_REFRESH_EACH_REQUEST=True,
        SESSION_COOKIE_DOMAIN=None  # Let Choreo handle domain management
    )
    
    # Production logging setup
    logging.basicConfig(
        level=getattr(logging, app.config.get('LOG_LEVEL', 'INFO')),
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
    )
    
    app.logger.info('🚀 SCOTT OVERHEAD DOORS BACKEND - Starting')
    app.logger.info(f'📋 Environment: {config_name}')
    app.logger.info(f'🏗️ Choreo Architecture: Backend Service')
    
    # Log database configuration safely
    try:
        db_uri = getattr(config_obj, 'SQLALCHEMY_DATABASE_URI', 'Not configured')
        if isinstance(db_uri, str) and len(db_uri) > 50:
            db_display = db_uri[:50] + '...'
        else:
            db_display = str(db_uri)
        app.logger.info(f'🗄️ Database: {db_display}')
    except Exception as e:
        app.logger.warning(f'Database configuration logging failed: {e}')

    # Initialize Flask extensions
    db.init_app(app)
    migrate = Migrate(app, db)

    # Configure Flask-Login for robust session management across services
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.session_protection = 'strong'
    login_manager.remember_cookie_secure = True
    login_manager.remember_cookie_httponly = True
    login_manager.remember_cookie_duration = timedelta(days=7)
    login_manager.needs_refresh_message = 'Session expired, please log in again'
    login_manager.needs_refresh_message_category = 'info'

    @login_manager.user_loader
    def load_user(user_id):
        """Load user for session management with comprehensive validation."""
        try:
            from models import User
            user = User.query.get(int(user_id))
            if user and user.is_active:
                return user
            return None
        except (ValueError, TypeError):
            app.logger.warning(f'Invalid user ID format: {user_id}')
            return None
        except Exception as e:
            app.logger.error(f'Error loading user {user_id}: {e}')
            return None

    @login_manager.unauthorized_handler
    def unauthorized():
        """Handle unauthorized access with clear JSON response for frontend."""
        app.logger.warning(f'Unauthorized access to {request.endpoint} from {request.remote_addr}')
        return jsonify({
            'error': 'Authentication required',
            'message': 'Please log in to access this resource',
            'status': 401,
            'redirect': '/login'
        }), 401

    # Request logging for debugging cross-service communication
    @app.before_request
    def log_request_info():
        """Log request details for debugging frontend-backend communication."""
        origin = request.headers.get('Origin', 'No origin')
        referer = request.headers.get('Referer', 'No referer')
        user_agent = request.headers.get('User-Agent', 'No user agent')
        
        app.logger.info(f'📨 {request.method} {request.path} from {origin}')
        
        if app.config.get('LOG_LEVEL') == 'DEBUG':
            app.logger.debug(f'🔍 Headers: Origin={origin}, Referer={referer}')
            app.logger.debug(f'🍪 Cookies: {list(request.cookies.keys())}')
            
            if request.is_json and request.method in ['POST', 'PUT', 'PATCH']:
                try:
                    data = request.get_json()
                    # Mask sensitive data for logging
                    safe_data = {}
                    for key, value in data.items():
                        if 'password' in key.lower():
                            safe_data[key] = '***masked***'
                        else:
                            safe_data[key] = value
                    app.logger.debug(f'📄 Request data: {safe_data}')
                except Exception:
                    app.logger.debug('📄 Request contains non-JSON data')

    # Add response headers for Choreo service communication
    @app.after_request
    def add_response_headers(response):
        """Add headers to improve cross-service communication in Choreo."""
        # Add CORS headers for frontend service communication
        origin = request.headers.get('Origin')
        
        # Define allowed origins for Choreo services
        allowed_origins = [
            'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',  # Frontend service
            'https://*.choreoapps.dev',
            'https://*.e1-us-east-azure.choreoapps.dev'
        ]
        
        # Check if origin is allowed (including wildcard matching)
        origin_allowed = False
        if origin:
            for allowed in allowed_origins:
                if '*' in allowed:
                    domain_pattern = allowed.replace('*', '')
                    if origin.endswith(domain_pattern.lstrip('.')):
                        origin_allowed = True
                        break
                elif origin == allowed:
                    origin_allowed = True
                    break
        
        # Set CORS headers if origin is allowed
        if origin_allowed:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true' # <-- ADDED/CONFIRMED THIS LINE
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            # CORRECTED: Removed 'Access-Control-Allow-Origin' from allowed request headers
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With' 
            response.headers['Access-Control-Max-Age'] = '86400'
            app.logger.debug(f'✅ CORS headers set for origin: {origin}')
        
        # Add security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # Ensure proper content type for JSON responses
        if response.content_type and 'application/json' in response.content_type:
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        
        return response

    # Handle preflight OPTIONS requests explicitly
    @app.before_request
    def handle_preflight():
        """Handle CORS preflight requests for Choreo service communication."""
        if request.method == 'OPTIONS':
            origin = request.headers.get('Origin')
            app.logger.info(f'🔄 Preflight request from {origin}')
            
            # Create preflight response
            response = make_response('', 200)
            
            # Set CORS headers for preflight
            if origin:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true' # <-- ADDED/CONFIRMED THIS LINE
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                # CORRECTED: Removed 'Access-Control-Allow-Origin' from allowed request headers
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With' 
                response.headers['Access-Control-Max-Age'] = '86400'
                app.logger.info(f'✅ Preflight response sent to {origin}')
            
            return response

    # Initialize application context with comprehensive setup
    with app.app_context():
        # Register authentication blueprint (required)
        try:
            from routes.auth import auth_bp
            app.register_blueprint(auth_bp, url_prefix='/api/auth')
            app.logger.info('✅ Authentication blueprint registered successfully')
        except ImportError as e:
            app.logger.error(f'❌ Critical: Cannot import auth blueprint: {e}')
            raise RuntimeError('Authentication module is required but not found')
        except Exception as e:
            app.logger.error(f'❌ Critical: Error registering auth blueprint: {e}')
            raise

        # Register optional feature blueprints
        optional_blueprints = [
            ('routes.customers', 'customers_bp', '/api/customers', 'Customer management'),
            ('routes.jobs', 'jobs_bp', '/api/jobs', 'Job management'),
            ('routes.estimates', 'estimates_bp', '/api/estimates', 'Estimate management'),
            ('routes.bids', 'bids_bp', '/api/bids', 'Bid management'),
            ('routes.mobile', 'mobile_bp', '/api/mobile', 'Mobile functionality'),
            ('routes.sites', 'sites_bp', '/api/sites', 'Site management'),
            ('routes.audio', 'audio_bp', '/api/audio', 'Audio features'),
            ('routes.line_items', 'line_items_bp', '/api/line-items', 'Line item management'),
        ]
        
        registered_blueprints = []
        for module_name, blueprint_name, url_prefix, description in optional_blueprints:
            try:
                module = __import__(module_name, fromlist=[blueprint_name])
                blueprint = getattr(module, blueprint_name)
                app.register_blueprint(blueprint, url_prefix=url_prefix)
                registered_blueprints.append(description)
                app.logger.info(f'✅ {description} blueprint registered')
            except ImportError:
                app.logger.info(f'ℹ️ {description} blueprint not available (optional)')
            except Exception as e:
                app.logger.warning(f'⚠️ Error registering {description} blueprint: {e}')

        # Database initialization with user management
        try:
            # Create all database tables
            db.create_all()
            app.logger.info('✅ Database tables created successfully')
            
            # Import User model
            from models import User
            
            # Create admin user if not exists
            admin_user = User.query.filter_by(role='admin').first()
            if not admin_user:
                try:
                    admin_user = User(
                        username='admin',
                        email='admin@scottoverheaddoors.com',
                        first_name='System',
                        last_name='Administrator',
                        role='admin'
                    )
                    admin_user.set_password('admin123')  # Change in production
                    db.session.add(admin_user)
                    db.session.commit()
                    app.logger.info('✅ Created admin user: admin/admin123')
                except Exception as e:
                    app.logger.error(f'❌ Failed to create admin user: {e}')
                    db.session.rollback()
            
            # Create kelly user for testing
            kelly_user = User.query.filter_by(username='kelly').first()
            if not kelly_user:
                try:
                    kelly_user = User(
                        username='kelly',
                        email='kelly@scottoverheaddoors.com',
                        first_name='Kelly',
                        last_name='Field',
                        role='field'
                    )
                    kelly_user.set_password('kelly123')
                    db.session.add(kelly_user)
                    db.session.commit()
                    app.logger.info('✅ Created kelly user: kelly/kelly123')
                except Exception as e:
                    app.logger.error(f'❌ Failed to create kelly user: {e}')
                    db.session.rollback()
            
            # Log user statistics
            try:
                total_users = User.query.count()
                active_users = User.query.filter_by(is_active=True).count()
                admin_count = User.query.filter_by(role='admin').count()
                field_count = User.query.filter_by(role='field').count()
                
                app.logger.info(f'📊 Users: {total_users} total, {active_users} active')
                app.logger.info(f'📊 Roles: {admin_count} admin, {field_count} field')
            except Exception as e:
                app.logger.warning(f'Could not retrieve user statistics: {e}')
                
        except Exception as e:
            app.logger.error(f'❌ Database setup failed: {e}')
            raise RuntimeError(f'Database initialization failed: {e}')

    # Error handlers that return proper JSON for frontend consumption
    @app.errorhandler(400)
    def handle_bad_request(error):
        app.logger.warning(f'400 Bad Request: {request.path} - {error.description}')
        return jsonify({
            'error': 'Bad Request',
            'message': error.description or 'The request was malformed',
            'status': 400,
            'path': request.path
        }), 400

    @app.errorhandler(401)
    def handle_unauthorized(error):
        app.logger.warning(f'401 Unauthorized: {request.path}')
        return jsonify({
            'error': 'Authentication Required',
            'message': 'Please log in to access this resource',
            'status': 401,
            'login_required': True
        }), 401

    @app.errorhandler(403)
    def handle_forbidden(error):
        user = getattr(current_user, 'username', 'Anonymous')
        app.logger.warning(f'403 Forbidden: {request.path} by {user}')
        return jsonify({
            'error': 'Access Forbidden',
            'message': 'You do not have permission to access this resource',
            'status': 403
        }), 403

    @app.errorhandler(404)
    def handle_not_found(error):
        app.logger.warning(f'404 Not Found: {request.path}')
        return jsonify({
            'error': 'Not Found',
            'message': 'The requested resource was not found',
            'status': 404,
            'path': request.path
        }), 404

    @app.errorhandler(500)
    def handle_internal_error(error):
        app.logger.error(f'500 Internal Error: {request.path} - {str(error)}')
        try:
            db.session.rollback()
        except Exception:
            pass
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred',
            'status': 500
        }), 500

    # Service health and communication endpoints
    @app.route('/api/health')
    def health_check():
        """
        Comprehensive health check endpoint for Choreo service monitoring.
        Provides detailed status for frontend-backend communication verification.
        """
        origin = request.headers.get('Origin')
        app.logger.info(f'🏥 Health check from {origin}')
        
        health_data = {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'service': 'scott-overhead-doors-backend',
            'version': '1.0.0',
            'environment': config_name,
            'choreo_architecture': 'multi-service',
            'database_status': 'unknown',
            'auth_system': 'active',
            'registered_blueprints': len([bp for bp in app.blueprints.keys()]),
            'communication': {
                'frontend_origin': origin,
                'cors_enabled': True,
                'session_configured': True
            }
        }
        
        # Test database connectivity
        try:
            db.session.execute(db.text('SELECT 1'))
            from models import User
            user_count = User.query.count()
            db.session.commit()
            
            health_data.update({
                'database_status': 'connected',
                'database_type': 'postgresql',
                'user_count': user_count
            })
            
        except Exception as e:
            health_data.update({
                'database_status': 'error',
                'database_error': str(e)[:200],
                'status': 'degraded'
            })
            app.logger.error(f'Health check database error: {e}')
            return jsonify(health_data), 503
        
        app.logger.info(f'✅ Health check successful')
        return jsonify(health_data)

    @app.route('/api/service-info')
    def service_info():
        """Provide service information for frontend discovery and configuration."""
        return jsonify({
            'service_name': 'scott-overhead-doors-backend',
            'version': '1.0.0',
            'choreo_service': True,
            'endpoints': {
                'health': '/api/health',
                'auth': '/api/auth',
                'login': '/api/auth/login',
                'logout': '/api/auth/logout',
                'current_user': '/api/auth/me'
            },
            'cors_configured': True,
            'session_management': 'flask-login',
            'database': 'postgresql',
            'timestamp': datetime.utcnow().isoformat()
        })

    @app.route('/api/communication-test')
    def communication_test():
        """Test endpoint specifically for verifying frontend-backend communication."""
        origin = request.headers.get('Origin')
        user_agent = request.headers.get('User-Agent', 'Unknown')
        
        app.logger.info(f'🔗 Communication test from {origin}')
        
        return jsonify({
            'status': 'success',
            'message': 'Frontend-backend communication is working',
            'timestamp': datetime.utcnow().isoformat(),
            'request_info': {
                'origin': origin,
                'user_agent': user_agent[:100] if user_agent else None,
                'method': request.method,
                'path': request.path,
                'cookies_received': len(request.cookies),
                'headers_count': len(request.headers)
            },
            'backend_info': {
                'service': 'scott-overhead-doors-backend',
                'environment': config_name,
                'cors_enabled': True,
                'session_ready': True
            }
        })

    # Log successful application creation
    app.logger.info('🎯 Backend service created successfully')
    app.logger.info(f'🔧 Registered blueprints: {len(app.blueprints)}')
    app.logger.info(f'🌐 CORS configured for cross-service communication')
    app.logger.info(f'🍪 Session management configured for Choreo architecture')
    app.logger.info('🚀 Ready for frontend service communication')
    
    return app

# Create application instance
app = create_app()

# Production startup configuration for Choreo
if __name__ == '__main__':
    try:
        port = int(os.environ.get('PORT', 8080))
        host = os.environ.get('HOST', '0.0.0.0')
        debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
        
        app.logger.info(f'🚀 Starting Scott Overhead Doors Backend Service')
        app.logger.info(f'🌐 Server: {host}:{port}')
        app.logger.info(f'🐛 Debug mode: {debug_mode}')
        app.logger.info(f'🏗️ Choreo multi-service architecture')
        
        app.run(
            host=host,
            port=port,
            debug=debug_mode,
            threaded=True,
            use_reloader=False
        )
        
    except Exception as e:
        app.logger.error(f'❌ Failed to start backend service: {e}')
        raise