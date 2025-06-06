import os
from datetime import timedelta

class Config:
    """
    Configuration class for Flask application settings.
    Contains all environment-specific settings and defaults.
    """
    
    # Basic Flask configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-change-this-in-production'
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///scott_overhead_doors.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 300,
        'pool_pre_ping': True
    }
    
    # Base CORS origins - will be extended in subclasses
    CORS_ORIGINS = [
        'http://localhost:3000',      # React development server
        'http://localhost:3001',      # Alternative React port
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://localhost:5000',      # Flask development server
        'http://127.0.0.1:5000'
    ]
    
    # API prefix for easier endpoint management
    API_PREFIX = "/api/"
    
    # Session configuration for Flask-Login
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'False').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)  # 24 hour session timeout
    
    # File upload configuration
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER') or 'uploads'
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max file size
    
    # Allowed file extensions for uploads
    ALLOWED_EXTENSIONS = {
        'audio': {'wav', 'mp3', 'mp4', 'm4a', 'aac', 'webm', 'ogg'},
        'image': {'png', 'jpg', 'jpeg', 'gif', 'bmp'},
        'document': {'pdf', 'doc', 'docx', 'txt'}
    }
    
    # Timezone configuration
    TIMEZONE = 'America/Los_Angeles'
    
    # API Keys and External Services
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
    
    # Email configuration (for future notifications)
    MAIL_SERVER = os.environ.get('MAIL_SERVER') or 'smtp.gmail.com'
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 587)
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    
    # Rate limiting configuration
    RATELIMIT_STORAGE_URL = 'memory://'
    RATELIMIT_DEFAULT = "100 per hour"
    
    # Logging configuration
    LOG_TO_STDOUT = os.environ.get('LOG_TO_STDOUT')
    
    # Business-specific configuration
    COMPANY_NAME = "Scott Overhead Doors"
    COMPANY_ADDRESS = "123 Main Street, Anytown, CA 92000"
    COMPANY_PHONE = "(555) 555-5555"
    COMPANY_EMAIL = "info@scottoverheaddoors.com"
    
    # Default user roles
    USER_ROLES = ['admin', 'field']
    
    # Business rates and pricing
    LABOR_RATE_PER_HOUR = 47.02  # $47.02 per hour
    TAX_RATE = 0.0875  # 8.75% tax rate
    
    # Job number generation settings
    MONTH_CODES = {
        1: "JA", 2: "FB", 3: "MR", 4: "AP", 5: "MY", 6: "JU",
        7: "JL", 8: "AG", 9: "SP", 10: "OT", 11: "NV", 12: "DC"
    }

class DevelopmentConfig(Config):
    """Development environment configuration with enhanced ngrok support"""
    DEBUG = True
    TESTING = False
    
    # More verbose logging in development
    LOG_LEVEL = 'DEBUG'
    
    # Development database
    SQLALCHEMY_DATABASE_URI = os.environ.get('DEV_DATABASE_URL') or 'sqlite:///scott_overhead_doors_dev.db'
    
    # Dynamic CORS for development that supports any ngrok URL
    def get_cors_origins():
        """Dynamic CORS origins that supports any ngrok tunnel"""
        base_origins = [
            # Standard local development
            'http://localhost:3000',
            'http://localhost:3001', 
            'http://localhost:3002',
            'http://localhost:3003',  # Additional ports
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:3002',
            'http://127.0.0.1:3003',
            'http://localhost:5000',
            'http://127.0.0.1:5000',
            'http://0.0.0.0:3000',    # Docker/container support
            'http://0.0.0.0:5000',
            
            # Common ngrok patterns (will be supplemented by runtime detection)
            'https://*.ngrok.io',
            'https://*.ngrok.app',
            'https://*.ngrok-free.app',
        ]
        
        # Add environment-specific origins
        additional_origins = os.environ.get('ADDITIONAL_CORS_ORIGINS', '')
        if additional_origins:
            base_origins.extend([origin.strip() for origin in additional_origins.split(',') if origin.strip()])
        
        # Add current ngrok URL from environment if set
        ngrok_url = os.environ.get('NGROK_URL')
        if ngrok_url:
            base_origins.append(ngrok_url)
            # Also add HTTP version if HTTPS is provided
            if ngrok_url.startswith('https://'):
                base_origins.append(ngrok_url.replace('https://', 'http://'))
        
        return base_origins
    
    CORS_ORIGINS = get_cors_origins()
    
    # Session configuration for ngrok tunnels
    SESSION_COOKIE_SECURE = False  # Allow HTTP for ngrok tunnels in development
    SESSION_COOKIE_SAMESITE = 'None' if os.environ.get('NGROK_URL') else 'Lax'

class ProductionConfig(Config):
    """Production environment configuration"""
    DEBUG = False
    TESTING = False
    
    # Production logging
    LOG_LEVEL = 'INFO'
    
    # Secure session cookies in production
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Production database
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    
    # Restricted CORS for production
    CORS_ORIGINS = [
        'https://yourdomain.com',
        'https://www.yourdomain.com'
    ] + (os.environ.get('PRODUCTION_CORS_ORIGINS', '').split(',') if os.environ.get('PRODUCTION_CORS_ORIGINS') else [])
    
    # Rate limiting for production
    RATELIMIT_DEFAULT = "50 per hour"

class TestingConfig(Config):
    """Testing environment configuration"""
    TESTING = True
    DEBUG = True
    
    # In-memory database for testing
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    
    # Disable CSRF for testing
    WTF_CSRF_ENABLED = False
    
    # Short session lifetime for testing
    PERMANENT_SESSION_LIFETIME = timedelta(minutes=5)
    
    # Permissive CORS for testing
    CORS_ORIGINS = ['*']  # Allow all origins in testing

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}