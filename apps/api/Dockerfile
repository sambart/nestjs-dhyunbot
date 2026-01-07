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

# Copy API source
COPY apps/api ./apps/api

# Set working directory to API
WORKDIR /workspace/apps/api

# Install nodemon globally for development
RUN npm install -g nodemon ts-node

# Development mode with hot reload
CMD ["nodemon", "--watch", "src", "--watch", "../../libs/shared/src", "--ext", "ts,js,json", "--exec", "ts-node -r tsconfig-paths/register", "src/main.ts"]
