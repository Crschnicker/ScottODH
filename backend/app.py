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
    app.logger.info(f'Database URI: {app.config.get("SQLALCHEMY_DATABASE_URI", "Not set")[:50]}...')
    app.logger.info(f'CORS Origins configured: {app.config.get("CORS_ORIGINS", [])}')

    # Initialize Extensions
    db.init_app(app)
    Migrate(app, db)

    # FIXED: Explicit CORS origins configuration
    cors_origins = app.config.get('CORS_ORIGINS', [])
    
    # Ensure the exact frontend origin is included
    frontend_origin = 'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev'
    if frontend_origin not in cors_origins:
        cors_origins.append(frontend_origin)
    
    app.logger.info(f'Final CORS origins list: {cors_origins}')

    # FIXED: Simplified CORS Configuration that explicitly handles credentials
    cors_instance = CORS(app,
        origins=cors_origins,
        supports_credentials=True,
        allow_headers=[
            "Accept",
            "Accept-Encoding", 
            "Accept-Language",
            "Authorization",
            "Content-Length",
            "Content-Type",
            "Cookie",
            "Origin",
            "Referer",
            "User-Agent",
            "X-Requested-With"
        ],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
        expose_headers=["Content-Type", "Authorization"],
        max_age=86400,
        send_wildcard=False,
        vary_header=True
    )

    # FIXED: Critical - Handle preflight OPTIONS requests explicitly
    @app.before_request
    def handle_preflight():
        """Handle preflight OPTIONS requests with proper CORS headers."""
        if request.method == "OPTIONS":
            origin = request.headers.get('Origin')
            app.logger.info(f'Preflight OPTIONS request from origin: {origin}')
            
            # Create empty response for preflight
            response = jsonify({})
            
            # FIXED: Explicitly set CORS headers for preflight
            if origin in cors_origins:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                app.logger.info(f'Set Access-Control-Allow-Credentials: true for origin: {origin}')
            else:
                app.logger.warning(f'Origin {origin} not in allowed origins: {cors_origins}')
            
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD'
            response.headers['Access-Control-Allow-Headers'] = 'Accept, Authorization, Content-Type, Origin, X-Requested-With'
            response.headers['Access-Control-Max-Age'] = '86400'
            response.headers['Vary'] = 'Origin'
            
            app.logger.info(f'Preflight response headers: {dict(response.headers)}')
            return response

    # FIXED: Ensure all responses have proper CORS headers
    @app.after_request
    def after_request(response):
        """Ensure proper CORS headers are set on all responses."""
        origin = request.headers.get('Origin')
        
        app.logger.debug(f'Processing {request.method} request from origin: {origin}')
        
        # FIXED: Always set credentials header for allowed origins
        if origin in cors_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            app.logger.debug(f'Set CORS headers for allowed origin: {origin}')
        else:
            app.logger.debug(f'Origin {origin} not in allowed origins list')
        
        # Always set Vary header for proper caching
        response.headers['Vary'] = 'Origin'
        
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
        
        # Register blueprints
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        
        # Import other blueprints as available
        try:
            from routes.customers import customers_bp
            app.register_blueprint(customers_bp, url_prefix='/api/customers')
        except ImportError:
            app.logger.info('Customers blueprint not available')
        
        try:
            from routes.jobs import jobs_bp
            app.register_blueprint(jobs_bp, url_prefix='/api/jobs')
        except ImportError:
            app.logger.info('Jobs blueprint not available')
        
        try:
            from routes.estimates import estimates_bp
            app.register_blueprint(estimates_bp, url_prefix='/api/estimates')
        except ImportError:
            app.logger.info('Estimates blueprint not available')

        try:
            from routes.bids import bids_bp
            app.register_blueprint(bids_bp, url_prefix='/api/bids')
        except ImportError:
            app.logger.info('Bids blueprint not available')

        # Create database tables
        try:
            db.create_all()
            app.logger.info('Database tables created successfully')
            
            # Create default admin user if it doesn't exist
            from models import User
            if not User.query.filter_by(role='admin').first():
                try:
                    admin_user = User(
                        username='admin',
                        email='admin@scottoverheaddoors.com',
                        first_name='System',
                        last_name='Administrator',
                        role='admin'
                    )
                    admin_user.set_password('admin123')  # Change this in production!
                    db.session.add(admin_user)
                    db.session.commit()
                    app.logger.info('Created default admin user: admin/admin123')
                except Exception as e:
                    app.logger.error(f'Could not create default admin user: {e}')
                    db.session.rollback()
                    
        except Exception as e:
            app.logger.error(f'Error creating database tables: {str(e)}')

    # Global Error Handlers with proper CORS headers
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

    # Health Check Endpoint with database and CORS testing
    @app.route('/api/health')
    def health_check():
        """
        Comprehensive health check endpoint for monitoring and CORS testing.
        Tests database connectivity and returns system status.
        """
        health_data = {
            'status': 'healthy',
            'timestamp': str(db.func.now()),
            'environment': config_name,
            'cors_configured': True,
            'database': 'unknown',
            'cors_origins': cors_origins
        }
        
        # Test database connectivity
        try:
            # Simple database query to test connection
            db.session.execute(db.text('SELECT 1'))
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
            health_data['cors_allowed'] = origin in cors_origins
        
        app.logger.debug(f'Health check successful from origin: {origin}')
        return jsonify(health_data)

    # CORS debugging endpoint
    @app.route('/api/cors-test')
    def cors_test():
        """
        Dedicated CORS testing endpoint for frontend debugging.
        Returns CORS configuration and request details.
        """
        origin = request.headers.get('Origin')
        cors_info = {
            'request_origin': origin,
            'configured_origins': cors_origins,
            'origin_allowed': origin in cors_origins if origin else False,
            'credentials_supported': True,
            'request_headers': dict(request.headers),
            'timestamp': str(db.func.now())
        }
        
        app.logger.info(f'CORS test request from: {origin}')
        return jsonify(cors_info)

    # Log startup information
    app.logger.info(f'Flask application created successfully with {config_name} configuration')
    app.logger.info(f'CORS origins: {cors_origins}')
    
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