# Backend Dockerfile for Choreo
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for database drivers and media processing
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    unixodbc-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories for uploads
RUN mkdir -p uploads mobile_uploads static/uploads instance logs
RUN mkdir -p /tmp/uploads /tmp/mobile_uploads

# Set environment variables for Choreo
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV PYTHONPATH=/app
ENV LOG_TO_STDOUT=true

# Create a non-root user for security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app && \
    chown -R appuser:appuser /tmp/uploads /tmp/mobile_uploads

# Switch to non-root user
USER appuser

# Expose port 8080 (Choreo requirement)
EXPOSE 8080

# Health check for Choreo
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8080/health')" || exit 1

# Run the application
CMD ["python", "app.py"]