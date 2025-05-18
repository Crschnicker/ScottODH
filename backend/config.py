import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-for-scott-overhead-doors'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///scott_overhead_doors.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER') or 'uploads'
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000,https://scottohd.ngrok.io,http://scottohd.ngrok.io').split(',')