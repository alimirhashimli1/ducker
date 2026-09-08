# syntax=docker/dockerfile:1

# Boxing Defense Trainer — web image.
#
# Three stages so the published image holds only the compiled bundle: no
# toolchain, no node_modules, no sources. See docker/README.md for the
# reasoning and for how to add the api service later.

# -----------------------------------------------------------------------------
# Stage 1 — deps: resolve node_modules from the lockfile alone.
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Manifests only, copied before the source: this layer is then reused by every
# build that does not change a dependency, which is most of them.
COPY package.json package-lock.json ./

# `npm ci` (not `install`) so the build is reproducible and fails loudly when
# the lockfile and package.json disagree.
RUN --mount=type=cache,target=/root/.npm npm ci

# -----------------------------------------------------------------------------
# Stage 2 — build: typecheck and bundle with Vite.
# -----------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `npm run build` is `tsc -b && vite build`, so a type error fails the image
# rather than shipping a bundle nobody typechecked.
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3 — runtime: serve dist/ from nginx as an unprivileged user.
# -----------------------------------------------------------------------------
FROM nginx:1.29-alpine AS runtime

# The full server config, not a conf.d drop-in: gzip is an http-level directive,
# and the pid/scratch paths it sets are what let nginx run as a non-root user.
# `config` is a named build context (see docker-compose.yml) so that
# docker/nginx.conf can live outside apps/web while apps/web stays the main
# context — which is what keeps apps/web/.dockerignore in effect.
COPY --from=config nginx.conf /etc/nginx/nginx.conf

# The stock vhost is unreachable once nginx.conf above stops including conf.d.
# Removing it keeps the image from carrying a config that looks live and isn't.
RUN rm -f /etc/nginx/conf.d/default.conf

# The only thing carried over from the build: the static output.
COPY --from=build /app/dist /usr/share/nginx/html

# `nginx` (uid 101) already exists in the base image. Running as a non-root user
# means a bug in nginx or a malicious asset cannot write to the image or bind a
# privileged port.
USER nginx

# Above 1024, because an unprivileged process cannot bind below it.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
