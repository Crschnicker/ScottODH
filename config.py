import os
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

class Config:
    # --- Critical Secrets ---
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a-default-fallback-secret-key'
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
    
    # --- Database ---
    DATABASE_URL = os.environ.get('DATABASE_URL')
    SQLALCHEMY_DATABASE_URI = DATABASE_URL or 'sqlite:///' + os.path.join(basedir, 'scott_overhead_doors.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # --- Azure Storage for File Uploads ---
    AZURE_STORAGE_CONNECTION_STRING = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
    
    # --- Flask Settings ---
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'False').lower() in ('true', '1', 't')
    SESSION_COOKIE_HTTPONLY = os.environ.get('SESSION_COOKIE_HTTPONLY', 'True').lower() in ('true', '1', 't')
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 16 * 1024 * 1024)) # Default 16MB
    
    # --- Business & Report Settings ---
    LABOR_RATE_PER_HOUR = float(os.environ.get('LABOR_RATE_PER_HOUR', 47.02))
    TAX_RATE = float(os.environ.get('TAX_RATE', 0.0875))
    TIMEZONE = os.environ.get('TIMEZONE', 'America/Los_Angeles')

    COMPANY_NAME = os.environ.get('COMPANY_NAME', 'Scott Overhead Doors')
    COMPANY_ADDRESS = os.environ.get('COMPANY_ADDRESS', '123 Main Street, Anytown, CA 92000')
    COMPANY_PHONE = os.environ.get('COMPANY_PHONE', '(555) 555-5555')
    COMPANY_EMAIL = os.environ.get('COMPANY_EMAIL', 'info@scottoverheaddoors.com')
    COMPANY_LICENSE = os.environ.get('COMPANY_LICENSE', '#123456')

    # --- Other App Settings ---
    API_PREFIX = '/api/'