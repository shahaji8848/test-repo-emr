FROM node:20-alpine
# Set working directory
WORKDIR /app
# Copy package.json and package-lock.json
COPY package*.json ./
# Install all dependencies
RUN npm install
# Copy rest of the app
COPY . .
# Expose the port your app listens on
EXPOSE 3000
# Start the app directly
CMD ["npm", "start"]
