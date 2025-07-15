# backend/app.py

import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_login import LoginManager

# --- Local Imports ---
# Import the configuration dictionary and the database instance
from config import config
from models import db

def create_app(config_name=None):
    """
    Application factory pattern. This function creates and configures the Flask app.
    """
    # If no config is specified, use the one from the environment variable
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'default')

    app = Flask(__name__)
    # Load configuration from the config object
    app.config.from_object(config[config_name])

    # --- Initialize Extensions ---
    db.init_app(app)
    Migrate(app, db)

    # --- THE ONLY CORS CONFIGURATION NEEDED ---
    # This single block manages CORS for the entire application.
    # It automatically handles preflight (OPTIONS) requests.
    CORS(app,
         # Load the list of allowed domains from the config file
         origins=app.config.get('CORS_ORIGINS', []),
         # This is CRITICAL. It allows the browser to send cookies and auth headers.
         supports_credentials=True,
         # Define which headers and methods are allowed in requests.
         allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    )
    # --- No other CORS code is needed anywhere else in the application. ---

    # --- Setup Flask-Login ---
    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        """Required by Flask-Login to load the current user from the session."""
        from models import User
        return User.query.get(int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        """
        Handles requests that require login but are not authenticated.
        Returns a JSON response, which is appropriate for an API.
        """
        return jsonify(error="Authentication required", message="Please log in to access this resource."), 401

    # --- Register Blueprints and Create Database ---
    with app.app_context():
        # Import blueprints here to avoid circular import issues
        from routes.auth import auth_bp
        # from routes.customers import customers_bp # etc.

        # Register the blueprints with their URL prefixes
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        # app.register_blueprint(customers_bp, url_prefix='/api/customers')

        # Create database tables for all models that don't yet exist
        db.create_all()

    # --- Global Error Handlers ---
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not Found', 'message': 'The requested resource was not found on the server.'}), 404

    @app.errorhandler(500)
    def internal_server_error(error):
        db.session.rollback() # Rollback the session in case of a database error
        return jsonify({'error': 'Internal Server Error', 'message': 'An unexpected error occurred.'}), 500

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': 'Bad Request', 'message': error.description or 'The request was malformed.'}), 400


    # --- Health Check Endpoint ---
    @app.route('/api/health')
    def health_check():
        """A simple endpoint for Choreo or other services to monitor app health."""
        try:
            db.session.execute('SELECT 1')
            return jsonify({'status': 'healthy', 'database': 'connected'})
        except Exception as e:
            return jsonify({'status': 'unhealthy', 'database': 'disconnected', 'error': str(e)}), 503

    return app

# --- Create and Run the Application ---
# Create the Flask app instance using the factory
app = create_app()

if __name__ == '__main__':
    # Choreo and other platforms provide the port via an environment variable
    port = int(os.environ.get('PORT', 8080))
    # Host must be '0.0.0.0' to be accessible within the Docker container
    app.run(host='0.0.0.0', port=port)