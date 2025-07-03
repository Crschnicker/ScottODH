#!/bin/bash

# Azure App Service startup script for Flask application
echo "Starting Scott Overhead Doors application..."

# Set Python path
export PYTHONPATH="${PYTHONPATH}:/home/site/wwwroot"

# Create necessary directories
mkdir -p /home/site/wwwroot/uploads
mkdir -p /home/site/wwwroot/mobile_uploads
mkdir -p /home/site/wwwroot/logs

# Set proper permissions
chmod 755 /home/site/wwwroot/uploads
chmod 755 /home/site/wwwroot/mobile_uploads

# Initialize database if needed
echo "Running database migrations..."
cd /home/site/wwwroot
python -m flask db upgrade || echo "Migration failed or not needed"

# Start the application with Gunicorn
echo "Starting Gunicorn server..."
gunicorn --bind=0.0.0.0:8000 \
         --workers=4 \
         --worker-class=sync \
         --timeout=120 \
         --max-requests=1000 \
         --max-requests-jitter=100 \
         --preload \
         --access-logfile=- \
         --error-logfile=- \
         app:app