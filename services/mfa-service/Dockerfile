# LIBERTA หัวหิน — mfa-service
# Multi-stage build: compile TypeScript in a full node image, run on a slim runtime as non-root.

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

RUN addgroup -S liberta && adduser -S liberta -G liberta
USER liberta

EXPOSE 3002
CMD ["node", "dist/main.js"]
