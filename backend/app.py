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
    
    # Setup Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.session_protection = 'strong'
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    # Configure logging
    if not app.debug:
        logging.basicConfig(level=logging.INFO)
        app.logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        app.logger.addHandler(handler)
    
    # Import and register blueprints
    from routes import (
        auth_bp, customers_bp, estimates_bp, bids_bp, jobs_bp, 
        mobile_bp, audio_bp, sites_bp, line_items_bp, doors_bp, dispatch_bp
    )
    
    # Register ALL blueprints with /api prefix for consistency
    if auth_bp:
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        app.logger.info("✓ Registered auth blueprint at /api/auth")
    
    if customers_bp:
        app.register_blueprint(customers_bp, url_prefix='/api/customers')
        app.logger.info("✓ Registered customers blueprint at /api/customers")
    
    if estimates_bp:
        app.register_blueprint(estimates_bp, url_prefix='/api/estimates')
        app.logger.info("✓ Registered estimates blueprint at /api/estimates")
    
    if bids_bp:
        app.register_blueprint(bids_bp, url_prefix='/api/bids')
        app.logger.info("✓ Registered bids blueprint at /api/bids")
    
    if jobs_bp:
        app.register_blueprint(jobs_bp, url_prefix='/api/jobs')
        app.logger.info("✓ Registered jobs blueprint at /api/jobs")
    
    if mobile_bp:
        app.register_blueprint(mobile_bp, url_prefix='/api/mobile')
        app.logger.info("✓ Registered mobile blueprint at /api/mobile")
    
    if audio_bp:
        app.register_blueprint(audio_bp, url_prefix='/api/audio')
        app.logger.info("✓ Registered audio blueprint at /api/audio")
    
    if sites_bp:
        app.register_blueprint(sites_bp, url_prefix='/api/sites')
        app.logger.info("✓ Registered sites blueprint at /api/sites")
    
    if line_items_bp:
        app.register_blueprint(line_items_bp, url_prefix='/api/line-items')
        app.logger.info("✓ Registered line-items blueprint at /api/line-items")
    
    if doors_bp:
        app.register_blueprint(doors_bp, url_prefix='/api/doors')
        app.logger.info("✓ Registered doors blueprint at /api/doors")
    
    if dispatch_bp:
        app.register_blueprint(dispatch_bp, url_prefix='/api/dispatch')
        app.logger.info("✓ Registered dispatch blueprint at /api/dispatch")
    
    # Health check endpoint
    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'app': 'Scott Overhead Doors API',
            'version': '1.0.0'
        })
    
    # Root endpoint
    @app.route('/')
    def index():
        return jsonify({
            'message': 'Scott Overhead Doors API',
            'status': 'running',
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
            }
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
    
    # Create database tables
    with app.app_context():
        try:
            db.create_all()
            app.logger.info("✓ Database tables created/verified")
        except Exception as e:
            app.logger.error(f"Database initialization error: {e}")
    
    return app

# For Azure App Service
app = create_app('production')

if __name__ == '__main__':
    # For local development
    app = create_app('development')
    app.run(debug=True, host='0.0.0.0', port=5000)