# config.py
# Fixed Configuration for Choreo deployment with PostgreSQL support and proper CORS origins

import os
from datetime import timedelta

# Base Configuration Class
class Config:
    """Base configuration settings"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # FIXED: PostgreSQL Database Configuration with fallback
    # Choreo typically provides DATABASE_URL environment variable
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
        'pool_recycle': 300,  # Recycle connections every 5 minutes
        'pool_pre_ping': True,  # Validate connections before use
        'pool_size': 10,  # Connection pool size
        'max_overflow': 20,  # Max overflow connections
        'pool_timeout': 30,  # Timeout for getting connection from pool
        'echo': False,  # Set to True for SQL logging in development
    }
    
    # Session Configuration for cross-origin requests
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)
    SESSION_COOKIE_SECURE = True  # HTTPS only in production
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'None'  # Required for cross-origin requests
    
    # FIXED: Comprehensive CORS Origins for Choreo deployment
    CORS_ORIGINS = [
        # Your current Choreo frontend URL
        'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
        
        # Potential alternative frontend URLs if you redeploy
        'https://*.choreoapps.dev',
        'https://*.e1-us-east-azure.choreoapps.dev',
        
        # Local development
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        
        # Ngrok for development
        'https://*.ngrok.io',
        'https://*.ngrok-free.app',
    ]
    
    # Security Headers
    WTF_CSRF_ENABLED = False  # Disable CSRF for API usage
    
    # Rate Limiting
    RATELIMIT_STORAGE_URL = "memory://"
    
    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    
    # File Upload Configuration
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads')
    
    # Email Configuration (if needed later)
    MAIL_SERVER = os.environ.get('MAIL_SERVER')
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 587)
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')

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
        # Also include production URLs for testing
        'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
        'https://*.choreoapps.dev'
    ]
    
    # Less strict session cookies for development
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Development database with PostgreSQL preference
    DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('DEV_DATABASE_URL')
    if DATABASE_URL:
        if DATABASE_URL.startswith('postgres://'):
            DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
        SQLALCHEMY_DATABASE_URI = DATABASE_URL
    else:
        # Fallback to SQLite for local development without PostgreSQL
        SQLALCHEMY_DATABASE_URI = 'sqlite:///dev_app.db'
    
    # Enable SQL logging in development
    SQLALCHEMY_ENGINE_OPTIONS = {
        **Config.SQLALCHEMY_ENGINE_OPTIONS,
        'echo': True,  # Log all SQL statements
    }

class ProductionConfig(Config):
    """Production configuration for Choreo with PostgreSQL"""
    DEBUG = False
    DEVELOPMENT = False
    
    # Strict CORS for production
    CORS_ORIGINS = [
        # Your exact frontend URL
        'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
        
        # Wildcard patterns for Choreo redeployments
        'https://*.e1-us-east-azure.choreoapps.dev',
    ]
    
    # FIXED: Production PostgreSQL database configuration
    # Choreo provides DATABASE_URL as environment variable
    DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')
    
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is required for production")
    
    # Ensure we're using postgresql:// not postgres://
    if DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    
    # Production-optimized database settings
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 3600,  # Recycle connections every hour
        'pool_pre_ping': True,  # Always validate connections
        'pool_size': 20,  # Larger pool for production
        'max_overflow': 30,  # More overflow connections
        'pool_timeout': 60,  # Longer timeout for production
        'echo': False,  # No SQL logging in production
        'pool_reset_on_return': 'commit',  # Reset connections on return
    }
    
    # Secure session configuration
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'None'  # Required for cross-origin
    
    # Enhanced security for production
    @property
    def SECRET_KEY(self):
        """Get SECRET_KEY with validation for production environment"""
        secret_key = os.environ.get('SECRET_KEY')
        if not secret_key:
            # Only raise error if we're actually in production environment
            current_env = os.environ.get('FLASK_ENV', 'development')
            choreo_env = os.environ.get('CHOREO_ENVIRONMENT', '')
            if current_env == 'production' or choreo_env == 'production':
                raise ValueError("No SECRET_KEY set for production environment. Please set SECRET_KEY environment variable.")
            else:
                # Fallback to parent class default for non-production
                return super().SECRET_KEY
        return secret_key
    
    # Production logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'WARNING')

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    
    # Use in-memory database for testing
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    
    # Disable CSRF for testing
    WTF_CSRF_ENABLED = False
    
    # Permissive CORS for testing
    CORS_ORIGINS = ['*']
    
    # Faster password hashing for tests
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

# FIXED: Enhanced Choreo environment detection
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

# Database utility functions for PostgreSQL
def get_database_info():
    """Get information about the current database configuration"""
    config_name = get_config_name()
    config_obj = config[config_name]
    
    db_uri = config_obj.SQLALCHEMY_DATABASE_URI
    
    info = {
        'config_name': config_name,
        'database_uri': db_uri[:50] + '...' if len(db_uri) > 50 else db_uri,
        'database_type': 'postgresql' if 'postgresql://' in db_uri else 'sqlite' if 'sqlite://' in db_uri else 'unknown'
    }
    
    return info

def validate_database_config():
    """Validate that database configuration is correct"""
    try:
        config_name = get_config_name()
        config_obj = config[config_name]
        
        # Check if DATABASE_URL is set for production
        if config_name == 'production':
            if not os.environ.get('DATABASE_URL') and not os.environ.get('POSTGRES_URL'):
                return False, "DATABASE_URL environment variable is required for production"
        
        # Validate URI format
        db_uri = config_obj.SQLALCHEMY_DATABASE_URI
        if not db_uri:
            return False, "SQLALCHEMY_DATABASE_URI is not set"
        
        # Check for common URI format issues
        if db_uri.startswith('postgres://'):
            return False, "Database URI should use 'postgresql://' not 'postgres://'"
        
        return True, "Database configuration is valid"
        
    except Exception as e:
        return False, f"Error validating database config: {str(e)}"

# Environment detection utilities
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

# Print configuration info on import for debugging
if __name__ == '__main__':
    config_name = get_config_name()
    db_info = get_database_info()
    
    print(f"Configuration: {config_name}")
    print(f"Database Type: {db_info['database_type']}")
    print(f"Database URI: {db_info['database_uri']}")
    print(f"Is Choreo: {is_choreo_environment()}")
    
    is_valid, message = validate_database_config()
    print(f"Config Valid: {is_valid} - {message}")