import os
from dotenv import load_dotenv
from urllib.parse import quote_plus

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # PostgreSQL Database Configuration
    @staticmethod
    def get_database_uri():
        # Check for full DATABASE_URL first (for Choreo)
        database_url = os.environ.get('DATABASE_URL')
        if database_url:
            print(f"DEBUG: Using DATABASE_URL")
            return database_url
        
        # Build PostgreSQL connection string from components
        db_host = os.environ.get('DB_HOST')
        db_user = os.environ.get('DB_USER')
        db_password = os.environ.get('DB_PASSWORD')
        db_name = os.environ.get('DB_NAME', 'scott_overhead_doors')
        db_port = os.environ.get('DB_PORT', '5432')
        
        if db_host and db_user and db_password:
            # Azure PostgreSQL connection handling
            # Azure usernames can be in different formats:
            # 1. Just the username (ScottAdmin)
            # 2. Username with server suffix (ScottAdmin@scottohd)
            
            # Use the username as provided - don't modify it
            # Azure will handle the @servername suffix automatically if needed
            encoded_user = quote_plus(str(db_user))
            encoded_password = quote_plus(str(db_password))
            
            # PostgreSQL connection with SSL (required for Azure)
            connection_string = f'postgresql://{encoded_user}:{encoded_password}@{db_host}:{db_port}/{db_name}?sslmode=require'
            
            # Debug logging (remove in production)
            print(f"DEBUG: Connecting to host: {db_host}")
            print(f"DEBUG: Using username: {db_user}")
            print(f"DEBUG: Database name: {db_name}")
            print(f"DEBUG: Connection string: postgresql://{encoded_user}:***@{db_host}:{db_port}/{db_name}?sslmode=require")
            
            return connection_string
        else:
            # Fallback to SQLite for local development
            print("DEBUG: Using SQLite - PostgreSQL credentials not found")
            missing = []
            if not db_host: missing.append('DB_HOST')
            if not db_user: missing.append('DB_USER') 
            if not db_password: missing.append('DB_PASSWORD')
            print(f"DEBUG: Missing environment variables: {missing}")
            return 'sqlite:///scott_overhead_doors.db'
    
    SQLALCHEMY_DATABASE_URI = get_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 300,
        'pool_pre_ping': True,
        'pool_size': 10,
        'max_overflow': 20,
        'connect_args': {
            'connect_timeout': 30,
            'application_name': 'scott_overhead_doors_app'
        }
    }
    
    # Logging configuration for containers
    LOG_TO_STDOUT = os.environ.get('LOG_TO_STDOUT', 'true').lower() == 'true'
    
    # CORS settings - updated for Choreo
    CORS_ORIGINS = [
        "https://*.choreoapis.dev",  # Choreo frontend URLs
        "http://localhost:3000",     # Local development
        "http://127.0.0.1:3000",
        "https://*.ngrok.io",        # Testing
        "https://*.ngrok-free.app",
    ]
    
    # File upload settings - use temporary storage for containers
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB
    
    # Upload folder configuration for container deployment
    if os.environ.get('FLASK_ENV') == 'production':
        # Use /tmp for uploads in production containers
        UPLOAD_FOLDER = '/tmp/uploads'
    else:
        # Use local uploads folder for development
        basedir = os.path.abspath(os.path.dirname(__file__))
        UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    
    # Ensure upload folder exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # OpenAI API
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
    
    # Timezone
    TIMEZONE = 'America/Los_Angeles'

class DevelopmentConfig(Config):
    DEBUG = True
    LOG_TO_STDOUT = False

class ProductionConfig(Config):
    DEBUG = False
    LOG_TO_STDOUT = True

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}