FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

RUN npm run build && \
    # Fix @f1api/sdk packaging bug (exports references index.cjs but file is index.js)
    ln -sf index.js node_modules/@f1api/sdk/dist/index.cjs

# ─── Runtime image ────────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && \
    ln -sf index.js node_modules/@f1api/sdk/dist/index.cjs

COPY --from=builder /app/dist ./dist

# Persist bot state outside the container via a volume
VOLUME ["/app/data"]

CMD ["node", "dist/src/index.js"]
