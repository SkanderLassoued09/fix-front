# Use Node 20 Alpine as base
FROM node:22.12.0-alpine


# Install Angular CLI globally
RUN npm install -g pnpm @angular/cli

# Set working directory inside container
WORKDIR /usr/src/app

# Copy package.json first for dependency installation (optional if project exists)
COPY package*.json ./

# Copy the rest of the Angular project
COPY . .
