# ---- Build Stage ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# ---- Production Stage ----
FROM node:22-alpine
WORKDIR /app

# Security: create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Switch to non-root user
USER appuser

# No port exposed (no health check endpoint)
CMD ["node", "dist/index.js"]
