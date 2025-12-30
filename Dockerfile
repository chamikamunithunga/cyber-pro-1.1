# Use Node.js 18
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .npmrc ./

# Install dependencies with legacy peer deps
RUN npm install --legacy-peer-deps

# Copy all files
COPY . .

# Expose port
EXPOSE 5001

# Start server
CMD ["node", "server/index.js"]

