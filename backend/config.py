import os
from datetime import timedelta

class Config:
    """Base configuration for Azure deployment"""
    
    # Security Configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # ✅ FIXED: Database Configuration - Returns string, not property
    @staticmethod
    def get_database_url():
        """Get properly formatted database URL string"""
        database_url = os.environ.get('DATABASE_URL')
        
        if database_url:
            # Ensure we're using postgresql:// not postgres://
            if database_url.startswith('postgres://'):
                database_url = database_url.replace('postgres://', 'postgresql://', 1)
            return database_url
        else:
            # Fallback for local development
            return 'sqlite:///instance/dev_app.db'
    
    # ✅ CRITICAL FIX: Set as string attribute, not property
    SQLALCHEMY_DATABASE_URI = None  # Will be set in __init__
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # SQLAlchemy Configuration for Azure PostgreSQL
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 3600,
        'pool_pre_ping': True,
        'pool_size': 10,
        'max_overflow': 20,
        'pool_timeout': 30,
        'echo': False,
    }
    
    # Session Configuration for Azure App Service
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'None'
    SESSION_COOKIE_NAME = 'scott_auth'
    
    # Azure-specific CORS Origins
    CORS_ORIGINS = [
        'https://gray-glacier-0afce1c0f.1.azurestaticapps.net',
        'https://scott-overhead-doors.azurewebsites.net',
        'https://*.azurestaticapps.net',
        'https://*.azurewebsites.net',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]
    
    CORS_SUPPORTS_CREDENTIALS = True
    
    # Azure Blob Storage Configuration
    AZURE_STORAGE_CONNECTION_STRING = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
    AZURE_STORAGE_CONTAINER_NAME = os.environ.get('AZURE_STORAGE_CONTAINER_NAME', 'uploads')
    
    # File Upload Configuration
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads')
    
    # Security and Performance
    WTF_CSRF_ENABLED = False
    RATELIMIT_STORAGE_URL = "memory://"
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    
    def __init__(self):
        """Initialize configuration with proper database URL"""
        # ✅ CRITICAL: Set database URI as string attribute in constructor
        self.SQLALCHEMY_DATABASE_URI = self.get_database_url()

class DevelopmentConfig(Config):
    """Development configuration for local testing"""
    DEBUG = True
    DEVELOPMENT = True
    
    def __init__(self):
        super().__init__()
        
        # Relaxed settings for development
        self.SESSION_COOKIE_SECURE = False
        self.SESSION_COOKIE_SAMESITE = 'Lax'
        
        # Additional CORS origins for development
        self.CORS_ORIGINS = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'https://*.ngrok.io',
            'https://*.ngrok-free.app',
        ]
        
        # Development database - override with dev-specific URL if provided
        dev_database_url = os.environ.get('DEV_DATABASE_URL')
        if dev_database_url:
            if dev_database_url.startswith('postgres://'):
                dev_database_url = dev_database_url.replace('postgres://', 'postgresql://', 1)
            self.SQLALCHEMY_DATABASE_URI = dev_database_url
        else:
            self.SQLALCHEMY_DATABASE_URI = 'sqlite:///instance/dev_app.db'
        
        # Enable SQL logging in development
        self.SQLALCHEMY_ENGINE_OPTIONS = {
            **Config.SQLALCHEMY_ENGINE_OPTIONS,
            'echo': True,
        }

class ProductionConfig(Config):
    """Production configuration for Azure App Service"""
    DEBUG = False
    DEVELOPMENT = False
    
    def __init__(self):
        super().__init__()
        
        # Ensure SECRET_KEY is set for production
        secret_key = os.environ.get('SECRET_KEY')
        if not secret_key:
            raise ValueError("SECRET_KEY environment variable is required for production")
        self.SECRET_KEY = secret_key
        
        # ✅ FIXED: Ensure database URL is set and valid for production
        database_url = os.environ.get('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is required for production")
        
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
        self.SQLALCHEMY_DATABASE_URI = database_url
        
        # Production CORS - restrict to your actual domains
        self.CORS_ORIGINS = [
            'https://gray-glacier-0afce1c0f.1.azurestaticapps.net',
            'https://scott-overhead-doors.azurewebsites.net',
        ]
        
        # Production-optimized database settings
        self.SQLALCHEMY_ENGINE_OPTIONS = {
            'pool_recycle': 3600,
            'pool_pre_ping': True,
            'pool_size': 20,
            'max_overflow': 30,
            'pool_timeout': 60,
            'echo': False,
            'pool_reset_on_return': 'commit',
        }
        
        # Validate Azure Blob Storage in production
        if not os.environ.get('AZURE_STORAGE_CONNECTION_STRING'):
            print("WARNING: AZURE_STORAGE_CONNECTION_STRING not set - file uploads may not work")

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    WTF_CSRF_ENABLED = False
    SECRET_KEY = 'testing-secret-key'
    
    def __init__(self):
        super().__init__()
        self.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
        self.CORS_ORIGINS = ['*']

# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

def get_config_name():
    """Detect environment based on Azure App Service variables"""
    
    # Check explicit environment setting
    flask_env = os.environ.get('FLASK_ENV', '').lower()
    if flask_env in ['production', 'testing', 'development']:
        return flask_env
    
    # Check for Azure App Service environment
    if os.environ.get('WEBSITE_SITE_NAME'):
        return 'production'
    
    # Check for production database URL
    if os.environ.get('DATABASE_URL'):
        if 'postgres.database.azure.com' in os.environ.get('DATABASE_URL', ''):
            return 'production'
    
    # Check for testing environment
    if os.environ.get('TESTING') or os.environ.get('CI'):
        return 'testing'
    
    # Default to development
    return 'development'

def validate_azure_config():
    """Validate Azure-specific configuration"""
    config_name = get_config_name()
    
    if config_name == 'production':
        required_vars = [
            'SECRET_KEY',
            'DATABASE_URL'
        ]
        
        missing_vars = [var for var in required_vars if not os.environ.get(var)]
        
        if missing_vars:
            return False, f"Missing required environment variables: {', '.join(missing_vars)}"
    
    return True, "Configuration is valid"

def get_azure_info():
    """Get Azure deployment information"""
    return {
        'website_name': os.environ.get('WEBSITE_SITE_NAME'),
        'resource_group': os.environ.get('WEBSITE_RESOURCE_GROUP'),
        'subscription_id': os.environ.get('WEBSITE_OWNER_NAME'),
        'location': os.environ.get('WEBSITE_LOCATION'),
        'config_name': get_config_name(),
        'database_configured': bool(os.environ.get('DATABASE_URL')),
        'blob_storage_configured': bool(os.environ.get('AZURE_STORAGE_CONNECTION_STRING'))
    }

# Export commonly used functions
__all__ = [
    'config', 
    'get_config_name', 
    'validate_azure_config', 
    'get_azure_info'
]