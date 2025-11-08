# Use Playwright’s official base image (includes Chromium + deps)
FROM mcr.microsoft.com/playwright:v1.48.2-jammy

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of your source code
COPY . .

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
