FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-bookworm-slim
WORKDIR /app
ARG AUDIO_BASELINE_RELEASE_URL=https://github.com/nainai1234/mixstil/releases/download/audio-baseline-v1
ARG AUDIO_BASELINE_SHA256=7436b97a41b373796a9ebaef33d739b523eaaa52b29572521daa808a42c1124c
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.server.json ./
COPY server ./server
COPY config ./config
COPY data ./data
COPY docs ./docs
COPY public/content ./public/content
RUN mkdir -p ./public /tmp/audio-baseline-parts && \
  for part in $(seq -w 0 124); do \
    curl --fail --location --retry 6 --retry-all-errors \
      --output "/tmp/audio-baseline-parts/$part" \
      "$AUDIO_BASELINE_RELEASE_URL/audio-baseline-v1.block-$part"; \
  done && \
  cat /tmp/audio-baseline-parts/* > /tmp/audio-baseline-v1.tar.gz && \
  echo "$AUDIO_BASELINE_SHA256  /tmp/audio-baseline-v1.tar.gz" | sha256sum --check - && \
  tar -xzf /tmp/audio-baseline-v1.tar.gz -C ./public && \
  mkdir -p ./public/audio/noise/internal && \
  curl --fail --location --retry 6 --retry-all-errors --output ./public/audio/noise/internal/brown_soft.mp3 "$AUDIO_BASELINE_RELEASE_URL/brown_soft.mp3" && \
  curl --fail --location --retry 6 --retry-all-errors --output ./public/audio/noise/internal/pink_balanced.mp3 "$AUDIO_BASELINE_RELEASE_URL/pink_balanced.mp3" && \
  test -s ./public/audio/content-baseline/batch-015/sleep_024_restless_mind_downshift.mp3 && \
  echo "95050e081f674aadbc862083309cb30e1aff2b7143520be95f2c956fb0c4a94e  ./public/audio/content-baseline/batch-015/sleep_024_restless_mind_downshift.mp3" | sha256sum --check - && \
  echo "4c2cdd5ec63796e424be3b5727fb7e1b7daec05a9d9717c41213a71a0331c855  ./public/audio/noise/internal/brown_soft.mp3" | sha256sum --check - && \
  echo "ec0eb208ba79da2048236057dc6e1b46c6f8ca4127eb1613144a888e3d79e2c7  ./public/audio/noise/internal/pink_balanced.mp3" | sha256sum --check - && \
  rm -rf /tmp/audio-baseline-parts /tmp/audio-baseline-v1.tar.gz
EXPOSE 8788
CMD ["node", "node_modules/tsx/dist/cli.mjs", "server/index.ts"]
