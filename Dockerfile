# Stage 1: Build Mobile Frontend (AMD64)
FROM --platform=linux/amd64 node:20-alpine AS mobile-builder-amd64
WORKDIR /app
COPY mobile ./mobile
RUN cd mobile && npm install && npm run build

# Stage 1b: Build Mobile Frontend (ARM64)
FROM --platform=linux/arm64 node:20-alpine AS mobile-builder-arm64
WORKDIR /app
COPY mobile ./mobile
RUN cd mobile && npm install && npm run build

# Stage 2: Setup Combined App (AMD64)
FROM --platform=linux/amd64 node:20-alpine AS base-amd64
WORKDIR /app

# Install Nginx
RUN apk add --no-cache nginx

# Copy API and install dependencies
COPY KuGouMusicApi ./KuGouMusicApi
RUN cd KuGouMusicApi && npm install --production

# Copy built mobile frontend static assets from the mobile builder stage
COPY --from=mobile-builder-amd64 /app/mobile/dist/ ./mobile-dist/

# Copy startup script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose ports
# For mobile frontend served by Nginx
EXPOSE 8880
# For API
EXPOSE 6521 

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Set environment variables
ENV PORT=6521
ENV HOST=0.0.0.0

# Use entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Stage 2b: Setup Combined App (ARM64)
FROM --platform=linux/arm64 node:20-alpine AS base-arm64
WORKDIR /app

# Install Nginx
RUN apk add --no-cache nginx

# Copy API and install dependencies
COPY KuGouMusicApi ./KuGouMusicApi
RUN cd KuGouMusicApi && npm install --production

# Copy built mobile frontend static assets from the mobile builder stage
COPY --from=mobile-builder-arm64 /app/mobile/dist/ ./mobile-dist/

# Copy startup script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose ports
# For mobile frontend served by Nginx
EXPOSE 8880
# For API
EXPOSE 6521 

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Set environment variables
ENV PORT=6521
ENV HOST=0.0.0.0

# Use entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
