import os
from datetime import timedelta
from urllib.parse import quote_plus

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a-very-secret-key-that-you-should-change'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Use /tmp for uploads in containerized environments like Choreo
    UPLOAD_FOLDER = '/tmp/uploads'
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    # JWT Configuration (if you use it)
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or SECRET_KEY

    # Logging configuration
    LOG_TO_STDOUT = os.environ.get('LOG_TO_STDOUT', 'true').lower() == 'true'

    # Database configuration
    @staticmethod
    def get_database_uri():
        database_url = os.environ.get('DATABASE_URL')
        if database_url:
            return database_url
        
        # Fallback to local SQLite for development if no full URL is provided
        basedir = os.path.abspath(os.path.dirname(__file__))
        return f'sqlite:///{os.path.join(basedir, "instance", "app.db")}'

    SQLALCHEMY_DATABASE_URI = get_database_uri()

class ProductionConfig(Config):
    ENV = 'production'
    DEBUG = False
    # CRITICAL: Define the exact origins for your production frontend and backend API.
    # No wildcards are allowed when `supports_credentials` is True.
    CORS_ORIGINS = [
        "https://4e88f448-06ee-4bfb-a80b-1aabe234e03a.e1-us-east-azure.choreoapps.dev",
        "https://55541a65-8041-4b00-9307-2d837a189865-dev.e1-us-east-azure.choreoapis.dev",
    ]

class DevelopmentConfig(Config):
    ENV = 'development'
    DEBUG = True
    # Define origins for local development
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}