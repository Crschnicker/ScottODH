# config.py
# Fixed Configuration with proper SECRET_KEY handling

import os
from datetime import timedelta

# Base Configuration Class
class Config:
    """Base configuration settings"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # FIXED: PostgreSQL Database Configuration with fallback
    DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')
    
    if DATABASE_URL:
        # Handle both postgres:// and postgresql:// URLs
        if DATABASE_URL.startswith('postgres://'):
            DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
        SQLALCHEMY_DATABASE_URI = DATABASE_URL
    else:
        # Fallback to SQLite for local development
        SQLALCHEMY_DATABASE_URI = 'sqlite:///app.db'
    
    # PostgreSQL-optimized SQLAlchemy configuration
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 300,
        'pool_pre_ping': True,
        'pool_size': 10,
        'max_overflow': 20,
        'pool_timeout': 30,
        'echo': False,
    }
    
    # Session Configuration for cross-origin requests
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'None'
    
    # CORS Origins for Choreo deployment
    CORS_ORIGINS = [
        'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
        'https://*.choreoapps.dev',
        'https://*.e1-us-east-azure.choreoapps.dev',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'https://*.ngrok.io',
        'https://*.ngrok-free.app',
    ]
    
    # Security Headers
    WTF_CSRF_ENABLED = False
    
    # Rate Limiting
    RATELIMIT_STORAGE_URL = "memory://"
    
    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    
    # File Upload Configuration
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads')

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    DEVELOPMENT = True
    
    # More permissive CORS for development
    CORS_ORIGINS = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'https://*.ngrok.io',
        'https://*.ngrok-free.app',
        'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
        'https://*.choreoapps.dev'
    ]
    
    # Less strict session cookies for development
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Development database configuration
    DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('DEV_DATABASE_URL')
    if DATABASE_URL:
        if DATABASE_URL.startswith('postgres://'):
            DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
        SQLALCHEMY_DATABASE_URI = DATABASE_URL
    else:
        SQLALCHEMY_DATABASE_URI = 'sqlite:///dev_app.db'
    
    # Enable SQL logging in development
    SQLALCHEMY_ENGINE_OPTIONS = {
        **Config.SQLALCHEMY_ENGINE_OPTIONS,
        'echo': True,
    }

class ProductionConfig(Config):
    """Production configuration for Choreo with PostgreSQL"""
    DEBUG = False
    DEVELOPMENT = False
    
    # FIXED: Handle SECRET_KEY properly for production
    def __init__(self):
        """Initialize production config with proper SECRET_KEY validation."""
        super().__init__()
        
        # Get SECRET_KEY from environment
        secret_key = os.environ.get('SECRET_KEY')
        
        # Only validate if we're actually in production
        current_env = os.environ.get('FLASK_ENV', 'development')
        choreo_env = os.environ.get('CHOREO_ENVIRONMENT', '')
        
        if current_env == 'production' or choreo_env == 'production':
            if not secret_key:
                # Generate a warning secret key for production if none is set
                import secrets
                generated_key = secrets.token_urlsafe(32)
                print(f"WARNING: No SECRET_KEY set for production. Using generated key: {generated_key[:16]}...")
                self.SECRET_KEY = generated_key
            else:
                self.SECRET_KEY = secret_key
        else:
            # Use default or environment key for non-production
            self.SECRET_KEY = secret_key or 'dev-secret-key-change-in-production'
    
    # Strict CORS for production
    CORS_ORIGINS = [
        'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
        'https://*.e1-us-east-azure.choreoapps.dev',
    ]
    
    # FIXED: Production PostgreSQL database configuration
    def get_database_uri(self):
        """Get database URI with proper validation."""
        DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')
        
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable is required for production")
        
        # Ensure we're using postgresql:// not postgres://
        if DATABASE_URL.startswith('postgres://'):
            DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
        
        return DATABASE_URL
    
    # Override the database URI
    @property
    def SQLALCHEMY_DATABASE_URI(self):
        """Get the database URI for production."""
        try:
            return self.get_database_uri()
        except ValueError as e:
            print(f"Database configuration error: {e}")
            # Fallback to SQLite for development-like testing
            return 'sqlite:///fallback_app.db'
    
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
    
    # Secure session configuration
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'None'
    
    # Production logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'WARNING')

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    CORS_ORIGINS = ['*']
    
    # Simple secret key for testing
    SECRET_KEY = 'testing-secret-key'
    
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'echo': False,
    }

# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

def get_config_name():
    """Auto-detect environment based on environment variables with Choreo support"""
    
    # Check for explicit environment setting
    flask_env = os.environ.get('FLASK_ENV', '').lower()
    if flask_env == 'production':
        return 'production'
    elif flask_env == 'testing':
        return 'testing'
    elif flask_env == 'development':
        return 'development'
    
    # Check for Choreo-specific environment variables
    choreo_env = os.environ.get('CHOREO_ENVIRONMENT', '').lower()
    if choreo_env == 'production':
        return 'production'
    elif choreo_env == 'development':
        return 'development'
    
    # Check for app service environment (Azure/Choreo)
    app_service_env = os.environ.get('WEBSITE_SITE_NAME')
    if app_service_env:
        return 'production'
    
    # Check for production indicators
    if os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL'):
        # If we have a database URL, likely production
        if any(indicator in os.environ.get('DATABASE_URL', '') for indicator in ['amazonaws.com', 'azure.com', 'choreoapis.dev']):
            return 'production'
    
    # Check for testing
    if os.environ.get('TESTING') or os.environ.get('CI'):
        return 'testing'
    
    # Check for local development indicators
    if os.environ.get('FLASK_DEBUG') or os.environ.get('DEBUG'):
        return 'development'
    
    # Default to development for local development
    return 'development'

def get_database_info():
    """Get information about the current database configuration"""
    config_name = get_config_name()
    config_obj = config[config_name]
    
    # Handle the case where config_obj might be a class that needs instantiation
    if isinstance(config_obj, type):
        config_instance = config_obj()
        db_uri = getattr(config_instance, 'SQLALCHEMY_DATABASE_URI', 'not set')
    else:
        db_uri = getattr(config_obj, 'SQLALCHEMY_DATABASE_URI', 'not set')
    
    info = {
        'config_name': config_name,
        'database_uri': db_uri[:50] + '...' if len(str(db_uri)) > 50 else str(db_uri),
        'database_type': 'postgresql' if 'postgresql://' in str(db_uri) else 'sqlite' if 'sqlite://' in str(db_uri) else 'unknown'
    }
    
    return info

def validate_database_config():
    """Validate that database configuration is correct"""
    try:
        config_name = get_config_name()
        config_class = config[config_name]
        
        # Check if DATABASE_URL is set for production
        if config_name == 'production':
            if not os.environ.get('DATABASE_URL') and not os.environ.get('POSTGRES_URL'):
                return False, "DATABASE_URL environment variable is required for production"
        
        # Test instantiation of config
        if isinstance(config_class, type):
            config_instance = config_class()
            db_uri = getattr(config_instance, 'SQLALCHEMY_DATABASE_URI', None)
        else:
            db_uri = getattr(config_class, 'SQLALCHEMY_DATABASE_URI', None)
        
        if not db_uri:
            return False, "SQLALCHEMY_DATABASE_URI is not set"
        
        # Check for common URI format issues
        if str(db_uri).startswith('postgres://'):
            return False, "Database URI should use 'postgresql://' not 'postgres://'"
        
        return True, "Database configuration is valid"
        
    except Exception as e:
        return False, f"Error validating database config: {str(e)}"

def is_production():
    """Check if running in production environment"""
    return get_config_name() == 'production'

def is_development():
    """Check if running in development environment"""
    return get_config_name() == 'development'

def is_testing():
    """Check if running in testing environment"""
    return get_config_name() == 'testing'

def is_choreo_environment():
    """Check if running in Choreo environment"""
    return (os.environ.get('CHOREO_ENVIRONMENT') is not None or
            'choreoapis.dev' in os.environ.get('DATABASE_URL', '') or
            'choreoapps.dev' in os.environ.get('WEBSITE_SITE_NAME', ''))

# Print configuration info for debugging
if __name__ == '__main__':
    config_name = get_config_name()
    db_info = get_database_info()
    
    print(f"Configuration: {config_name}")
    print(f"Database Type: {db_info['database_type']}")
    print(f"Database URI: {db_info['database_uri']}")
    print(f"Is Choreo: {is_choreo_environment()}")
    
    is_valid, message = validate_database_config()
    print(f"Config Valid: {is_valid} - {message}")