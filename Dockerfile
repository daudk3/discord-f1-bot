FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

RUN npm run build

# ─── Runtime image ────────────────────────────────────────────

FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Fix @f1api/sdk packaging bug (exports references index.cjs but file is index.js)
RUN ln -sf index.js node_modules/@f1api/sdk/dist/index.cjs

COPY --from=builder /app/dist ./dist

# Persist bot state outside the container via a volume
VOLUME ["/app/data"]

CMD ["node", "dist/src/index.js"]
