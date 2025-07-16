# backend/app.py
# Flask application optimized for Choreo gateway with external CORS handling

import os
import logging
from flask import Flask, jsonify, request
from flask_migrate import Migrate
from flask_login import LoginManager

# Local Imports
from config import config, get_config_name
from models import db

def create_app(config_name=None):
    """
    Application factory optimized for Choreo deployment.
    Assumes CORS is handled by Choreo gateway - no Flask CORS needed.
    """
    if config_name is None:
        config_name = get_config_name()

    app = Flask(__name__)
    
    # Get configuration object safely
    config_class = config[config_name]
    if isinstance(config_class, type):
        config_obj = config_class()
    else:
        config_obj = config_class
    
    app.config.from_object(config_obj)
    
    # Enhanced logging for production debugging
    logging.basicConfig(
        level=getattr(logging, app.config.get('LOG_LEVEL', 'INFO')),
        format='%(asctime)s %(levelname)s: %(message)s'
    )
    
    app.logger.info(f'🚀 CHOREO-OPTIMIZED APP - Starting with {config_name} configuration')
    
    # Safe database URI logging
    try:
        db_uri = getattr(config_obj, 'SQLALCHEMY_DATABASE_URI', 'Not configured')
        if len(str(db_uri)) > 50:
            db_uri_display = str(db_uri)[:50] + '...'
        else:
            db_uri_display = str(db_uri)
        app.logger.info(f'Database URI: {db_uri_display}')
    except Exception as e:
        app.logger.warning(f'Could not log database URI: {e}')

    # Initialize Extensions
    db.init_app(app)
    Migrate(app, db)

    # Get CORS origins for logging (Choreo handles actual CORS)
    try:
        cors_origins = getattr(config_obj, 'CORS_ORIGINS', [])
        if not isinstance(cors_origins, list):
            cors_origins = []
        app.logger.info(f'✅ CORS Origins (handled by Choreo): {cors_origins}')
    except:
        app.logger.info('✅ CORS handled by Choreo gateway')

    # Setup Flask-Login with optimized configuration
    login_manager = LoginManager()
    login_manager.init_app(app)
    
    # Configure session settings for cross-origin requests
    login_manager.session_protection = "strong"
    login_manager.remember_cookie_secure = True
    login_manager.remember_cookie_httponly = True
    login_manager.remember_cookie_duration = None  # Session-based

    @login_manager.user_loader
    def load_user(user_id):
        """Load user for Flask-Login sessions with error handling."""
        from models import User
        try:
            user = User.query.get(int(user_id))
            if user and user.is_active:
                return user
            return None
        except (ValueError, TypeError) as e:
            app.logger.warning(f'Invalid user_id format: {user_id} - {e}')
            return None
        except Exception as e:
            app.logger.error(f'Error loading user {user_id}: {e}')
            return None

    @login_manager.unauthorized_handler
    def unauthorized():
        """Handle unauthorized access attempts with detailed logging."""
        origin = request.headers.get('Origin', 'Unknown')
        app.logger.warning(f'Unauthorized access attempt from {request.remote_addr}, origin: {origin}')
        return jsonify({
            'error': 'Authentication required', 
            'message': 'Please log in to access this resource.',
            'status': 401
        }), 401

    # Register Blueprints and Create Database
    with app.app_context():
        # Import and register auth blueprint with error handling
        try:
            from routes.auth import auth_bp
            app.register_blueprint(auth_bp, url_prefix='/api/auth')
            app.logger.info('✅ Auth blueprint registered successfully')
        except ImportError as e:
            app.logger.error(f'❌ Failed to import auth blueprint: {e}')
        except Exception as e:
            app.logger.error(f'❌ Error registering auth blueprint: {e}')
        
        # Import other blueprints with graceful failure handling
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
                app.logger.info(f'✅ {blueprint_name} registered successfully')
            except ImportError:
                app.logger.info(f'ℹ️ {blueprint_name} not available (optional)')
            except Exception as e:
                app.logger.error(f'❌ Error registering {blueprint_name}: {e}')

        # Database setup with comprehensive error handling
        try:
            # Create all database tables
            db.create_all()
            app.logger.info('✅ Database tables created successfully')
            
            # Import User model for user creation
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
                    admin_user.set_password('admin123')  # TODO: Change in production
                    db.session.add(admin_user)
                    db.session.commit()
                    app.logger.info('✅ Created default admin user: admin/admin123')
                except Exception as e:
                    app.logger.error(f'❌ Could not create admin user: {e}')
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
                    app.logger.info('✅ Created kelly user: kelly/kelly123')
                except Exception as e:
                    app.logger.error(f'❌ Could not create kelly user: {e}')
                    db.session.rollback()
            
            # Log existing users for debugging
            try:
                user_count = User.query.count()
                admin_count = User.query.filter_by(role='admin').count()
                field_count = User.query.filter_by(role='field').count()
                app.logger.info(f'📊 Database status: {user_count} total users ({admin_count} admin, {field_count} field)')
            except Exception as e:
                app.logger.warning(f'Could not get user statistics: {e}')
                    
        except Exception as e:
            app.logger.error(f'❌ Database setup failed: {str(e)}')

    # Enhanced error handlers that work with Choreo gateway
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 errors with detailed logging."""
        origin = request.headers.get('Origin', 'Unknown')
        app.logger.warning(f'404 error: {request.url} from {request.remote_addr}, origin: {origin}')
        return jsonify({
            'error': 'Not Found', 
            'message': 'The requested resource was not found on the server.',
            'path': request.path,
            'status': 404
        }), 404

    @app.errorhandler(500)
    def internal_server_error(error):
        """Handle 500 errors with proper cleanup and logging."""
        origin = request.headers.get('Origin', 'Unknown')
        app.logger.error(f'500 error: {str(error)} at {request.url}, origin: {origin}')
        try:
            db.session.rollback()
        except:
            pass
        return jsonify({
            'error': 'Internal Server Error', 
            'message': 'An unexpected error occurred. Please try again.',
            'status': 500
        }), 500

    @app.errorhandler(400)
    def bad_request(error):
        """Handle 400 errors with detailed messages."""
        origin = request.headers.get('Origin', 'Unknown')
        app.logger.warning(f'400 error: {error.description} at {request.url}, origin: {origin}')
        return jsonify({
            'error': 'Bad Request', 
            'message': error.description or 'The request was malformed.',
            'status': 400
        }), 400

    @app.errorhandler(403)
    def forbidden(error):
        """Handle 403 errors with detailed logging."""
        origin = request.headers.get('Origin', 'Unknown')
        app.logger.warning(f'403 error: Access forbidden to {request.url} from {request.remote_addr}, origin: {origin}')
        return jsonify({
            'error': 'Forbidden', 
            'message': 'You do not have permission to access this resource.',
            'status': 403
        }), 403

    # Comprehensive health check endpoint
    @app.route('/api/health')
    def health_check():
        """
        Comprehensive health check endpoint optimized for Choreo.
        Tests database connectivity and returns system status.
        """
        origin = request.headers.get('Origin', 'Unknown')
        user_agent = request.headers.get('User-Agent', 'Unknown')
        
        app.logger.info(f'🏥 Health check request from origin: {origin}')
        
        health_data = {
            'status': 'healthy',
            'timestamp': str(db.func.now()),
            'environment': config_name,
            'app_version': 'choreo-optimized-v1',
            'cors_handling': 'choreo-gateway',
            'database': 'unknown',
            'request_info': {
                'origin': origin,
                'user_agent': user_agent[:100] if user_agent else None,  # Truncate long user agents
                'method': request.method,
                'path': request.path
            }
        }
        
        # Test database connectivity with detailed error reporting
        try:
            # Test basic connectivity
            db.session.execute(db.text('SELECT 1 as test'))
            
            # Test user table access
            from models import User
            user_count = User.query.count()
            
            db.session.commit()
            
            health_data.update({
                'database': 'connected',
                'user_count': user_count,
                'database_type': 'postgresql' if 'postgresql' in str(db.engine.url) else 'other'
            })
            
            app.logger.debug(f'✅ Health check: Database connection successful, {user_count} users')
            
        except Exception as e:
            health_data.update({
                'database': 'disconnected',
                'status': 'unhealthy',
                'database_error': str(e)[:200]  # Truncate long error messages
            })
            app.logger.error(f'❌ Health check: Database connection failed: {str(e)}')
            
            return jsonify(health_data), 503
        
        app.logger.info(f'✅ Health check successful from origin: {origin}')
        return jsonify(health_data)

    # CORS testing endpoint (for debugging Choreo CORS configuration)
    @app.route('/api/cors-test')
    def cors_test():
        """
        Dedicated endpoint for testing Choreo's CORS configuration.
        Returns detailed request information for debugging.
        """
        origin = request.headers.get('Origin')
        
        cors_info = {
            'message': 'CORS test endpoint - Choreo gateway handles CORS',
            'choreo_cors_active': True,
            'flask_cors_disabled': True,
            'request_details': {
                'origin': origin,
                'method': request.method,
                'path': request.path,
                'headers': dict(request.headers),
                'timestamp': str(db.func.now())
            },
            'environment_info': {
                'flask_env': os.environ.get('FLASK_ENV'),
                'choreo_environment': os.environ.get('CHOREO_ENVIRONMENT'),
                'cors_origins_env': os.environ.get('CORS_ORIGINS', '').split(',') if os.environ.get('CORS_ORIGINS') else []
            }
        }
        
        app.logger.info(f'🧪 CORS test request from origin: {origin}')
        return jsonify(cors_info)

    # Authentication test endpoint
    @app.route('/api/auth-test', methods=['GET', 'POST', 'OPTIONS'])
    def auth_test():
        """Test endpoint for authentication flow debugging."""
        origin = request.headers.get('Origin')
        
        test_data = {
            'message': 'Authentication test endpoint for Choreo deployment',
            'method': request.method,
            'origin': origin,
            'timestamp': str(db.func.now()),
            'session_info': {
                'has_session': bool(request.cookies.get('session')),
                'session_cookies': [name for name in request.cookies.keys() if 'session' in name.lower()],
                'csrf_protection': 'disabled-for-api'
            }
        }
        
        if request.method == 'POST':
            try:
                test_data['request_body'] = request.get_json() if request.is_json else None
                test_data['content_type'] = request.content_type
            except:
                test_data['request_body'] = 'Could not parse JSON'
        
        app.logger.info(f'🔐 Auth test {request.method} request from origin: {origin}')
        return jsonify(test_data)

    # Simple login test endpoint for quick verification
    @app.route('/api/quick-login-test', methods=['POST'])
    def quick_login_test():
        """Quick login test endpoint that bypasses full auth system."""
        try:
            data = request.get_json()
            username = data.get('username') if data else None
            password = data.get('password') if data else None
            
            app.logger.info(f'🔐 Quick login test for user: {username}')
            
            if username == 'kelly' and password == 'kelly123':
                return jsonify({
                    'success': True,
                    'message': 'Quick login test successful!',
                    'user': {
                        'username': 'kelly',
                        'role': 'field',
                        'test_mode': True
                    },
                    'choreo_cors_working': True
                })
            else:
                return jsonify({
                    'success': False,
                    'message': 'Invalid credentials (use kelly/kelly123 for test)',
                    'choreo_cors_working': True
                }), 401
                
        except Exception as e:
            app.logger.error(f'Quick login test error: {e}')
            return jsonify({
                'success': False,
                'message': f'Login test error: {str(e)}',
                'choreo_cors_working': True
            }), 500

    # Log final startup information
    app.logger.info(f'🎯 Choreo-optimized Flask application created successfully')
    app.logger.info(f'🌐 CORS handling: Managed by Choreo gateway')
    app.logger.info(f'🔧 Configuration: {config_name}')
    app.logger.info(f'🚀 Application ready for Choreo deployment')
    
    return app

# Create application instance
app = create_app()

# Optimized startup for Choreo with better error handling
if __name__ == '__main__':
    try:
        port = int(os.environ.get('PORT', 8080))
        host = os.environ.get('HOST', '0.0.0.0')
        debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
        
        app.logger.info(f'🚀 Starting Choreo-optimized server on {host}:{port}')
        app.logger.info(f'🐛 Debug mode: {debug_mode}')
        
        app.run(
            host=host, 
            port=port, 
            debug=debug_mode,
            threaded=True,
            use_reloader=False  # Disable reloader in production
        )
        
    except Exception as e:
        app.logger.error(f'❌ Failed to start server: {e}')
        raise