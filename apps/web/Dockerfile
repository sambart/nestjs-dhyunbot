FROM node:20-alpine

# Shared entrypoint (handles npm install + shared lib build)
COPY scripts/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /workspace/apps/web

EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]
