# OVEREO backend — small, non-root image
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY tsconfig.json ./
COPY src ./src
COPY test ./test
RUN npx tsc -p tsconfig.json && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S overeo && adduser -S overeo -G overeo && mkdir -p /var/lib/overeo/files && chown -R overeo:overeo /var/lib/overeo
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY package.json ./
USER overeo
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:4000/v1/health || exit 1
CMD ["node", "dist/src/server.js"]
