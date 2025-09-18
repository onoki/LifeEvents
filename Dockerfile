# Multi-stage build for React app with Nginx
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY react-app/package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY react-app/ .

# Build the app
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine AS production

# Copy built app from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY react-app/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
