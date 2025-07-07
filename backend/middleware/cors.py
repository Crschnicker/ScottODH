# backend/middleware/cors.py
from flask_cors import CORS
from flask import request, make_response

def setup_cors(app, config_name):
    """Setup CORS configuration based on environment"""
    
    if config_name == 'production':
        # Production CORS settings
        cors_origins = app.config.get('CORS_ORIGINS', ['*'])
        CORS(app, origins=cors_origins, supports_credentials=True)
    else:
        # Development CORS settings - more permissive
        CORS(app, 
             origins=[
                 "http://localhost:3000",      # React development server
                 "http://127.0.0.1:3000",     # Alternative localhost
                 "https://*.ngrok.io",         # Ngrok tunnels (wildcard)
                 "https://*.ngrok.app",        # New ngrok domains
                 "https://*.ngrok-free.app",   # Free ngrok domains
                 "https://scottohd-api.ngrok.io"  # Specific ngrok URL
             ],
             allow_headers=[
                 "Content-Type",
                 "Accept", 
                 "Authorization",
                 "Cache-Control",
                 "X-Request-ID",
                 "X-Retry-Attempt",
                 "X-Client-Timestamp",
                 "X-Ngrok-Request",
                 "X-Test-Request",
                 "User-Agent"
             ],
             supports_credentials=True,
             methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
             max_age=86400
        )
    
    # Enhanced CORS handling for ngrok and local development
    @app.after_request
    def enhance_cors_headers(response):
        """Enhanced CORS headers specifically for ngrok tunnel compatibility"""
        origin = request.headers.get('Origin')
        
        # More aggressive CORS handling for ngrok and local development
        if origin and any(domain in origin for domain in 
                         ['ngrok.io', 'ngrok.app', 'ngrok-free.app', 'localhost', '127.0.0.1']):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name'
            response.headers['Access-Control-Expose-Headers'] = 'Content-Range, X-Content-Range'
            response.headers['Access-Control-Max-Age'] = '86400'
            
            # Add headers that help with ngrok tunnel stability
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        
        return response
    
    # Emergency CORS fix for specific issues
    @app.after_request
    def emergency_cors_fix(response):
        origin = request.headers.get('Origin')
        if origin and ('ngrok' in origin or 'localhost' in origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response