#!/bin/bash

echo "Deploying Scott Overhead Doors..."

# Stop existing containers
docker-compose down

# Build and start containers
docker-compose up -d

# Check container status
docker-compose ps

echo "Deployment complete!"
echo "Frontend: http://localhost"
echo "Backend API: http://localhost:5000"