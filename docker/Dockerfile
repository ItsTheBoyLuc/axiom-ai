# syntax=docker/dockerfile:1.7
# Multi-stage build with two runtime targets: `web` (Next.js standalone) and `worker` (BullMQ).
ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps: full install (dev deps needed for the build)
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

# ---- prod-deps: runtime-only node_modules for the worker
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts

# ---- builder: compile the Next.js app
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# --ignore-scripts skipped the postinstall hook, so generate the Prisma client explicitly.
# (prisma/generated is dockerignored: a stale host copy must never leak into the image.)
RUN npx prisma generate && npm run build

# ---- migrate: one-shot job that applies pending migrations (`prisma migrate deploy`).
# Also the place to run the seed: `docker compose run --rm migrate npm run db:seed`.
FROM builder AS migrate
ENV NODE_ENV=production
RUN chown -R node:node /app/prisma
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- web runtime (non-root)
FROM base AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health >/dev/null || exit 1
CMD ["node", "server.js"]

# ---- worker runtime (non-root)
FROM base AS worker
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --chown=app:app package.json tsconfig.json ./
COPY --chown=app:app worker ./worker
COPY --chown=app:app server ./server
COPY --chown=app:app src/lib ./src/lib
COPY --chown=app:app src/types ./src/types
# The sync jobs validate with the seed schemas and write through the Prisma client, which the
# builder generated (prisma/generated is dockerignored, so it only exists in the builder stage).
COPY --from=builder --chown=app:app /app/prisma ./prisma
USER app
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:${WORKER_HEALTH_PORT:-3001}/health >/dev/null || exit 1
CMD ["node_modules/.bin/tsx", "worker/index.ts"]
