# backend/app.py
# Bulletproof CORS solution for Choreo deployment

import os
import logging
from flask import Flask, jsonify, request, make_response
from flask_migrate import Migrate
from flask_login import LoginManager

# Local Imports
from config import config, get_config_name
from models import db

def create_app(config_name=None):
    """
    Application factory with bulletproof CORS handling.
    This completely bypasses Flask-CORS and handles CORS manually for maximum control.
    """
    if config_name is None:
        config_name = get_config_name()

    app = Flask(__name__)
    config_obj = config[config_name]
    app.config.from_object(config_obj)
    
    # Enhanced logging
    logging.basicConfig(
        level=getattr(logging, app.config.get('LOG_LEVEL', 'INFO')),
        format='%(asctime)s %(levelname)s: %(message)s'
    )
    app.logger.info(f'Starting application with {config_name} configuration')
    app.logger.info(f'Database URI: {app.config.get("SQLALCHEMY_DATABASE_URI", "Not set")[:50]}...')

    # Initialize Extensions
    db.init_app(app)
    Migrate(app, db)

    # CORS Configuration - Manual implementation for maximum control
    cors_origins = app.config.get('CORS_ORIGINS', [])
    frontend_origin = 'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev'
    
    # Ensure the exact frontend origin is included
    if frontend_origin not in cors_origins:
        cors_origins.append(frontend_origin)
    
    app.logger.info(f'Final CORS origins list: {cors_origins}')

    def is_origin_allowed(origin):
        """Check if the origin is allowed with support for wildcards."""
        if not origin:
            return False
        
        # Check exact matches first
        if origin in cors_origins:
            return True
        
        # Check wildcard patterns
        for allowed_origin in cors_origins:
            if '*' in allowed_origin:
                # Convert wildcard pattern to regex-like matching
                pattern = allowed_origin.replace('*', '')
                if pattern and origin.endswith(pattern.lstrip('.')):
                    return True
        
        return False

    def add_cors_headers(response, origin=None):
        """Add CORS headers to response with explicit credential support."""
        if origin is None:
            origin = request.headers.get('Origin')
        
        if origin and is_origin_allowed(origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            app.logger.debug(f'Added CORS headers for origin: {origin}')
        else:
            app.logger.debug(f'Origin not allowed: {origin}')
        
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD'
        response.headers['Access-Control-Allow-Headers'] = 'Accept, Authorization, Content-Type, Origin, X-Requested-With'
        response.headers['Access-Control-Max-Age'] = '86400'
        response.headers['Vary'] = 'Origin'
        
        return response

    # BULLETPROOF: Handle ALL OPTIONS requests at the app level
    @app.before_request
    def handle_preflight():
        """Handle preflight OPTIONS requests with guaranteed CORS headers."""
        if request.method == 'OPTIONS':
            origin = request.headers.get('Origin')
            app.logger.info(f'=== PREFLIGHT REQUEST ===')
            app.logger.info(f'Origin: {origin}')
            app.logger.info(f'Method: {request.method}')
            app.logger.info(f'Path: {request.path}')
            app.logger.info(f'Headers: {dict(request.headers)}')
            
            # Create response for preflight
            response = make_response('', 200)
            
            # Add CORS headers
            response = add_cors_headers(response, origin)
            
            app.logger.info(f'Preflight response headers: {dict(response.headers)}')
            app.logger.info(f'Access-Control-Allow-Credentials: "{response.headers.get("Access-Control-Allow-Credentials")}"')
            app.logger.info('=== END PREFLIGHT ===')
            
            return response

    # BULLETPROOF: Add CORS headers to ALL responses
    @app.after_request
    def after_request(response):
        """Add CORS headers to all responses."""
        origin = request.headers.get('Origin')
        
        # Always add CORS headers for valid origins
        response = add_cors_headers(response, origin)
        
        # Log for debugging
        if origin:
            app.logger.debug(f'{request.method} {request.path} from {origin}')
            app.logger.debug(f'Response status: {response.status_code}')
            app.logger.debug(f'Access-Control-Allow-Credentials: "{response.headers.get("Access-Control-Allow-Credentials")}"')
        
        return response

    # Setup Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        """Load user for Flask-Login sessions."""
        from models import User
        try:
            return User.query.get(int(user_id))
        except (ValueError, TypeError):
            app.logger.warning(f'Invalid user_id format: {user_id}')
            return None

    @login_manager.unauthorized_handler
    def unauthorized():
        """Handle unauthorized access attempts."""
        app.logger.warning(f'Unauthorized access attempt from {request.remote_addr}')
        return jsonify(
            error="Authentication required", 
            message="Please log in to access this resource."
        ), 401

    # Register Blueprints and Create Database
    with app.app_context():
        # Import and register auth blueprint
        try:
            from routes.auth import auth_bp
            app.register_blueprint(auth_bp, url_prefix='/api/auth')
            app.logger.info('✓ Auth blueprint imported successfully')
        except ImportError as e:
            app.logger.error(f'✗ Failed to import auth blueprint: {e}')
        
        # Import other blueprints as available
        blueprints = [
            ('routes.customers', 'customers_bp', '/api/customers'),
            ('routes.jobs', 'jobs_bp', '/api/jobs'),
            ('routes.estimates', 'estimates_bp', '/api/estimates'),
            ('routes.bids', 'bids_bp', '/api/bids'),
            ('routes.mobile', 'mobile_bp', '/api/mobile'),
            ('routes.sites', 'sites_bp', '/api/sites'),
            ('routes.audio', 'audio_bp', '/api/audio'),
            ('routes.line_items', 'line_items_bp', '/api/line-items'),
        ]
        
        for module_name, blueprint_name, url_prefix in blueprints:
            try:
                module = __import__(module_name, fromlist=[blueprint_name])
                blueprint = getattr(module, blueprint_name)
                app.register_blueprint(blueprint, url_prefix=url_prefix)
                app.logger.info(f'✓ {blueprint_name} imported successfully')
            except ImportError:
                app.logger.info(f'ℹ {blueprint_name} not available')
            except Exception as e:
                app.logger.error(f'✗ Error importing {blueprint_name}: {e}')

        # Create database tables and default users
        try:
            db.create_all()
            app.logger.info('Database tables created successfully')
            
            # Create default users
            from models import User
            
            # Create admin user if it doesn't exist
            if not User.query.filter_by(role='admin').first():
                try:
                    admin_user = User(
                        username='admin',
                        email='admin@scottoverheaddoors.com',
                        first_name='System',
                        last_name='Administrator',
                        role='admin'
                    )
                    admin_user.set_password('admin123')  # Change in production!
                    db.session.add(admin_user)
                    db.session.commit()
                    app.logger.info('Created default admin user: admin/admin123')
                except Exception as e:
                    app.logger.error(f'Could not create admin user: {e}')
                    db.session.rollback()
            
            # Create kelly user if it doesn't exist
            if not User.query.filter_by(username='kelly').first():
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
                    app.logger.info('Created kelly user: kelly/kelly123')
                except Exception as e:
                    app.logger.error(f'Could not create kelly user: {e}')
                    db.session.rollback()
                    
        except Exception as e:
            app.logger.error(f'Error setting up database: {str(e)}')

    # Global Error Handlers with CORS
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 errors with proper CORS headers."""
        app.logger.warning(f'404 error: {request.url} from {request.remote_addr}')
        response = make_response(jsonify({
            'error': 'Not Found', 
            'message': 'The requested resource was not found on the server.',
            'path': request.path
        }), 404)
        return add_cors_headers(response)

    @app.errorhandler(500)
    def internal_server_error(error):
        """Handle 500 errors with proper cleanup and CORS."""
        app.logger.error(f'500 error: {str(error)} at {request.url}')
        db.session.rollback()
        response = make_response(jsonify({
            'error': 'Internal Server Error', 
            'message': 'An unexpected error occurred.'
        }), 500)
        return add_cors_headers(response)

    @app.errorhandler(400)
    def bad_request(error):
        """Handle 400 errors with CORS."""
        app.logger.warning(f'400 error: {error.description} at {request.url}')
        response = make_response(jsonify({
            'error': 'Bad Request', 
            'message': error.description or 'The request was malformed.'
        }), 400)
        return add_cors_headers(response)

    @app.errorhandler(403)
    def forbidden(error):
        """Handle 403 errors with CORS."""
        app.logger.warning(f'403 error: Access forbidden to {request.url} from {request.remote_addr}')
        response = make_response(jsonify({
            'error': 'Forbidden', 
            'message': 'You do not have permission to access this resource.'
        }), 403)
        return add_cors_headers(response)

    # Enhanced Health Check Endpoint
    @app.route('/api/health')
    def health_check():
        """Comprehensive health check endpoint."""
        origin = request.headers.get('Origin')
        app.logger.info(f'Health check request from origin: {origin}')
        
        health_data = {
            'status': 'healthy',
            'timestamp': str(db.func.now()),
            'environment': config_name,
            'cors_configured': True,
            'database': 'unknown',
            'cors_origins': cors_origins,
            'request_origin': origin,
            'origin_allowed': is_origin_allowed(origin)
        }
        
        # Test database connectivity
        try:
            db.session.execute(db.text('SELECT 1'))
            db.session.commit()
            health_data['database'] = 'connected'
            app.logger.debug('Health check: Database connection successful')
        except Exception as e:
            health_data['database'] = 'disconnected'
            health_data['status'] = 'unhealthy'
            health_data['database_error'] = str(e)
            app.logger.error(f'Health check: Database connection failed: {str(e)}')
            
            response = make_response(jsonify(health_data), 503)
            return add_cors_headers(response)
        
        app.logger.info(f'Health check successful - returning data: {health_data}')
        response = make_response(jsonify(health_data))
        return add_cors_headers(response)

    # CORS Testing Endpoint
    @app.route('/api/cors-test')
    def cors_test():
        """Dedicated CORS testing endpoint."""
        origin = request.headers.get('Origin')
        
        cors_info = {
            'request_origin': origin,
            'configured_origins': cors_origins,
            'origin_allowed': is_origin_allowed(origin),
            'credentials_supported': True,
            'request_headers': dict(request.headers),
            'request_method': request.method,
            'timestamp': str(db.func.now()),
            'message': 'CORS test endpoint - if you can read this, CORS is working!'
        }
        
        app.logger.info(f'CORS test request from: {origin}')
        app.logger.info(f'CORS test data: {cors_info}')
        
        response = make_response(jsonify(cors_info))
        return add_cors_headers(response)

    # Authentication Test Endpoint
    @app.route('/api/auth-test', methods=['GET', 'POST', 'OPTIONS'])
    def auth_test():
        """Test endpoint for authentication flow."""
        origin = request.headers.get('Origin')
        
        test_data = {
            'message': 'Authentication test endpoint',
            'method': request.method,
            'origin': origin,
            'origin_allowed': is_origin_allowed(origin),
            'headers': dict(request.headers),
            'timestamp': str(db.func.now())
        }
        
        if request.method == 'POST':
            test_data['body'] = request.get_json() if request.is_json else None
        
        app.logger.info(f'Auth test {request.method} request from: {origin}')
        
        response = make_response(jsonify(test_data))
        return add_cors_headers(response)

    # Log startup information
    app.logger.info(f'Flask application created successfully with {config_name} configuration')
    app.logger.info(f'CORS origins: {cors_origins}')
    app.logger.info(f'Frontend origin: {frontend_origin}')
    
    return app

# Create and Run the Application
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    debug_mode = app.config.get('DEBUG', False)
    
    app.logger.info(f'Starting server on port {port} with debug={debug_mode}')
    app.run(
        host='0.0.0.0', 
        port=port, 
        debug=debug_mode,
        threaded=True
    )