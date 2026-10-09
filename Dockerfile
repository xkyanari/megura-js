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

# config.json and assets/features.json are mounted at runtime, never baked into the image
CMD ["node", "index.js"]
