# OVEREO website (Next.js) for your own server
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN rm -rf backend && npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S web && adduser -S web -G web
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER web
EXPOSE 3000
CMD ["node", "server.js"]
