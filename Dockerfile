# Base image
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy application code
COPY . .

# Build the application
#RUN yarn build

# Expose the application port
EXPOSE 3000

# Command to start the application
#CMD ["ts-node-dev", "--respawn", "--transpileOnly", "src/main.ts"]

CMD ["npm", "run", "start"]