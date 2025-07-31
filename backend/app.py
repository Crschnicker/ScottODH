import os
import logging
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_cors import CORS
from datetime import timedelta

# Import configuration with proper instantiation
from config import config, get_config_name

# Import database and models
from models import db, User

def create_app(config_name=None):
    """
    Application factory function with comprehensive error handling and Azure optimization
    """
    # Auto-detect environment if not specified
    if config_name is None:
        config_name = get_config_name()
    
    app = Flask(__name__)
    
    # ✅ FIXED: Instantiate configuration class properly
    try:
        config_class = config[config_name]
        config_instance = config_class()  # Create instance to resolve database URL
        app.config.from_object(config_instance)
        app.logger.info(f"✓ Configuration loaded successfully for {config_name} environment")
        
        # Log database URL type for debugging (without exposing credentials)
        db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if db_uri:
            if 'sqlite' in db_uri.lower():
                app.logger.info("✓ Using SQLite database")
            elif 'postgresql' in db_uri.lower():
                app.logger.info("✓ Using PostgreSQL database")
            else:
                app.logger.info(f"✓ Using database: {db_uri.split('://')[0] if '://' in db_uri else 'unknown'}")
        
    except Exception as config_error:
        app.logger.error(f"❌ Configuration loading failed: {config_error}")
        raise
    
    # Ensure instance folder exists for SQLite and uploads
    try:
        os.makedirs(app.instance_path, exist_ok=True)
        # Also ensure uploads directory exists
        upload_folder = app.config.get('UPLOAD_FOLDER', 'uploads')
        if not os.path.isabs(upload_folder):
            upload_folder = os.path.join(app.instance_path, upload_folder)
        os.makedirs(upload_folder, exist_ok=True)
    except OSError as e:
        app.logger.warning(f"Could not create directories: {e}")
    
    # ✅ FIXED: Initialize database with proper error handling
    try:
        db.init_app(app)
        app.logger.info("✓ Database initialized successfully")
    except Exception as db_init_error:
        app.logger.error(f"❌ Database initialization failed: {db_init_error}")
        raise
    
    # ✅ FIXED: Comprehensive CORS configuration for Azure deployment
    try:
        cors_origins = app.config.get('CORS_ORIGINS', [])
        cors_credentials = app.config.get('CORS_SUPPORTS_CREDENTIALS', True)
        
        CORS(app, 
             origins=cors_origins,
             supports_credentials=cors_credentials,
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
        app.logger.info(f"✓ CORS configured with {len(cors_origins)} allowed origins")
        
    except Exception as cors_error:
        app.logger.error(f"❌ CORS configuration failed: {cors_error}")
        raise
    
    # ✅ FIXED: Setup Flask-Login with proper API handling
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.session_protection = 'strong'
    
    # ✅ CRITICAL FIX: Custom unauthorized handler for API endpoints (no redirects)
    @login_manager.unauthorized_handler
    def handle_unauthorized():
        """Custom handler for unauthorized access to return JSON instead of redirects"""
        # Always return JSON for API endpoints to prevent redirect loops
        if request.path.startswith('/api/'):
            app.logger.warning(f"Unauthorized API access attempt to {request.path} from {request.remote_addr}")
            return jsonify({
                'error': 'Authentication required',
                'message': 'You must be logged in to access this endpoint',
                'code': 'UNAUTHORIZED'
            }), 401
        
        # For non-API requests, still return JSON (no HTML redirects)
        return jsonify({
            'error': 'Authentication required',
            'message': 'Please log in to access this resource'
        }), 401
    
    @login_manager.user_loader
    def load_user(user_id):
        """Load user by ID for Flask-Login with proper error handling"""
        try:
            return User.query.get(int(user_id))
        except (ValueError, TypeError) as e:
            app.logger.warning(f"Invalid user_id provided to user_loader: {user_id} - {e}")
            return None
        except Exception as e:
            app.logger.error(f"Error loading user {user_id}: {e}")
            return None
    
    @login_manager.needs_refresh_handler
    def refresh_handler():
        """Handle session refresh requirements"""
        return jsonify({
            'error': 'Session expired',
            'message': 'Your session has expired. Please log in again.',
            'code': 'SESSION_EXPIRED'
        }), 401
    
    # Configure logging based on environment
    if not app.debug and config_name == 'production':
        logging.basicConfig(level=logging.INFO)
        app.logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        app.logger.addHandler(handler)
        app.logger.info("✓ Production logging configured")
    elif app.debug:
        app.logger.setLevel(logging.DEBUG)
        app.logger.info("✓ Debug logging enabled")
    
    # ✅ ENHANCED: Import and register blueprints with comprehensive error handling
    app.logger.info("Starting blueprint registration...")
    
    # Import blueprints with individual error handling
    blueprints_to_register = []
    
    blueprint_imports = [
        ('routes.auth', 'auth_bp', '/api/auth'),
        ('routes.customers', 'customers_bp', '/api/customers'),
        ('routes.estimates', 'estimates_bp', '/api/estimates'),
        ('routes.bids', 'bids_bp', '/api/bids'),
        ('routes.jobs', 'jobs_bp', '/api/jobs'),
        ('routes.mobile', 'mobile_bp', '/api/mobile'),
        ('routes.audio', 'audio_bp', '/api/audio'),
        ('routes.sites', 'sites_bp', '/api/sites'),
        ('routes.line_items', 'line_items_bp', '/api/line-items'),
        ('routes.door', 'doors_bp', '/api/doors'),
        ('routes.dispatch', 'dispatch_bp', '/api/dispatch'),
        ('routes.health', 'health_bp', '/api'),  # Health check endpoint
    ]
    
    # Import each blueprint individually
    for module_name, blueprint_name, url_prefix in blueprint_imports:
        try:
            module = __import__(module_name, fromlist=[blueprint_name])
            blueprint = getattr(module, blueprint_name)
            blueprints_to_register.append((blueprint, url_prefix, blueprint_name))
            app.logger.info(f"✓ Successfully imported {blueprint_name}")
        except ImportError as e:
            app.logger.error(f"❌ Failed to import {blueprint_name} from {module_name}: {e}")
        except AttributeError as e:
            app.logger.error(f"❌ Blueprint {blueprint_name} not found in {module_name}: {e}")
        except Exception as e:
            app.logger.error(f"❌ Unexpected error importing {blueprint_name}: {e}")
    
    # Register all successfully imported blueprints
    registered_blueprints = []
    failed_blueprints = []
    
    for blueprint, url_prefix, name in blueprints_to_register:
        try:
            app.register_blueprint(blueprint, url_prefix=url_prefix)
            registered_blueprints.append(name)
            app.logger.info(f"✓ Registered {name} blueprint at {url_prefix}")
            
            # Verify blueprint routes were registered
            blueprint_routes = [rule.rule for rule in app.url_map.iter_rules() 
                              if rule.rule.startswith(url_prefix)]
            if blueprint_routes:
                app.logger.debug(f"  └─ Routes: {blueprint_routes[:3]}{'...' if len(blueprint_routes) > 3 else ''}")
            else:
                app.logger.warning(f"  └─ No routes found for {name} blueprint")
                
        except Exception as e:
            app.logger.error(f"❌ Failed to register {name} blueprint: {e}")
            failed_blueprints.append(name)
    
    # Blueprint registration summary
    app.logger.info(f"Blueprint registration complete: {len(registered_blueprints)} successful, {len(failed_blueprints)} failed")
    if failed_blueprints:
        app.logger.error(f"Failed blueprints: {failed_blueprints}")
    
    # ✅ ENHANCED: Root endpoint with detailed API information
    @app.route('/')
    def index():
        """Root endpoint with comprehensive API documentation"""
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
            'environment': config_name,
            'endpoints': {
                'health': '/api/health',
                'auth': '/api/auth',
                'customers': '/api/customers',
                'estimates': '/api/estimates',
                'bids': '/api/bids',
                'jobs': '/api/jobs',
                'mobile': '/api/mobile',
                'audio': '/api/audio',
                'sites': '/api/sites',
                'line_items': '/api/line-items',
                'doors': '/api/doors',
                'dispatch': '/api/dispatch'
            },
            'blueprint_status': {
                'registered': registered_blueprints,
                'failed': failed_blueprints,
                'total_routes': len(list(app.url_map.iter_rules()))
            },
            'documentation': {
                'health_check': f"{request.base_url}api/health",
                'simple_health': f"{request.base_url}api/health/simple"
            }
        })
    
    # ✅ ENHANCED: Comprehensive CORS headers for Azure
    @app.after_request
    def after_request(response):
        """Enhanced CORS handling for Azure deployment"""
        origin = request.headers.get('Origin')
        
        # Get allowed origins from config
        allowed_origins = app.config.get('CORS_ORIGINS', [])
        
        # Check if origin is allowed
        origin_allowed = False
        if origin:
            # Direct match
            if origin in allowed_origins:
                origin_allowed = True
            # Wildcard domain matching for Azure
            elif any(
                ('*.azurestaticapps.net' in allowed and '.azurestaticapps.net' in origin) or
                ('*.azurewebsites.net' in allowed and '.azurewebsites.net' in origin) or
                ('localhost' in allowed and 'localhost' in origin)
                for allowed in allowed_origins
            ):
                origin_allowed = True
        
        if origin_allowed:
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
            if origin_allowed:
                response.headers.add('Access-Control-Allow-Origin', origin)
                response.headers.add('Access-Control-Allow-Credentials', 'true')
            response.status_code = 200
        
        return response
    
    # ✅ ENHANCED: Global error handlers for better API responses
    @app.errorhandler(404)
    def not_found(error):
        """Enhanced 404 handler with helpful API guidance"""
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Not Found',
                'message': f'The requested endpoint {request.path} does not exist',
                'code': 'NOT_FOUND',
                'available_endpoints': '/api/health for service status'
            }), 404
        return jsonify({'error': 'Not Found'}), 404
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        """Enhanced 405 handler to prevent redirect loops"""
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Method Not Allowed',
                'message': f'The method {request.method} is not allowed for endpoint {request.path}',
                'code': 'METHOD_NOT_ALLOWED',
                'allowed_methods': list(error.valid_methods) if hasattr(error, 'valid_methods') else None
            }), 405
        return jsonify({'error': 'Method Not Allowed'}), 405
    
    @app.errorhandler(500)
    def internal_error(error):
        """Enhanced 500 handler with database rollback"""
        db.session.rollback()
        app.logger.error(f"Internal server error: {error}")
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Internal Server Error',
                'message': 'An unexpected error occurred. Please try again later.',
                'code': 'INTERNAL_ERROR'
            }), 500
        return jsonify({'error': 'Internal Server Error'}), 500
    
    # ✅ ENHANCED: Database initialization with comprehensive error handling
    with app.app_context():
        try:
            # Test database connection first
            db.session.execute('SELECT 1')
            app.logger.info("✓ Database connection test successful")
            
            # Create all tables
            db.create_all()
            app.logger.info("✓ Database tables created/verified successfully")
            
            # Additional database health check
            try:
                # Count users table as a basic functionality test
                user_count = User.query.count()
                app.logger.info(f"✓ Database operational - found {user_count} users")
            except Exception as count_error:
                app.logger.warning(f"Database table verification warning: {count_error}")
                
        except Exception as db_error:
            app.logger.error(f"❌ Database initialization error: {db_error}")
            # In production, log error but don't crash the app
            if config_name == 'production':
                app.logger.error("Production database error - app will start but may not function properly")
            else:
                # In development, crash to force fixing the issue
                raise
    
    # ✅ FINAL: Log successful app creation with comprehensive info
    total_routes = len(list(app.url_map.iter_rules()))
    api_routes = len([rule for rule in app.url_map.iter_rules() if rule.rule.startswith('/api/')])
    
    app.logger.info(f"✓ Scott Overhead Doors API created successfully")
    app.logger.info(f"✓ Environment: {config_name}")
    app.logger.info(f"✓ Total routes: {total_routes} ({api_routes} API routes)")
    app.logger.info(f"✓ Registered blueprints: {len(registered_blueprints)}")
    app.logger.info(f"✓ CORS origins: {len(app.config.get('CORS_ORIGINS', []))}")
    
    return app

# ✅ AZURE DEPLOYMENT: Create app instance for Azure App Service
try:
    # For Azure App Service - always use production config
    app = create_app('production')
except Exception as production_error:
    # Fallback to development if production config fails
    print(f"Production config failed: {production_error}")
    try:
        app = create_app('development')
        print("Falling back to development configuration")
    except Exception as fallback_error:
        print(f"All configurations failed: {fallback_error}")
        raise

if __name__ == '__main__':
    # For local development - auto-detect environment
    local_app = create_app()
    port = int(os.environ.get('PORT', 5000))
    local_app.run(
        debug=local_app.config.get('DEBUG', False), 
        host='0.0.0.0', 
        port=port
    )