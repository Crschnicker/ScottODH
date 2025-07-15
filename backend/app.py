# backend/app.py
# Fixed Flask application with proper CORS configuration for Choreo

import os
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_migrate import Migrate
from flask_login import LoginManager

# Local Imports
from config import config, get_config_name
from models import db

def create_app(config_name=None):
    """
    Application factory pattern. This function creates and configures the Flask app.
    Enhanced with proper CORS handling for Choreo deployment.
    """
    if config_name is None:
        config_name = get_config_name()

    app = Flask(__name__)
    config_obj = config[config_name]
    app.config.from_object(config_obj)
    
    # Enhanced logging for production debugging
    logging.basicConfig(
        level=getattr(logging, app.config.get('LOG_LEVEL', 'INFO')),
        format='%(asctime)s %(levelname)s: %(message)s'
    )
    app.logger.info(f'Starting application with {config_name} configuration')
    app.logger.info(f'CORS Origins configured: {app.config.get("CORS_ORIGINS", [])}')

    # Initialize Extensions
    db.init_app(app)
    Migrate(app, db)

    # FIXED: Enhanced CORS Configuration for Choreo
    # This comprehensive CORS setup handles all the cross-origin issues
    cors_instance = CORS(app,
        origins=app.config.get('CORS_ORIGINS', []),
        supports_credentials=True,
        
        # FIXED: Comprehensive list of allowed headers to prevent preflight failures
        allow_headers=[
            "Accept",
            "Accept-Encoding",
            "Accept-Language",
            "Authorization",
            "Cache-Control",  # This was causing the error
            "Content-Length",
            "Content-Type",
            "Cookie",
            "DNT",
            "Host",
            "Origin",
            "Pragma",
            "Referer",
            "Sec-Fetch-Dest",
            "Sec-Fetch-Mode", 
            "Sec-Fetch-Site",
            "User-Agent",
            "X-Client-Info",
            "X-Forwarded-For",
            "X-Forwarded-Host",
            "X-Forwarded-Proto",
            "X-Requested-With"
        ],
        
        # FIXED: Comprehensive list of allowed methods
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
        
        # FIXED: Additional CORS settings for better compatibility
        expose_headers=["Content-Type", "Authorization"],
        max_age=86400,  # Cache preflight responses for 24 hours
        send_wildcard=False,  # Don't send wildcard origins when credentials are used
        vary_header=True  # Add Vary: Origin header
    )
    
    # FIXED: Enhanced CORS error handling
    @app.after_request
    def after_request(response):
        """
        Enhanced CORS headers handling for Choreo deployment.
        This ensures proper CORS headers are always present.
        """
        origin = request.headers.get('Origin')
        
        # Log CORS request details for debugging
        app.logger.debug(f'CORS request from origin: {origin}')
        app.logger.debug(f'Request method: {request.method}')
        app.logger.debug(f'Request headers: {dict(request.headers)}')
        
        # Ensure credentials header is explicitly set
        if origin and origin in app.config.get('CORS_ORIGINS', []):
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Origin'] = origin
            app.logger.debug(f'CORS: Allowed origin {origin} with credentials')
        elif '*' in app.config.get('CORS_ORIGINS', []):
            response.headers['Access-Control-Allow-Origin'] = '*'
            # Note: Cannot use credentials with wildcard origin
            app.logger.debug('CORS: Using wildcard origin (no credentials)')
        
        # Ensure proper headers for preflight requests
        if request.method == 'OPTIONS':
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH'
            response.headers['Access-Control-Allow-Headers'] = 'Accept, Authorization, Cache-Control, Content-Type, Origin, Pragma, X-Requested-With'
            response.headers['Access-Control-Max-Age'] = '86400'
            app.logger.debug('CORS: Handled preflight request')
        
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
        from routes.auth import auth_bp
        # from routes.customers import customers_bp # Add other blueprints as needed

        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        # app.register_blueprint(customers_bp, url_prefix='/api/customers')

        # Create database tables
        try:
            db.create_all()
            app.logger.info('Database tables created successfully')
        except Exception as e:
            app.logger.error(f'Error creating database tables: {str(e)}')

    # FIXED: Enhanced Global Error Handlers with better logging
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 errors with proper CORS headers."""
        app.logger.warning(f'404 error: {request.url} from {request.remote_addr}')
        response = jsonify({
            'error': 'Not Found', 
            'message': 'The requested resource was not found on the server.',
            'path': request.path
        })
        response.status_code = 404
        return response

    @app.errorhandler(500)
    def internal_server_error(error):
        """Handle 500 errors with proper cleanup."""
        app.logger.error(f'500 error: {str(error)} at {request.url}')
        db.session.rollback()
        response = jsonify({
            'error': 'Internal Server Error', 
            'message': 'An unexpected error occurred.'
        })
        response.status_code = 500
        return response

    @app.errorhandler(400)
    def bad_request(error):
        """Handle 400 errors with detailed messages."""
        app.logger.warning(f'400 error: {error.description} at {request.url}')
        response = jsonify({
            'error': 'Bad Request', 
            'message': error.description or 'The request was malformed.'
        })
        response.status_code = 400
        return response

    @app.errorhandler(403)
    def forbidden(error):
        """Handle 403 errors."""
        app.logger.warning(f'403 error: Access forbidden to {request.url} from {request.remote_addr}')
        response = jsonify({
            'error': 'Forbidden', 
            'message': 'You do not have permission to access this resource.'
        })
        response.status_code = 403
        return response

    # FIXED: Enhanced Health Check Endpoint with database and CORS testing
    @app.route('/api/health')
    def health_check():
        """
        Comprehensive health check endpoint for monitoring and CORS testing.
        Tests database connectivity and returns system status.
        """
        health_data = {
            'status': 'healthy',
            'timestamp': db.func.now(),
            'environment': config_name,
            'cors_configured': True,
            'database': 'unknown'
        }
        
        # Test database connectivity
        try:
            # Simple database query to test connection
            db.session.execute('SELECT 1')
            db.session.commit()
            health_data['database'] = 'connected'
            app.logger.debug('Health check: Database connection successful')
        except Exception as e:
            health_data['database'] = 'disconnected'
            health_data['status'] = 'unhealthy'
            health_data['database_error'] = str(e)
            app.logger.error(f'Health check: Database connection failed: {str(e)}')
            
            response = jsonify(health_data)
            response.status_code = 503
            return response
        
        # Add CORS information for debugging
        origin = request.headers.get('Origin')
        if origin:
            health_data['cors_origin'] = origin
            health_data['cors_allowed'] = origin in app.config.get('CORS_ORIGINS', [])
        
        app.logger.debug(f'Health check successful from origin: {origin}')
        return jsonify(health_data)

    # FIXED: Additional endpoint for CORS debugging
    @app.route('/api/cors-test')
    def cors_test():
        """
        Dedicated CORS testing endpoint for frontend debugging.
        Returns CORS configuration and request details.
        """
        origin = request.headers.get('Origin')
        cors_info = {
            'request_origin': origin,
            'configured_origins': app.config.get('CORS_ORIGINS', []),
            'origin_allowed': origin in app.config.get('CORS_ORIGINS', []) if origin else False,
            'credentials_supported': True,
            'request_headers': dict(request.headers),
            'timestamp': db.func.now()
        }
        
        app.logger.info(f'CORS test request from: {origin}')
        return jsonify(cors_info)

    # Log startup information
    app.logger.info(f'Flask application created successfully with {config_name} configuration')
    app.logger.info(f'CORS origins: {app.config.get("CORS_ORIGINS", [])}')
    
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
        threaded=True  # Enable threading for better performance
    )