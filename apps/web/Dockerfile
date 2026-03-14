FROM node:20-alpine

# Install pnpm
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

# Shared entrypoint (handles pnpm install + shared lib build)
COPY scripts/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /workspace/apps/web

EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["pnpm", "run", "dev"]
