# config.py
# Fixed Configuration for Choreo deployment with proper CORS origins

import os
from datetime import timedelta

# Base Configuration Class
class Config:
    """Base configuration settings"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # Database Configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///app.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 300,
        'pool_pre_ping': True
    }
    
    # Session Configuration
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)
    SESSION_COOKIE_SECURE = True  # HTTPS only
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'None'  # Required for cross-origin requests
    
    # FIXED: Comprehensive CORS Origins for Choreo deployment
    CORS_ORIGINS = [
        # Your current Choreo frontend URL
        'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
        
        # Add potential alternative frontend URLs if you redeploy
        'https://*.choreoapps.dev',
        'https://*.e1-us-east-azure.choreoapps.dev',
        
        # Local development
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        
        # Ngrok for development
        'https://*.ngrok.io',
        'https://*.ngrok-free.app',
        
        # Add any custom domains you might use
        # 'https://yourdomain.com',
    ]
    
    # Security Headers
    WTF_CSRF_ENABLED = False  # Disable CSRF for API usage
    
    # Rate Limiting
    RATELIMIT_STORAGE_URL = "memory://"
    
    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

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

class ProductionConfig(Config):
    """Production configuration for Choreo"""
    DEBUG = False
    DEVELOPMENT = False
    
    # Strict CORS for production
    CORS_ORIGINS = [
        # FIXED: Your exact frontend URL
        'https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev',
        
        # Wildcard patterns for Choreo redeployments
        'https://*.e1-us-east-azure.choreoapps.dev',
    ]
    
    # Production database (if using external DB)
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')
    
    # Secure session configuration
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'None'  # Required for cross-origin
    
    # Enhanced security for production - validate SECRET_KEY at initialization
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

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    
    # Permissive CORS for testing
    CORS_ORIGINS = ['*']

# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

# Choreo environment detection
def get_config_name():
    """Auto-detect environment based on environment variables"""
    if os.environ.get('CHOREO_ENVIRONMENT') == 'production':
        return 'production'
    elif os.environ.get('FLASK_ENV') == 'production':
        return 'production'
    elif os.environ.get('TESTING'):
        return 'testing'
    else:
        return 'development'