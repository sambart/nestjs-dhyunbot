FROM node:20-alpine

# Install pnpm and global tools
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate \
    && pnpm add -g ts-node

# Shared entrypoint (handles pnpm install + shared lib build)
COPY scripts/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /workspace/apps/bot

ENTRYPOINT ["/entrypoint.sh"]
CMD ["ts-node", "-r", "tsconfig-paths/register", "src/main.ts"]
