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
# If we have static .md data, copy it too (we will copy it as src/data/copa inside builder, so we need to copy it or it's built or loaded. Wait! Let's copy the data folder)
# We will copy src/data/copa to dist/data/copa or copy the raw src/data/copa folder to the final stage. Let's copy it to builder first and then copy it to the final image.
# We will design the TS project so it copies or we just load it from /app/dist/data/copa (or /app/src/data/copa). Let's make it load from /app/dist/data/copa or copy it to dist during build. Or simply copy src/data/ to the final image. Yes! Copying src/data to the final image or keeping it under dist.
# Let's make a copy step:
COPY src/data ./src/data

# Switch to non-root user
USER appuser

EXPOSE 3500

CMD ["node", "dist/index.js"]
