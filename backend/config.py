# config.py - Azure-optimized configuration for Scott Overhead Doors
# Supports Azure App Service, PostgreSQL, and Blob Storage

import os
from datetime import timedelta

class Config:
    """Base configuration for Azure deployment"""
    
    # Security Configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # Azure PostgreSQL Database Configuration
    DATABASE_URL = os.environ.get('DATABASE_URL')
    
    if DATABASE_URL:
        # Ensure we're using postgresql:// not postgres://
        if DATABASE_URL.startswith('postgres://'):
            DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
        SQLALCHEMY_DATABASE_URI = DATABASE_URL
    else:
        # Fallback for local development only
        SQLALCHEMY_DATABASE_URI = 'sqlite:///app.db'
    
    # SQLAlchemy Configuration for Azure PostgreSQL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
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
        'https://*.azurestaticapps.net',  # Azure Static Web Apps
        'https://*.azurewebsites.net',    # Azure App Service
        'http://localhost:3000',          # Local development
        'http://127.0.0.1:3000',         # Local development
    ]
    
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

class DevelopmentConfig(Config):
    """Development configuration for local testing"""
    DEBUG = True
    DEVELOPMENT = True
    
    # Relaxed settings for development
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Additional CORS origins for development
    CORS_ORIGINS = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'https://*.ngrok.io',
        'https://*.ngrok-free.app',
    ]
    
    # Development database
    DEV_DATABASE_URL = os.environ.get('DEV_DATABASE_URL')
    if DEV_DATABASE_URL:
        if DEV_DATABASE_URL.startswith('postgres://'):
            DEV_DATABASE_URL = DEV_DATABASE_URL.replace('postgres://', 'postgresql://', 1)
        SQLALCHEMY_DATABASE_URI = DEV_DATABASE_URL
    else:
        SQLALCHEMY_DATABASE_URI = 'sqlite:///dev_app.db'
    
    # Enable SQL logging in development
    SQLALCHEMY_ENGINE_OPTIONS = {
        **Config.SQLALCHEMY_ENGINE_OPTIONS,
        'echo': True,
    }

class ProductionConfig(Config):
    """Production configuration for Azure App Service"""
    DEBUG = False
    DEVELOPMENT = False
    
    # Ensure SECRET_KEY is set for production
    def __init__(self):
        super().__init__()
        
        secret_key = os.environ.get('SECRET_KEY')
        if not secret_key:
            raise ValueError("SECRET_KEY environment variable is required for production")
        self.SECRET_KEY = secret_key
    
    # Production CORS - restrict to your actual domains
    CORS_ORIGINS = [
        'https://your-frontend.azurestaticapps.net',  # Replace with your actual frontend URL
        'https://scottoverheaddoors.azurewebsites.net',  # Replace with your actual backend URL
    ]
    
    # Production database validation
    @property
    def SQLALCHEMY_DATABASE_URI(self):
        database_url = os.environ.get('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is required for production")
        
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
        return database_url
    
    # Production-optimized database settings
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 3600,
        'pool_pre_ping': True,
        'pool_size': 20,
        'max_overflow': 30,
        'pool_timeout': 60,
        'echo': False,
        'pool_reset_on_return': 'commit',
    }
    
    # Azure Blob Storage is required in production
    def validate_azure_storage(self):
        if not os.environ.get('AZURE_STORAGE_CONNECTION_STRING'):
            raise ValueError("AZURE_STORAGE_CONNECTION_STRING is required for production")

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    SECRET_KEY = 'testing-secret-key'
    CORS_ORIGINS = ['*']

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
    if os.environ.get('WEBSITE_SITE_NAME'):  # Azure App Service indicator
        return 'production'
    
    # Check for production database URL
    if os.environ.get('DATABASE_URL'):
        # If we have Azure PostgreSQL URL, likely production
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
            'DATABASE_URL',
            'AZURE_STORAGE_CONNECTION_STRING'
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