# backend/Dockerfile
# Production-ready Flask application with Choreo security compliance

FROM python:3.11-slim

# Set environment variables for Python optimization and Flask configuration
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV LOG_TO_STDOUT=true
ENV PORT=5000
ENV PYTHONPATH=/app

# Install system dependencies and security updates
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get autoremove -y

# Create application directory
WORKDIR /app

# Create non-root user for security compliance (Choreo requirement CKV_CHOREO_1)
# UID must be between 10000-20000 for Choreo security policies
RUN groupadd -r appgroup && \
    useradd -r -g appgroup -u 10001 appuser

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip==23.3.1 && \
    pip install --no-cache-dir -r requirements.txt

# Install Gunicorn for production WSGI server
RUN pip install --no-cache-dir gunicorn==21.2.0

# Copy application code
COPY . .

# Create necessary directories for application runtime with proper permissions
RUN mkdir -p /tmp/uploads /tmp/mobile_uploads /tmp/uploads/audio logs && \
    chown -R appuser:appgroup /app /tmp/uploads /tmp/mobile_uploads /tmp/uploads/audio logs && \
    chmod -R 755 /app /tmp/uploads /tmp/mobile_uploads /tmp/uploads/audio logs

# Switch to non-root user (CRITICAL FOR CHOREO SECURITY COMPLIANCE)
# This fixes the CKV_CHOREO_1 security check
USER 10001

# Expose the port that the app runs on
EXPOSE 5000

# Add health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Use Gunicorn as the production WSGI server
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--worker-class", "sync", "--worker-connections", "1000", "--max-requests", "1000", "--max-requests-jitter", "100", "--timeout", "30", "--keep-alive", "5", "--access-logfile", "-", "--error-logfile", "-", "--log-level", "info", "--capture-output", "--enable-stdio-inheritance", "--preload", "app:app"]

# Metadata labels for better container management
LABEL maintainer="Scott Overhead Doors"
LABEL version="1.0.0"
LABEL description="Flask backend API for Scott Overhead Doors management system"
LABEL security.non-root="true"
LABEL security.uid="10001"