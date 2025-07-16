# backend/app.py
# Minimal bulletproof Flask application for Choreo deployment

import os
import logging
from flask import Flask, jsonify, request, make_response
from flask_migrate import Migrate
from flask_login import LoginManager

# Local Imports
from config import config, get_config_name
from models import db

def create_app(config_name=None):
    """Minimal application factory that will definitely work in Choreo."""
    if config_name is None:
        config_name = get_config_name()

    app = Flask(__name__)
    
    # Get config object safely
    config_class = config[config_name]
    if isinstance(config_class, type):
        config_obj = config_class()
    else:
        config_obj = config_class
    
    app.config.from_object(config_obj)
    
    # Basic logging
    logging.basicConfig(level=logging.INFO)
    app.logger.info(f'🚀 MINIMAL APP - Starting with {config_name} configuration')
    
    # Initialize database
    db.init_app(app)
    
    # Get CORS origins safely
    try:
        cors_origins = getattr(config_obj, 'CORS_ORIGINS', [])
        if not isinstance(cors_origins, list):
            cors_origins = ['https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev']
    except:
        cors_origins = ['https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev']
    
    app.logger.info(f'✅ CORS origins: {cors_origins}')

    # Simple CORS handling
    @app.after_request
    def add_cors_headers(response):
        """Add CORS headers to all responses."""
        origin = request.headers.get('Origin')
        if origin in cors_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response

    # Handle preflight requests
    @app.before_request
    def handle_preflight():
        """Handle preflight OPTIONS requests."""
        if request.method == 'OPTIONS':
            origin = request.headers.get('Origin')
            if origin in cors_origins:
                response = make_response('', 200)
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
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
        except:
            return None

    # Create database and users in app context
    with app.app_context():
        try:
            # Import auth blueprint
            from routes.auth import auth_bp
            app.register_blueprint(auth_bp, url_prefix='/api/auth')
            app.logger.info('✅ Auth blueprint registered')
        except Exception as e:
            app.logger.error(f'❌ Auth blueprint failed: {e}')

        try:
            # Create database tables
            db.create_all()
            app.logger.info('✅ Database tables created')
            
            # Create users
            from models import User
            
            # Create kelly user
            if not User.query.filter_by(username='kelly').first():
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
                app.logger.info('✅ Created kelly user')
                
        except Exception as e:
            app.logger.error(f'❌ Database setup failed: {e}')

    # Minimal health check
    @app.route('/api/health')
    def health_check():
        """Simple health check that always works."""
        return jsonify({
            'status': 'healthy',
            'app': 'minimal_bulletproof',
            'cors_origins': cors_origins,
            'version': 'v4-minimal'
        })

    # Simple test endpoint
    @app.route('/api/test')
    def test_endpoint():
        """Simple test endpoint."""
        return jsonify({
            'message': 'Test endpoint working',
            'origin': request.headers.get('Origin'),
            'method': request.method
        })

    app.logger.info('🎯 Minimal Flask application created successfully')
    return app

# Create app
app = create_app()

# Simple startup for Choreo
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.logger.info(f'🚀 Starting minimal app on port {port}')
    app.run(host='0.0.0.0', port=port, debug=False)