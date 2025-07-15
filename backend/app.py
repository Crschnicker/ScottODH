# backend/app.py

import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_login import LoginManager

# --- Local Imports ---
from config import config
from models import db

def create_app(config_name=None):
    """
    Application factory pattern. This function creates and configures the Flask app.
    """
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'default')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # --- Initialize Extensions ---
    db.init_app(app)
    Migrate(app, db)

    # --- THE ONLY CORS CONFIGURATION NEEDED ---
    # This single block manages CORS for the entire application.
    CORS(app,
         origins=app.config.get('CORS_ORIGINS', []),
         supports_credentials=True,
         
         # --- FIX: Expanded the list of allowed headers ---
         # This explicitly allows the 'Cache-Control' header seen in the error log,
         # plus other common headers to prevent future issues.
         allow_headers=[
             "Accept",
             "Authorization",
             "Cache-Control",  # Added this header
             "Content-Type",
             "Origin",
             "Pragma",
             "X-Requested-With",
             "X-Client-Info",
             "X-Forwarded-For",
             "X-Forwarded-Host",
             "X-Forwarded-Proto"
         ],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"]
    )
    # --- No other CORS code is needed anywhere else. ---

    # --- Setup Flask-Login ---
    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        from models import User
        return User.query.get(int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify(error="Authentication required", message="Please log in to access this resource."), 401

    # --- Register Blueprints and Create Database ---
    with app.app_context():
        from routes.auth import auth_bp
        # from routes.customers import customers_bp # etc.

        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        # app.register_blueprint(customers_bp, url_prefix='/api/customers')

        db.create_all()

    # --- Global Error Handlers ---
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not Found', 'message': 'The requested resource was not found on the server.'}), 404

    @app.errorhandler(500)
    def internal_server_error(error):
        db.session.rollback()
        return jsonify({'error': 'Internal Server Error', 'message': 'An unexpected error occurred.'}), 500

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': 'Bad Request', 'message': error.description or 'The request was malformed.'}), 400

    # --- Health Check Endpoint ---
    @app.route('/api/health')
    def health_check():
        try:
            db.session.execute('SELECT 1')
            return jsonify({'status': 'healthy', 'database': 'connected'})
        except Exception as e:
            return jsonify({'status': 'unhealthy', 'database': 'disconnected', 'error': str(e)}), 503

    return app

# --- Create and Run the Application ---
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)