from flask_cors import CORS
from flask import request, make_response, current_app
import os

def setup_cors(app, config_name=None):
    """
    Comprehensive CORS setup for Choreo deployment with fallback handling
    """
    
    # Determine environment
    environment = config_name or os.environ.get('FLASK_ENV', 'development')
    
    # Define allowed origins based on environment
    if environment == 'production':
        # Production origins - specific to your Choreo deployment
        allowed_origins = [
            # Your specific Choreo URLs from the error logs
            "https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev",
            "https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev",
            # Choreo wildcard patterns
            "https://*.e1-us-east-azure.choreoapps.dev",
            "https://*.e1-us-east-azure.choreoapis.dev",
            "https://*.choreoapis.dev",
            "https://*.choreoapps.dev",
        ]
    else:
        # Development origins - more permissive
        allowed_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://*.ngrok.io",
            "https://*.ngrok-free.app",
            "https://scottohd.ngrok.io",
            # Include Choreo URLs for testing
            "https://*.choreoapis.dev",
            "https://*.choreoapps.dev",
        ]
    
    # Initialize CORS with comprehensive configuration
    CORS(app, 
         origins=allowed_origins,
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
         supports_credentials=True,
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
         max_age=86400,
         send_wildcard=False,  # Required when supports_credentials=True
         vary_header=True
    )
    
    @app.before_request
    def handle_preflight():
        """Handle preflight OPTIONS requests comprehensively"""
        if request.method == "OPTIONS":
            origin = request.headers.get('Origin')
            
            # Create response for preflight request
            response = make_response()
            
            # Set CORS headers for preflight
            if origin:
                # Check if origin is allowed
                if _is_origin_allowed(origin, allowed_origins):
                    response.headers['Access-Control-Allow-Origin'] = origin
                    response.headers['Access-Control-Allow-Credentials'] = 'true'
                else:
                    # For development, be more permissive
                    if environment != 'production' and _is_development_origin(origin):
                        response.headers['Access-Control-Allow-Origin'] = origin
                        response.headers['Access-Control-Allow-Credentials'] = 'true'
            
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH'
            response.headers['Access-Control-Allow-Headers'] = ', '.join([
                "Accept", "Authorization", "Cache-Control", "Content-Type", 
                "Origin", "Pragma", "X-Requested-With", "X-Client-Info",
                "X-Request-Timestamp", "X-Forwarded-Proto", "X-Forwarded-Host"
            ])
            response.headers['Access-Control-Max-Age'] = '86400'
            response.status_code = 200
            
            return response
    
    @app.after_request
    def after_request(response):
        """Enhanced after_request handler for better CORS compatibility"""
        origin = request.headers.get('Origin')
        
        if origin:
            # Check if origin is explicitly allowed
            if _is_origin_allowed(origin, allowed_origins):
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
            # For development, be more permissive with localhost and ngrok
            elif environment != 'production' and _is_development_origin(origin):
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
            
            # Always set these headers for better compatibility
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH'
            response.headers['Access-Control-Allow-Headers'] = ', '.join([
                "Accept", "Authorization", "Cache-Control", "Content-Type",
                "Origin", "Pragma", "X-Requested-With", "X-Client-Info",
                "X-Request-Timestamp", "X-Forwarded-Proto", "X-Forwarded-Host"
            ])
            
        # Add security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        
        # Cache control for API responses
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        
        return response

def _is_origin_allowed(origin, allowed_origins):
    """
    Check if an origin is allowed based on exact match or wildcard patterns
    """
    origin_lower = origin.lower()
    
    for allowed in allowed_origins:
        allowed_lower = allowed.lower()
        
        # Exact match
        if origin_lower == allowed_lower:
            return True
            
        # Wildcard match
        if allowed_lower.startswith('https://*.'):
            domain = allowed_lower[10:]  # Remove 'https://*.'
            if origin_lower.endswith('.' + domain) or origin_lower == 'https://' + domain:
                return True
        elif allowed_lower.startswith('http://*.'):
            domain = allowed_lower[9:]   # Remove 'http://*.'
            if origin_lower.endswith('.' + domain) or origin_lower == 'http://' + domain:
                return True
    
    return False

def _is_development_origin(origin):
    """
    Check if origin is a development origin (localhost, ngrok, etc.)
    """
    origin_lower = origin.lower()
    development_patterns = [
        'localhost', '127.0.0.1', 'ngrok.io', 'ngrok-free.app', 
        'choreoapis.dev', 'choreoapps.dev'
    ]
    
    return any(pattern in origin_lower for pattern in development_patterns)

def log_cors_info(app):
    """
    Log CORS configuration for debugging
    """
    with app.app_context():
        current_app.logger.info("CORS Configuration:")
        current_app.logger.info(f"Environment: {os.environ.get('FLASK_ENV', 'development')}")
        current_app.logger.info(f"Supports Credentials: True")
        current_app.logger.info("CORS setup completed successfully")