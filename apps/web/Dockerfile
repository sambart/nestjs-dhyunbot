FROM node:20-alpine

WORKDIR /workspace

# Install dependencies for monorepo
# Copy root package.json first
COPY package*.json ./
COPY tsconfig.json ./

# Copy workspace package.json files
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
COPY libs/shared/package*.json ./libs/shared/

# Install all dependencies (monorepo)
RUN npm install

# Copy shared library
COPY libs/shared ./libs/shared

# Build shared library
RUN npm run build --workspace=@dhyunbot/shared || true

# Copy Web source
COPY apps/web ./apps/web

# Set working directory to Web
WORKDIR /workspace/apps/web

# Expose correct port (4000)
EXPOSE 4000

# Development mode
CMD ["npm", "run", "dev"]
