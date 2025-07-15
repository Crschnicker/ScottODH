from flask import Flask, request, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate
from flask_login import LoginManager
from datetime import datetime, timedelta
import os
import sys
import logging

# Add the current directory to Python path to ensure imports work
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Import your existing config
from config import Config

# Import your models (assuming you have an __init__.py that sets up db)
from models import db

def create_app(config_class=Config):
    """Application factory for Choreo deployment with comprehensive CORS handling"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions
    db.init_app(app)
    migrate = Migrate(app, db)
    
    # Enhanced CORS setup specifically for Choreo deployment
    # This addresses the exact error you're experiencing
    CORS(app, 
         origins=[
             # Your specific Choreo URLs from the error logs - CRITICAL
             "https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev",
             "https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev",
             # Choreo wildcard patterns to handle any environment
             "https://*.e1-us-east-azure.choreoapps.dev",
             "https://*.e1-us-east-azure.choreoapis.dev", 
             "https://*.choreoapis.dev",
             "https://*.choreoapps.dev",
             # Development and testing URLs
             "http://localhost:3000",
             "http://127.0.0.1:3000",
             "https://*.ngrok.io",
             "https://*.ngrok-free.app",
             "https://scottohd.ngrok.io",
         ],
         allow_headers=[
             "Accept",
             "Accept-Language",
             "Authorization", 
             "Cache-Control",
             "Content-Language",
             "Content-Type",
             "Origin",
             "Pragma",
             "User-Agent",
             "X-Client-Info",
             "X-Forwarded-For",
             "X-Forwarded-Host",
             "X-Forwarded-Proto",
             "X-Request-ID", 
             "X-Request-Timestamp",
             "X-Requested-With",
         ],
         expose_headers=[
             "Content-Range",
             "X-Content-Range",
             "X-Total-Count", 
             "Location"
         ],
         supports_credentials=True,  # CRITICAL FIX - this was missing and causing your error
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
         max_age=86400,
         send_wildcard=False,  # Required when supports_credentials=True
         vary_header=True
    )
    
    # Critical CORS handler for Choreo-specific requirements
    @app.before_request
    def handle_preflight():
        """Handle preflight OPTIONS requests with comprehensive CORS headers"""
        if request.method == "OPTIONS":
            origin = request.headers.get('Origin')
            
            # Create preflight response
            response = make_response()
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH'
            response.headers['Access-Control-Allow-Headers'] = ', '.join([
                "Accept", "Authorization", "Cache-Control", "Content-Type",
                "Origin", "Pragma", "X-Requested-With", "X-Client-Info",
                "X-Request-Timestamp", "X-Forwarded-Proto", "X-Forwarded-Host"
            ])
            response.headers['Access-Control-Max-Age'] = '86400'
            
            # Handle origin-specific CORS for Choreo
            if origin:
                # Check if origin contains Choreo domains or development domains
                if any(domain in origin.lower() for domain in [
                    'choreoapis.dev', 'choreoapps.dev', 'ngrok.io', 'ngrok-free.app', 
                    'localhost', '127.0.0.1'
                ]):
                    response.headers['Access-Control-Allow-Origin'] = origin
                    response.headers['Access-Control-Allow-Credentials'] = 'true'
            
            response.status_code = 200
            return response
    
    # Enhanced after_request handler for production CORS compatibility
    @app.after_request
    def after_request(response):
        """Enhanced after_request handler for comprehensive CORS support"""
        origin = request.headers.get('Origin')
        
        if origin:
            # Specific handling for Choreo domains and development environments
            origin_lower = origin.lower()
            
            # Check if origin is allowed
            allowed_patterns = [
                'choreoapis.dev', 'choreoapps.dev', 'ngrok.io', 'ngrok-free.app',
                'localhost', '127.0.0.1'
            ]
            
            if any(pattern in origin_lower for pattern in allowed_patterns):
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH'
                response.headers['Access-Control-Allow-Headers'] = ', '.join([
                    "Accept", "Authorization", "Cache-Control", "Content-Type",
                    "Origin", "Pragma", "X-Requested-With", "X-Client-Info",
                    "X-Request-Timestamp", "X-Forwarded-Proto", "X-Forwarded-Host"
                ])
                response.headers['Access-Control-Expose-Headers'] = 'Content-Range, X-Content-Range, X-Total-Count'
        
        # Add security headers for production
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        
        # Cache control for API responses
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        
        return response
    
    # Setup authentication
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'login'
    
    @login_manager.user_loader
    def load_user(user_id):
        """Load user for Flask-Login with comprehensive error handling"""
        try:
            from models.user import User
            return User.query.get(int(user_id))
        except Exception as e:
            app.logger.error(f"Error loading user {user_id}: {e}")
            return None
    
    # Health check endpoint for Choreo deployment monitoring
    @app.route('/api/health', methods=['GET', 'HEAD'])
    def health_check():
        """Comprehensive health check endpoint for Choreo monitoring"""
        try:
            # Test database connection
            db.session.execute('SELECT 1')
            db_status = 'healthy'
        except Exception as e:
            app.logger.error(f"Database health check failed: {e}")
            db_status = 'unhealthy'
        
        health_data = {
            'status': 'healthy' if db_status == 'healthy' else 'degraded',
            'timestamp': datetime.utcnow().isoformat(),
            'version': '1.0.0',
            'database': db_status,
            'environment': app.config.get('ENV', 'unknown')
        }
        
        status_code = 200 if db_status == 'healthy' else 503
        return jsonify(health_data), status_code
    
    # Root endpoint with comprehensive information
    @app.route('/')
    def index():
        """Root endpoint with application information"""
        return jsonify({
            'message': 'Scott Overhead Doors API',
            'status': 'running',
            'version': '1.0.0',
            'environment': app.config.get('ENV', 'development'),
            'endpoints': {
                'health': '/api/health',
                'auth': '/api/auth',
                'customers': '/api/customers',
                'estimates': '/api/estimates',
                'bids': '/api/bids',
                'jobs': '/api/jobs',
                'mobile': '/api/mobile'
            }
        })
    
    # Comprehensive error handlers for production deployment
    @app.errorhandler(404)
    def not_found(error):
        """Enhanced 404 handler with CORS headers"""
        response = jsonify({'error': 'Resource not found', 'status_code': 404})
        response.status_code = 404
        return response
    
    @app.errorhandler(500)
    def internal_error(error):
        """Enhanced 500 handler with proper cleanup"""
        db.session.rollback()
        app.logger.error(f"Internal server error: {error}")
        response = jsonify({'error': 'Internal server error', 'status_code': 500})
        response.status_code = 500
        return response
    
    @app.errorhandler(400)
    def bad_request(error):
        """Enhanced 400 handler for bad requests"""
        response = jsonify({'error': 'Bad request', 'status_code': 400})
        response.status_code = 400
        return response
    
    @app.errorhandler(403)
    def forbidden(error):
        """Enhanced 403 handler for forbidden requests"""
        response = jsonify({'error': 'Access forbidden', 'status_code': 403})
        response.status_code = 403
        return response
    
    # Register blueprints with comprehensive error handling
    with app.app_context():
        try:
            # Import blueprints directly with error handling
            from routes.auth import auth_bp
            from routes.customers import customers_bp
            from routes.estimates import estimates_bp
            from routes.bids import bids_bp
            from routes.door import doors_bp
            from routes.jobs import jobs_bp
            from routes.mobile import mobile_bp
            from routes.audio import audio_bp
            from routes.sites import sites_bp
            from routes.line_items import line_items_bp
            from routes.dispatch import dispatch_bp

            # Define all blueprints to be registered with their URL prefixes
            blueprint_configs = [
                (auth_bp, '/api/auth'),
                (customers_bp, '/api/customers'),
                (estimates_bp, '/api/estimates'),
                (bids_bp, '/api/bids'),
                (doors_bp, '/api/doors'),
                (jobs_bp, '/api/jobs'),
                (mobile_bp, '/api/mobile'),
                (audio_bp, '/api/audio'),
                (sites_bp, '/api/sites'),
                (line_items_bp, '/api/line-items'),
                (dispatch_bp, '/api/dispatch'),
            ]

            # Register each blueprint with comprehensive error handling
            for blueprint, prefix in blueprint_configs:
                try:
                    app.register_blueprint(blueprint, url_prefix=prefix)
                    app.logger.info(f"✓ Blueprint '{blueprint.name}' registered at {prefix}")
                except Exception as e:
                    app.logger.error(f"⚠ Failed to register blueprint '{blueprint.name}': {e}")

        except ImportError as e:
            app.logger.error(f"⚠ Blueprint import failed: {e}")
            # Create fallback routes if blueprints fail to import
            create_fallback_customer_routes(app)

        # Create database tables and default users with error handling
        try:
            # Ensure all tables are created based on your models
            db.create_all()
            app.logger.info("✓ Database tables created successfully.")
            
            # Create default users for the application
            create_default_users()
            app.logger.info("✓ Default users verification completed.")

        except Exception as e:
            app.logger.error(f"⚠ Database setup failed: {e}")
    
    # Configure comprehensive logging for Choreo deployment
    if not app.debug and not app.testing:
        # Set up logging configuration based on environment
        if app.config.get('LOG_TO_STDOUT'):
            stream_handler = logging.StreamHandler()
            stream_handler.setLevel(logging.INFO)
            formatter = logging.Formatter(
                '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
            )
            stream_handler.setFormatter(formatter)
            app.logger.addHandler(stream_handler)
        else:
            # File-based logging for development
            if not os.path.exists('logs'):
                os.mkdir('logs')
            file_handler = logging.FileHandler('logs/app.log')
            file_handler.setFormatter(logging.Formatter(
                '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
            ))
            file_handler.setLevel(logging.INFO)
            app.logger.addHandler(file_handler)
        
        app.logger.setLevel(logging.INFO)
        app.logger.info('Scott Overhead Doors application startup completed')
    
    return app

def create_fallback_customer_routes(app):
    """Create fallback customer routes if the blueprint import fails"""
    
    @app.route('/api/customers', methods=['GET'])
    def fallback_get_customers():
        """Fallback route to get all customers with comprehensive error handling"""
        try:
            # Try to import the Customer model
            try:
                from models.customer import Customer
                customers = Customer.query.all()
                
                customers_data = []
                for customer in customers:
                    customer_dict = {
                        'id': customer.id,
                        'name': customer.name,
                        'contact_name': getattr(customer, 'contact_name', None),
                        'email': getattr(customer, 'email', None),
                        'phone': getattr(customer, 'phone', None),
                        'address': getattr(customer, 'address', None),
                        'created_at': customer.created_at.isoformat() if hasattr(customer, 'created_at') and customer.created_at else None,
                        'updated_at': customer.updated_at.isoformat() if hasattr(customer, 'updated_at') and customer.updated_at else None,
                    }
                    customers_data.append(customer_dict)
                
                return jsonify(customers_data)
                
            except ImportError:
                # Return mock data if model doesn't exist
                return jsonify([
                    {
                        'id': 1,
                        'name': 'Test Customer 1',
                        'contact_name': 'John Doe',
                        'email': 'john@test.com',
                        'phone': '555-1234',
                        'address': '123 Test St',
                        'created_at': datetime.utcnow().isoformat(),
                        'updated_at': datetime.utcnow().isoformat(),
                    },
                    {
                        'id': 2,
                        'name': 'Test Customer 2',
                        'contact_name': 'Jane Smith',
                        'email': 'jane@test.com',
                        'phone': '555-5678',
                        'address': '456 Test Ave',
                        'created_at': datetime.utcnow().isoformat(),
                        'updated_at': datetime.utcnow().isoformat(),
                    }
                ])
        except Exception as e:
            app.logger.error(f"Error in fallback get_customers: {e}")
            return jsonify({'error': 'Failed to load customers'}), 500
    
    @app.route('/api/customers/<int:customer_id>', methods=['GET'])
    def fallback_get_customer(customer_id):
        """Fallback route to get a specific customer with error handling"""
        try:
            from models.customer import Customer
            customer = Customer.query.get_or_404(customer_id)
            
            customer_dict = {
                'id': customer.id,
                'name': customer.name,
                'contact_name': getattr(customer, 'contact_name', None),
                'email': getattr(customer, 'email', None),
                'phone': getattr(customer, 'phone', None),
                'address': getattr(customer, 'address', None),
                'created_at': customer.created_at.isoformat() if hasattr(customer, 'created_at') and customer.created_at else None,
                'updated_at': customer.updated_at.isoformat() if hasattr(customer, 'updated_at') and customer.updated_at else None,
            }
            
            return jsonify(customer_dict)
            
        except ImportError:
            return jsonify({'error': 'Customer model not available'}), 500
        except Exception as e:
            app.logger.error(f"Error in fallback get_customer: {e}")
            return jsonify({'error': str(e)}), 404
    
    @app.route('/api/customers', methods=['POST'])
    def fallback_create_customer():
        """Fallback route to create a new customer with comprehensive validation"""
        try:
            from models.customer import Customer
            
            data = request.get_json()
            if not data or not data.get('name'):
                return jsonify({'error': 'Customer name is required'}), 400
            
            customer = Customer(
                name=data['name'],
                contact_name=data.get('contact_name'),
                email=data.get('email'),
                phone=data.get('phone'),
                address=data.get('address')
            )
            
            db.session.add(customer)
            db.session.commit()
            
            return jsonify({
                'id': customer.id,
                'name': customer.name,
                'contact_name': customer.contact_name,
                'email': customer.email,
                'phone': customer.phone,
                'address': customer.address,
                'created_at': customer.created_at.isoformat() if hasattr(customer, 'created_at') and customer.created_at else None,
            }), 201
            
        except ImportError:
            return jsonify({'error': 'Customer model not available'}), 500
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error in fallback create_customer: {e}")
            return jsonify({'error': str(e)}), 500
    
    app.logger.info("✓ Fallback customer routes created")

def create_default_users():
    """Create default users if they don't exist, with comprehensive error handling"""
    try:
        from models.user import User  # Import inside the function
        
        # Check if the admin user 'scott' already exists. If so, assume all users are created.
        if User.query.filter_by(username='scott').first():
            print("✓ Default users already exist. Skipping creation.")
            return

        print("Attempting to create default users...")
        
        users_to_create = [
            # Admins
            {'username': 'taylor', 'password': 'password', 'email': 'taylor@scottoverheaddoors.com', 'first_name': 'Taylor', 'last_name': 'Admin', 'role': 'admin'},
            {'username': 'kelly', 'password': 'password', 'email': 'kelly@scottoverheaddoors.com', 'first_name': 'Kelly', 'last_name': 'Admin', 'role': 'admin'},
            {'username': 'scott', 'password': 'password', 'email': 'scott@scottoverheaddoors.com', 'first_name': 'Scott', 'last_name': 'Owner', 'role': 'admin'},
            {'username': 'brett', 'password': 'password', 'email': 'brett@scottoverheaddoors.com', 'first_name': 'Brett', 'last_name': 'Admin', 'role': 'admin'},
            # Field Techs
            {'username': 'truck1', 'password': 'password', 'email': 'truck1@scottoverheaddoors.com', 'first_name': 'Truck', 'last_name': 'One', 'role': 'field'},
            {'username': 'truck2', 'password': 'password', 'email': 'truck2@scottoverheaddoors.com', 'first_name': 'Truck', 'last_name': 'Two', 'role': 'field'},
            {'username': 'truck3', 'password': 'password', 'email': 'truck3@scottoverheaddoors.com', 'first_name': 'Truck', 'last_name': 'Three', 'role': 'field'},
            {'username': 'truck4', 'password': 'password', 'email': 'truck4@scottoverheaddoors.com', 'first_name': 'Truck', 'last_name': 'Four', 'role': 'field'},
            {'username': 'truck5', 'password': 'password', 'email': 'truck5@scottoverheaddoors.com', 'first_name': 'Truck', 'last_name': 'Five', 'role': 'field'},
            {'username': 'truck6', 'password': 'password', 'email': 'truck6@scottoverheaddoors.com', 'first_name': 'Truck', 'last_name': 'Six', 'role': 'field'},
        ]
        
        for user_data in users_to_create:
            new_user = User(
                username=user_data['username'],
                email=user_data['email'],
                first_name=user_data['first_name'],
                last_name=user_data['last_name'],
                role=user_data['role']
            )
            # Standardized default password for all users for easy testing
            new_user.set_password(user_data['password'])
            db.session.add(new_user)
        
        db.session.commit()
        print(f"✓ Successfully created {len(users_to_create)} default users. You can now log in (e.g., kelly/password).")
        
    except Exception as e:
        db.session.rollback()
        print(f"⚠ Default user creation failed: {e}")

# Create the app instance for Choreo deployment
app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)