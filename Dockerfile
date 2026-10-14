# Dahlia (Megura) Discord bot. See the "Running with Docker" section of README.md.
FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# install dependencies first so code changes don't invalidate this layer
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# the bot only writes log files; everything else stays read-only for the app user
RUN mkdir -p logs && chown node:node logs
USER node

# healthy while the bot is connected to Discord: functions/health.js refreshes
# this file every 30s. scripts/update.sh waits for "healthy" before an update counts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
	CMD find /tmp/megura-alive -mmin -2 | grep -q .

# config.json and assets/features.json are mounted at runtime, never baked into the image
CMD ["node", "index.js"]
