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
    """Application factory for Azure deployment"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions
    db.init_app(app)
    migrate = Migrate(app, db)
    
    # Setup CORS - this handles everything properly
    CORS(app, 
         origins=[
             "https://your-frontend.azurewebsites.net",  # Your Azure frontend URL
             "http://localhost:3000",      # Local development
             "http://127.0.0.1:3000",     
             "https://*.ngrok.io",         # For testing
             "https://*.ngrok-free.app",   # New ngrok domain format
             "https://scottohd.ngrok.io",  # Your specific ngrok URL
         ],
         allow_headers=["Content-Type", "Accept", "Authorization", "X-Request-Timestamp", "X-Client-Info", "X-Forwarded-Proto", "X-Forwarded-Host"],
         supports_credentials=True,
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
         max_age=86400
    )
    
    # Setup authentication
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'login'  # Change 'login' to 'auth.login'
    
    @login_manager.user_loader
    def load_user(user_id):
        try:
            from models.user import User
            return User.query.get(int(user_id))
        except:
            return None
    
    # Health check endpoint for Azure
    @app.route('/api/health', methods=['GET', 'HEAD'])
    def health_check():
        return {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'version': '1.0.0'
        }
    
    # Root endpoint
    @app.route('/')
    def index():
        return jsonify({
            'message': 'Scott Overhead Doors API',
            'status': 'running',
            'version': '1.0.0'
        })
    
    # Azure-specific error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Resource not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500
    
    with app.app_context():
        # Import blueprints directly
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

        # Define all blueprints to be registered
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

        # Register each blueprint
        for blueprint, prefix in blueprint_configs:
            app.register_blueprint(blueprint, url_prefix=prefix)
            # You can uncomment the line below for extra debugging if you want
            # print(f"✓ Blueprint '{blueprint.name}' registered at {prefix}")

        # Create database tables and default users
        try:
            # First, ensure all tables are created based on your models.
            db.create_all()
            print("✓ Database tables created successfully.")
            
            # Second, call the function to populate the tables with default data.
            # This function is defined elsewhere in your app.py file.
            create_default_users()

        except Exception as e:
            print(f"⚠ Database setup failed: {e}")    
    # Configure logging for Azure
    if not app.debug and not app.testing:
        if app.config.get('LOG_TO_STDOUT'):
            stream_handler = logging.StreamHandler()
            stream_handler.setLevel(logging.INFO)
            app.logger.addHandler(stream_handler)
        else:
            if not os.path.exists('logs'):
                os.mkdir('logs')
            file_handler = logging.FileHandler('logs/app.log')
            file_handler.setFormatter(logging.Formatter(
                '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'))
            file_handler.setLevel(logging.INFO)
            app.logger.addHandler(file_handler)
        
        app.logger.setLevel(logging.INFO)
        app.logger.info('Scott Overhead Doors application startup')
    
    return app

def create_fallback_customer_routes(app):
    """Create fallback customer routes if the blueprint import fails"""
    
    @app.route('/api/customers', methods=['GET'])
    def fallback_get_customers():
        """Fallback route to get all customers"""
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
            print(f"Error in fallback get_customers: {e}")
            return jsonify({'error': 'Failed to load customers'}), 500
    
    @app.route('/api/customers/<int:customer_id>', methods=['GET'])
    def fallback_get_customer(customer_id):
        """Fallback route to get a specific customer"""
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
            return jsonify({'error': str(e)}), 404
    
    @app.route('/api/customers', methods=['POST'])
    def fallback_create_customer():
        """Fallback route to create a new customer"""
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
            return jsonify({'error': str(e)}), 500
    
    print("✓ Fallback customer routes created")

def create_default_users():
    """Create default users if they don't exist, now with more robust checks."""
    from models.user import User  # Import inside the function
    
    # Check if the admin user 'scott' already exists. If so, assume all users are created.
    if User.query.filter_by(username='scott').first():
        print("✓ Default users already exist. Skipping creation.")
        return

    print("Attempting to create default users...")
    
    try:
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
            # IMPORTANT: I've standardized the default password to 'password' for all users for easy testing.
            new_user.set_password(user_data['password'])
            db.session.add(new_user)
        
        db.session.commit()
        print(f"✓ Successfully created {len(users_to_create)} default users. You can now log in (e.g., truck1/password).")
        
    except Exception as e:
        db.session.rollback()
        print(f"⚠ Default user creation failed: {e}")
# Create the app instance for Azure
app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)