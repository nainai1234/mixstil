FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-bookworm-slim
WORKDIR /app
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml tsconfig.server.json ./
COPY server ./server
COPY data ./data
COPY docs ./docs
COPY public/content ./public/content
EXPOSE 8788
CMD ["pnpm", "dev:api"]
