FROM python:3.10-slim

# Create non-root user first (required for security compliance)
RUN groupadd -r appgroup && useradd -r -g appgroup -u 10014 appuser

# Set working directory
WORKDIR /app

# Install system dependencies as root
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    ffmpeg \
    libsqlite3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies as root
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p uploads instance static logs && \
    chown -R appuser:appgroup /app && \
    chmod -R 755 /app

# Set environment variables
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Switch to non-root user (REQUIRED for security compliance)
USER 10014

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["python", "app.py"]