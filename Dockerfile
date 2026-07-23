# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Native-module build toolchain (better-sqlite3 / bufferutil compile via node-gyp;
# node:22-alpine ships without a C/C++ toolchain, so npm ci would fail otherwise)
RUN apk add --no-cache python3 make g++

# Copy package files (include .npmrc for legacy-peer-deps) and the scripts folder,
# which the postinstall hook (fix-zod-resolution.cjs) needs at install time.
COPY package*.json .npmrc* ./
COPY scripts ./scripts

# Install dependencies (legacy-peer-deps: @openai/agents peers zod@^4 while other
# deps pin zod@^3; strict npm ci otherwise fails ERESOLVE)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Native-module build toolchain (production install recompiles better-sqlite3/bufferutil)
RUN apk add --no-cache python3 make g++

# Install only production dependencies (scripts/ needed for the postinstall hook)
COPY package*.json .npmrc* ./
COPY scripts ./scripts
RUN npm ci --only=production --legacy-peer-deps

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy necessary assets
COPY --from=builder /app/attached_assets ./attached_assets

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/index.js"]
