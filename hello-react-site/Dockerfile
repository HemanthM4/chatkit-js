# Build stage
FROM node:18-alpine AS build
WORKDIR /app

# Install dependencies (including dev deps for the build)
COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .
RUN npm run build

# Runtime stage
FROM node:18-alpine AS runtime
WORKDIR /app

# Copy built files and package.json for production deps
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Install only production dependencies (express)
RUN npm ci --production --no-audit --no-fund || true

ENV PORT 8080
EXPOSE 8080

COPY server.js ./server.js

CMD ["node", "server.js"]
