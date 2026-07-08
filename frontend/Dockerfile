# LIBERTA หัวหิน — frontend
# Multi-stage build with two independently usable targets:
#   - `dev`        : runs the Vite dev server (used by docker-compose.yml)
#   - `production` : Nginx serving the static build output (used by docker-compose.prod.yml)

# ---- base: shared dependency install layer ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---- dev: Vite dev server with HMR, reachable from other containers ----
FROM base AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---- build: compiles the production static assets ----
FROM base AS build
COPY . .
RUN npm run build

# ---- production: Nginx serving the static build ----
# nginx:alpine already runs its worker processes as the low-privilege `nginx`
# user out of the box (see /etc/nginx/nginx.conf `user nginx;`); only the
# master process stays root, which is required to bind to port 80. This is
# the image's own documented low-privilege approach — no extra USER directive
# is added here, since forcing a different non-root user would break the
# master process's ability to bind port 80.
FROM nginx:1.27-alpine AS production
COPY nginx.frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
