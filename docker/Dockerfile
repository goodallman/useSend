# syntax=docker/dockerfile:1.7

FROM node:22-alpine3.20 AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"
ENV SKIP_ENV_VALIDATION="true"
ENV DOCKER_OUTPUT="1"
ENV NEXT_TELEMETRY_DISABLED="1"
ENV NEXT_PUBLIC_IS_CLOUD="false"

RUN corepack enable

FROM base AS prisma-cli

ARG PRISMA_VERSION=6.19.3
WORKDIR /prisma-cli

RUN npm install --omit=dev --no-audit --no-fund --no-package-lock \
    "prisma@${PRISMA_VERSION}"

FROM base AS builder

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web ./apps/web
COPY packages ./packages

RUN pnpm add --global turbo@2.5.2
RUN turbo prune web --docker

FROM base AS installer

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY .gitignore ./
COPY --from=builder /app/out/json/ ./
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

ARG APP_VERSION=unknown
ARG GIT_SHA=unknown

ENV NEXT_PUBLIC_APP_VERSION="$APP_VERSION"
ENV NEXT_PUBLIC_GIT_SHA="$GIT_SHA"

COPY --from=builder /app/out/full/ ./

RUN pnpm turbo run build --filter=web...

FROM base AS runner

RUN apk add --no-cache dumb-init \
    && addgroup -S -g 1001 nodejs \
    && adduser -S -u 1001 -G nodejs nextjs

WORKDIR /app

ENV NODE_ENV="production"
ENV PORT="3000"
ENV HOSTNAME="0.0.0.0"
ENV SKIP_ENV_VALIDATION="false"

COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

COPY --from=installer --chown=nextjs:nodejs /app/apps/web/prisma/schema.prisma ./apps/web/prisma/schema.prisma
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/prisma/migrations ./apps/web/prisma/migrations
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/node_modules/@prisma ./node_modules/@prisma
COPY --from=prisma-cli --chown=nextjs:nodejs /prisma-cli/node_modules ./node_modules
COPY --chown=nextjs:nodejs docker/start.sh ./start.sh
RUN sed -i 's/\r$//' ./start.sh && chmod 755 ./start.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=10 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "start.sh"]
