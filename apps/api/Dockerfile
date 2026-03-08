FROM node:20-alpine

# Global tools for API
RUN npm install -g ts-node

# Shared entrypoint (handles npm install + shared lib build)
COPY scripts/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /workspace/apps/api

ENTRYPOINT ["/entrypoint.sh"]
CMD ["ts-node", "-r", "tsconfig-paths/register", "src/main.ts"]
