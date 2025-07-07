import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # Database Configuration for Azure
    if os.environ.get('DATABASE_URL'):
        # Azure SQL Database
        SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    else:
        # Local SQLite
        SQLALCHEMY_DATABASE_URI = 'sqlite:///scott_overhead_doors.db'
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Azure-specific settings
    LOG_TO_STDOUT = os.environ.get('LOG_TO_STDOUT', False)
    
    # CORS settings
    CORS_ORIGINS = [
        "https://your-frontend.azurewebsites.net",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    
    # File upload settings
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB
    
    # FIXED: Upload folder configuration
    # Get the absolute path of the directory where config.py is located
    basedir = os.path.abspath(os.path.dirname(__file__))
    
    # Define the absolute path to the 'uploads' directory
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    
    # Ensure the upload folder exists
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        print(f"Created upload folder: {UPLOAD_FOLDER}")
    else:
        print(f"Upload folder exists: {UPLOAD_FOLDER}")
    
    # OpenAI API
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
    
    # Timezone
    TIMEZONE = 'America/Los_Angeles'

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
    # Add production-specific settings

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}