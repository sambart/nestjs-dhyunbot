# Base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json yarn.lock ./
RUN yarn install

# Copy application code
COPY . .

# Build the application
RUN yarn build

# Expose the application port
EXPOSE 3000

# Command to start the application
CMD ["yarn", "start:prod"]
