# Dockerfile (Updated for your existing nginx.conf)
FROM node:18-alpine as build
# Set working directory
WORKDIR /app
# Copy package files
COPY package*.json ./
# Install dependencies
RUN npm install
# Copy source code
COPY . .
# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine
# Copy built app to nginx
COPY --from=build /app/build /usr/share/nginx/html
# Copy your existing nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create nginx user and set permissions for non-root operation
RUN addgroup -g 10014 appgroup && \
    adduser -u 10014 -G appgroup -s /bin/sh -D appuser && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    chown -R appuser:appgroup /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid && \
    chown -R appuser:appgroup /usr/share/nginx/html

# Switch to non-root user
USER appuser

# Expose port 8080 (matches your nginx config)
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]