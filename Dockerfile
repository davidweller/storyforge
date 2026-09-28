# StoryForge — headless container image.
#
# Build on an x86_64 machine (the DS220+ is a Celeron J4025, same arch). Do NOT
# build on the NAS itself: `next build` needs more CPU and RAM than a J4025 with
# 6 GB comfortably has.
#
#   docker build -t storyforge:1.0 .
#   docker save storyforge:1.0 | gzip > storyforge-1.0.tar.gz
#
# Node 22 is inside better-sqlite3's supported range (20.x–26.x) and is a glibc
# base, so both native addons resolve their linux-x64 prebuilds. Keep the build
# and runtime stages on the SAME base image — a Node ABI mismatch between them is
# exactly the failure scripts/rebuild-better-sqlite3.cjs exists to paper over.

# ---------------------------------------------------------------------------
# deps — install and build native addons for linux/amd64
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# node-gyp fallback toolchain, used only if a prebuild is unavailable.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# package.json's postinstall is `electron-builder install-app-deps && node
# scripts/rebuild-better-sqlite3.cjs`. In a container the first would download a
# ~250 MB Electron dist for no reason, and the second hard-exits because npm
# only injects npm_execpath for lifecycle scripts it invokes itself. Skip all
# lifecycle scripts, then rebuild the two addons we actually need.
RUN npm ci --ignore-scripts
RUN npm rebuild better-sqlite3 sharp

# ---------------------------------------------------------------------------
# builder — produce .next/standalone
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# runner — minimal runtime
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# sqlite3 CLI is here for the nightly consistent-backup job (see
# docs/nas-deployment.md). ~1.5 MB.
RUN apt-get update && apt-get install -y --no-install-recommends \
      sqlite3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORYFORGE_DATA_DIR=/data

# HOSTNAME=0.0.0.0 is required. The standalone server binds narrowly by default,
# and electron/main.js pins it to 127.0.0.1 — inside a container that would make
# the port unreachable from the host.
#
# NODE_ENV=production is also required, not cosmetic: src/middleware.ts disables
# rate limiting outright when NODE_ENV is 'development'.

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy the native addons explicitly. Next's file tracing usually carries them
# into standalone, but it intermittently misses .node binaries for externalised
# packages — and a miss only shows up at runtime as /api/health/db returning 503.
# Overwriting what tracing already placed is harmless and removes the guesswork.
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=deps /app/node_modules/bindings ./node_modules/bindings
COPY --from=deps /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=deps /app/node_modules/sharp ./node_modules/sharp
COPY --from=deps /app/node_modules/detect-libc ./node_modules/detect-libc
COPY --from=deps /app/node_modules/semver ./node_modules/semver
# @img holds sharp's platform packages. npm's os/cpu gating means only the
# linux-x64 ones (@img/sharp-linux-x64, @img/sharp-libvips-linux-x64) plus the
# platform-neutral @img/colour are present after an install in this image.
COPY --from=deps /app/node_modules/@img ./node_modules/@img

# /data is the only writable path the app needs: storyforge.db plus its WAL,
# settings.json, and the generation-usage fallback ledger. It is a bind mount in
# production; creating it here keeps `docker run` without a volume from failing.
RUN mkdir -p /data/backup && chown -R node:node /data /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=60s --timeout=10s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/db').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
