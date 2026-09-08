# Docker

Container setup for the Boxing Defense Trainer web app.

This folder holds the nginx configuration that the runtime image ships with.
The Dockerfile itself lives next to the code it builds, in
[`apps/web/Dockerfile`](../apps/web/Dockerfile).

## What belongs here

Container configuration that is consumed by an image at build time and is not
specific to a single app — today that is `nginx.conf`, and later the equivalent
config for the api service.

Application code does not belong here, and neither does anything read at
runtime from the host: the image is self-contained by design, so nothing in
this folder is mounted into a running container.

## Build and run

From the repository's project root (the directory containing
`docker-compose.yml`):

```bash
docker compose build web
docker compose up web
```

Then open <http://localhost:8080>.

Port 8080 is a busy port on developer machines. If it is already taken:

```bash
WEB_PORT=8090 docker compose up web
```

To run it without Compose:

```bash
docker build --build-context config=./docker -t boxing-defense-trainer/web ./apps/web
docker run --rm -p 8080:8080 --read-only --tmpfs /tmp boxing-defense-trainer/web
```

The `--build-context` flag is not optional. The build context is `apps/web`, so
the Dockerfile cannot reach up into `docker/` on its own; the flag attaches this
folder as a second context named `config`. `docker-compose.yml` does the same
thing through `additional_contexts`, which is why the Compose commands need no
extra flags.

## Why multi-stage

The image is built in three stages, and only the last one is shipped:

| Stage | Base | Does |
| --- | --- | --- |
| `deps` | `node:22-alpine` | `npm ci` from the lockfile |
| `build` | `node:22-alpine` | `tsc -b && vite build` |
| `runtime` | `nginx:1.29-alpine` | serves `dist/` |

Two things fall out of this.

**The toolchain never ships.** A single-stage build would leave Node, npm and
~180 packages of `node_modules` in the running image — a few hundred MB of code
that is never executed in production but is very much part of the attack
surface, and that has to be patched and rescanned forever. The runtime stage
starts from a clean nginx image and copies in exactly one thing: `dist/`. The
result is 92.9 MB as reported by `docker image ls`, of which the app's own build
output is 222 KB. Everything else is the nginx base image.

**Dependency installs are cached.** `deps` copies `package.json` and
`package-lock.json` *before* the source, so the `npm ci` layer is keyed only on
those two files. Editing a component re-runs the ~10 s build and reuses the
install; changing a dependency is what invalidates it. Copying the source first
would reinstall everything on every commit.

`npm ci` rather than `npm install`, because it installs the locked tree exactly
and fails when `package-lock.json` and `package.json` have drifted, instead of
silently resolving new versions inside a build nobody is watching. It needs the
lockfile to be committed — see the note in the root `.gitignore`.

## Why non-root

The runtime stage ends with `USER nginx` (uid 101), so nginx never runs as root.
Serving static files needs no privileges at all, and dropping them means a
compromise of the web server is confined to a process that cannot write to the
image, install anything, or bind a privileged port.

Three things follow from that, and they are why `nginx.conf` is a full config
rather than a `conf.d` drop-in:

- **Port 8080, not 80.** Unprivileged processes cannot bind below 1024. The
  container port is 8080; map it to whatever you like on the host.
- **The pid file and scratch paths move to `/tmp`.** They default to
  root-owned locations under `/var`, which a non-root nginx cannot write.
- **No `user` directive.** It is only meaningful when the master process starts
  as root; setting it here would emit a warning that nginx then ignores.

`docker-compose.yml` takes it further, since a static-file server has no reason
to write anywhere: `read_only: true` mounts the whole root filesystem read-only,
a `tmpfs` covers the `/tmp` paths above, and `no-new-privileges` stops any
process in the container from gaining privileges through setuid binaries.

## What nginx.conf does

- **SPA fallback.** `try_files $uri $uri/ /index.html` — client-side routes are
  not files on disk, so a deep link like `/session/3` has to be answered with
  the app shell rather than a 404. Requests under `/assets/` deliberately do
  *not* fall back; a missing bundle should 404 loudly, not return HTML with a
  JavaScript content type.
- **Cache headers.** Vite fingerprints everything under `/assets/`, so those are
  `immutable` for a year. `index.html` is `no-cache`, because it is the file
  that names the fingerprinted bundles — cache it and clients pin themselves to
  an asset graph that no longer exists. Unfingerprinted files from `public/`
  sit in between at a day.
- **Security headers.** `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
  Note that nginx does not inherit `add_header` into a location that sets its
  own, which is why they are repeated per location — deleting a copy silently
  drops the header for that route.
- **gzip** for text-like responses, and `server_tokens off` so responses do not
  advertise the nginx version.

## Adding the api service later

The MVP has no backend, deliberately — see
[ADR 0001](../docs/adr/0001-no-backend-for-mvp.md). `docker-compose.yml`
therefore has one service, and `web` depends on nothing.

When that changes:

1. Add a `Dockerfile` to `services/api`, following the same three-stage shape.
   A Node service needs a runtime stage too, so instead of an nginx stage the
   third stage is a slim `node:22-alpine` that copies in the build output and a
   production-only `node_modules` (`npm ci --omit=dev`), and ends with a
   non-root `USER`.
2. Uncomment the `api` block at the bottom of `docker-compose.yml` and adjust
   the port and health endpoint to match what the service actually exposes.
3. Add the `depends_on` block that is commented in alongside it, so Compose
   starts `api` first and waits for it to report healthy rather than merely to
   have started.
4. Give the browser a way to reach the api. Serving both behind one origin
   avoids CORS entirely: add a `location /api/ { proxy_pass http://api:3000/; }`
   to `nginx.conf` — `api` resolves over the Compose network — rather than
   baking an absolute backend URL into the bundle at build time.
5. Extend `.github/workflows/docker-build.yml` with a matching job, or turn the
   existing one into a matrix over the two images.

## CI

[`.github/workflows/docker-build.yml`](../../.github/workflows/docker-build.yml)
builds this image on every push and pull request that touches the app, the
Docker config, or the workflow itself. It does not push anywhere yet; the point
is to catch a Dockerfile that has stopped building.

It also starts the image and asserts the things a build alone cannot: that the
container comes up as a non-root user, that a deep link falls back to
`index.html`, and that the security headers are actually present. A build can
succeed and still produce an image that dies on startup.

Note that the workflow lives at the **repository** root, one level above this
project, because that is the only place GitHub reads workflows from.

When the image does need publishing, add a registry login and set `push: true`
on the existing `docker/build-push-action` step, tagged from the commit SHA.
