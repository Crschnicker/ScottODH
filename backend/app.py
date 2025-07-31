# backend/app.py
import os
import logging
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_cors import CORS
from datetime import timedelta
from config import config

# Import database and models
from models import db, User

def create_app(config_name='production'):
    """Application factory function"""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config[config_name])
    
    # Ensure instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass
    
    # Initialize extensions
    db.init_app(app)
    
    # ✅ FIXED: Comprehensive CORS configuration for Azure deployment
    CORS(app, 
         origins=[
             'https://scott-overhead-doors.azurewebsites.net',  # Backend domain
             'https://gray-glacier-0afce1c0f.1.azurestaticapps.net',  # Your frontend domain
             'https://*.azurestaticapps.net',  # All Azure Static Web Apps
             'https://*.azurewebsites.net',  # All Azure App Services  
             'http://localhost:3000',  # Local development
             'http://localhost:3001',  # Alternative local port
             'http://127.0.0.1:3000',  # Local IP
         ], 
         supports_credentials=True,  # ✅ Critical for session auth
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
         allow_headers=[
             'Content-Type', 
             'Authorization', 
             'X-Requested-With',
             'Accept',
             'Origin',
             'Access-Control-Request-Method',
             'Access-Control-Request-Headers',
             'Cache-Control'
         ],
         expose_headers=['Content-Type', 'Authorization'],
         max_age=86400  # Cache preflight for 24 hours
    )
    
    # ✅ FIXED: Setup Flask-Login with proper API handling
    login_manager = LoginManager()
    login_manager.init_app(app)
    
    # ✅ CRITICAL FIX: Remove login_view to prevent redirects for API endpoints
    # login_manager.login_view = 'auth.login'  # ❌ This causes redirects
    login_manager.session_protection = 'strong'
    
    # ✅ FIXED: Custom unauthorized handler for API endpoints
    @login_manager.unauthorized_handler
    def handle_unauthorized():
        """Custom handler for unauthorized access to return JSON instead of redirects"""
        
        # Check if this is an API request
        if request.path.startswith('/api/'):
            app.logger.warning(f"Unauthorized API access attempt to {request.path} from {request.remote_addr}")
            return jsonify({
                'error': 'Authentication required',
                'message': 'You must be logged in to access this endpoint',
                'code': 'UNAUTHORIZED'
            }), 401
        
        # For non-API requests, you could redirect to login page
        # But since this is primarily an API, we'll return JSON for all
        return jsonify({
            'error': 'Authentication required',
            'message': 'Please log in to access this resource'
        }), 401
    
    @login_manager.user_loader
    def load_user(user_id):
        """Load user by ID for Flask-Login"""
        try:
            return User.query.get(int(user_id))
        except (ValueError, TypeError):
            app.logger.warning(f"Invalid user_id provided to user_loader: {user_id}")
            return None
    
    # ✅ ENHANCED: Custom session validation
    @login_manager.needs_refresh_handler
    def refresh_handler():
        """Handle session refresh requirements"""
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Session expired',
                'message': 'Your session has expired. Please log in again.',
                'code': 'SESSION_EXPIRED'
            }), 401
        return jsonify({'error': 'Session refresh required'}), 401
    
    # Configure logging
    if not app.debug:
        logging.basicConfig(level=logging.INFO)
        app.logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        app.logger.addHandler(handler)
    
    # ✅ ENHANCED: Import and register blueprints with better error handling
    app.logger.info("Starting blueprint registration...")
    
    try:
        from routes import (
            auth_bp, customers_bp, estimates_bp, bids_bp, jobs_bp, 
            mobile_bp, audio_bp, sites_bp, line_items_bp, doors_bp, dispatch_bp
        )
        app.logger.info("✓ All blueprints imported successfully")
    except ImportError as e:
        app.logger.error(f"❌ Blueprint import failed: {e}")
        raise
    
    # Register ALL blueprints with /api prefix for consistency
    blueprint_registrations = [
        (auth_bp, '/api/auth', 'auth'),
        (customers_bp, '/api/customers', 'customers'),
        (estimates_bp, '/api/estimates', 'estimates'),
        (bids_bp, '/api/bids', 'bids'),
        (jobs_bp, '/api/jobs', 'jobs'),
        (mobile_bp, '/api/mobile', 'mobile'),
        (audio_bp, '/api/audio', 'audio'),
        (sites_bp, '/api/sites', 'sites'),
        (line_items_bp, '/api/line-items', 'line-items'),
        (doors_bp, '/api/doors', 'doors'),
        (dispatch_bp, '/api/dispatch', 'dispatch')
    ]
    
    registered_blueprints = []
    failed_blueprints = []
    
    for blueprint, url_prefix, name in blueprint_registrations:
        try:
            if blueprint is not None:
                app.register_blueprint(blueprint, url_prefix=url_prefix)
                app.logger.info(f"✓ Registered {name} blueprint at {url_prefix}")
                registered_blueprints.append(name)
                
                # ✅ ENHANCED: Verify blueprint routes were registered
                blueprint_routes = [rule.rule for rule in app.url_map.iter_rules() 
                                  if rule.rule.startswith(url_prefix)]
                if blueprint_routes:
                    app.logger.info(f"  └─ Routes: {blueprint_routes[:3]}{'...' if len(blueprint_routes) > 3 else ''}")
                else:
                    app.logger.warning(f"  └─ No routes found for {name} blueprint")
                    
            else:
                app.logger.error(f"❌ {name} blueprint is None - import failed")
                failed_blueprints.append(name)
        except Exception as e:
            app.logger.error(f"❌ Failed to register {name} blueprint: {e}")
            failed_blueprints.append(name)
    
    # ✅ ENHANCED: Blueprint registration summary
    app.logger.info(f"Blueprint registration complete: {len(registered_blueprints)} successful, {len(failed_blueprints)} failed")
    if failed_blueprints:
        app.logger.error(f"Failed blueprints: {failed_blueprints}")
    
    # ✅ ENHANCED: Health check endpoint with blueprint status
    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'app': 'Scott Overhead Doors API',
            'version': '1.0.0',
            'blueprints': {
                'registered': registered_blueprints,
                'failed': failed_blueprints,
                'total_routes': len(list(app.url_map.iter_rules()))
            },
            'database': 'connected' if db else 'not configured'
        })
    
    # ✅ ENHANCED: Root endpoint with detailed API information
    @app.route('/')
    def index():
        # Get all registered routes for documentation
        routes = {}
        for rule in app.url_map.iter_rules():
            if rule.rule.startswith('/api/'):
                endpoint_group = rule.rule.split('/')[2] if len(rule.rule.split('/')) > 2 else 'root'
                if endpoint_group not in routes:
                    routes[endpoint_group] = []
                routes[endpoint_group].append({
                    'path': rule.rule,
                    'methods': list(rule.methods - {'HEAD', 'OPTIONS'})
                })
        
        return jsonify({
            'message': 'Scott Overhead Doors API',
            'status': 'running',
            'version': '1.0.0',
            'endpoints': {
                'auth': '/api/auth',
                'customers': '/api/customers',
                'estimates': '/api/estimates',
                'bids': '/api/bids',
                'jobs': '/api/jobs',
                'mobile': '/api/mobile',
                'audio': '/api/audio',
                'sites': '/api/sites',
                'line-items': '/api/line-items',
                'doors': '/api/doors',
                'dispatch': '/api/dispatch'
            },
            'blueprint_status': {
                'registered': registered_blueprints,
                'failed': failed_blueprints
            },
            'available_routes': len(list(app.url_map.iter_rules())),
            'documentation': f"{request.base_url}health"
        })
    
    # ✅ ENHANCED: More comprehensive CORS headers for Azure
    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        
        # List of allowed origins
        allowed_origins = [
            'https://scott-overhead-doors.azurewebsites.net',
            'https://gray-glacier-0afce1c0f.1.azurestaticapps.net',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000'
        ]
        
        # Check for Azure Static Web Apps domains (wildcard support)
        if origin and (origin in allowed_origins or 
                      '.azurestaticapps.net' in origin or 
                      '.azurewebsites.net' in origin or
                      'localhost' in origin):
            response.headers.add('Access-Control-Allow-Origin', origin)
            response.headers.add('Access-Control-Allow-Credentials', 'true')
        
        # Add other CORS headers
        response.headers.add('Access-Control-Allow-Headers', 
                           'Content-Type,Authorization,X-Requested-With,Accept,Origin,Access-Control-Request-Method,Access-Control-Request-Headers,Cache-Control')
        response.headers.add('Access-Control-Allow-Methods', 
                           'GET,PUT,POST,DELETE,OPTIONS,PATCH')
        response.headers.add('Access-Control-Expose-Headers', 
                           'Content-Type,Authorization')
        response.headers.add('Access-Control-Max-Age', '86400')
        
        # Handle preflight requests
        if request.method == 'OPTIONS':
            response.headers.add('Access-Control-Allow-Origin', origin)
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            response.status_code = 200
        
        return response
    
    # ✅ ENHANCED: Global error handlers for better API responses
    @app.errorhandler(404)
    def not_found(error):
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Not Found',
                'message': f'The requested endpoint {request.path} does not exist',
                'code': 'NOT_FOUND'
            }), 404
        return jsonify({'error': 'Not Found'}), 404
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Method Not Allowed',
                'message': f'The method {request.method} is not allowed for endpoint {request.path}',
                'code': 'METHOD_NOT_ALLOWED',
                'allowed_methods': error.description if hasattr(error, 'description') else None
            }), 405
        return jsonify({'error': 'Method Not Allowed'}), 405
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        app.logger.error(f"Internal server error: {error}")
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Internal Server Error',
                'message': 'An unexpected error occurred. Please try again later.',
                'code': 'INTERNAL_ERROR'
            }), 500
        return jsonify({'error': 'Internal Server Error'}), 500
    
    # ✅ ENHANCED: Database initialization with better error handling
    with app.app_context():
        try:
            db.create_all()
            app.logger.info("✓ Database tables created/verified successfully")
            
            # Test database connection
            db.session.execute('SELECT 1')
            app.logger.info("✓ Database connection test successful")
            
        except Exception as e:
            app.logger.error(f"❌ Database initialization error: {e}")
            # Don't raise exception in production - let app start but log the error
            if config_name == 'development':
                raise
    
    # ✅ FINAL: Log successful app creation
    app.logger.info(f"✓ Scott Overhead Doors API created successfully in {config_name} mode")
    app.logger.info(f"✓ Total registered routes: {len(list(app.url_map.iter_rules()))}")
    
    return app

# For Azure App Service
app = create_app('production')

if __name__ == '__main__':
    # For local development
    app = create_app('development')
    app.run(debug=True, host='0.0.0.0', port=5000)