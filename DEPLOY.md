# Deployment

Target: a **Proxmox VM** running both compose stacks, with **Cloudflare Zero Trust** (a `cloudflared` tunnel) as the only way in. Nothing is published beyond loopback — there is no reverse proxy to configure, no port forward on the router, and no certificate to renew.

The repo carries what this needs: a `docker-compose.prod.yml` in each half, a build arg for the SPA's API address, gunicorn and WhiteNoise on the backend. [§2](#2-what-was-changed-to-make-this-possible) is what those are for — read it before changing any of them, because each guards against a failure that is invisible until it happens.

What is *not* in the repo is any secret, and any hostname. Both come from a `.env` per half; see [§6](#6-production-environment).

---

## 1. The VM

A **VM, not an LXC container.** Docker in an unprivileged LXC needs `nesting=1` plus `keyctl=1` and still hits overlayfs edge cases; Postgres, RustFS and two image builds are not where you want to discover them.

| | |
| --- | --- |
| Guest | Debian 13 |
| vCPU / RAM | 2 / 4 GB |
| Disk | 32 GB (both named volumes live here — see [§7](#7-backups)) |
| Installed | Docker Engine + the Compose v2 plugin, `cloudflared` |

Snapshot the VM once Docker is installed and the repo is cloned, before the stack first starts. That snapshot is the cheap way back from a bad first run.

---

## 2. What was changed to make this possible

Four things stood between the repo and a production deploy. All four are now in place; this section is what they were and why, because each one is invisible until it bites.

### a. `VITE_API_BASE_URL` is baked in at build time

Vite resolves `import.meta.env.VITE_API_BASE_URL` when the bundle is **built**, not when it is served, and `ziantsabit-fe/Dockerfile` ran a bare `npm run build`. The production image therefore shipped pointing at `http://localhost:8000/api`, with no runtime setting able to fix it.

The build stage now takes it as an argument:

```dockerfile
ARG VITE_API_BASE_URL=http://localhost:8000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
```

The default keeps a plain `docker build .` producing the image it always did. `ziantsabit-fe/docker-compose.prod.yml` supplies the real value through `build.args`, read from a `.env` beside it. It belongs in a file rather than on the command line because **`docker compose up --build` has no `--build-arg` flag** — only `docker compose build` does, so a value typed at the prompt would be silently dropped by the more natural command.

Changing the API address is a **rebuild**, not a restart.

### b. `runserver` is a development server

The image's `CMD` was `manage.py runserver`: single-threaded, and it refuses to serve static files with `DEBUG=0`. `gunicorn` is now in `requirements.txt`, and `docker-compose.prod.yml` overrides the command:

```yaml
command: [gunicorn, ziantsabit_be.wsgi:application, --bind, "0.0.0.0:8000", --workers, "3", --access-logfile, "-"]
```

`entrypoint.sh` is the `ENTRYPOINT`, so migrations still run first regardless.

### c. `DEBUG=0` left Django admin unstyled

There was no `STATIC_ROOT`, no `collectstatic` and nothing serving `/static/` — with `DEBUG=1` the dev server does it, and with `DEBUG=0` nothing does. `api.ziantsabit.com/admin/` would have rendered as bare HTML, and there is no nginx in front of the API to fill the gap; the tunnel is the only thing there.

WhiteNoise now serves those files from the app process:

- `whitenoise.middleware.WhiteNoiseMiddleware` sits directly below `SecurityMiddleware`, so a static file is answered without running sessions, auth or CSRF over it.
- `STATIC_ROOT` reads `DJANGO_STATIC_ROOT`, which the image sets to **`/srv/static`** — deliberately outside `/app`, because the dev compose file bind-mounts the source tree over `/app` and would shadow a collected directory built into the image.
- `entrypoint.sh` runs `collectstatic --noinput --clear` on every start, right after `migrate`.
- The `staticfiles` entry in `STORAGES` is WhiteNoise's `CompressedManifestStaticFilesStorage` **only when `DEBUG` is off**. Manifest storage cannot resolve a `{% static %}` tag until `collectstatic` has run, and a bare `manage.py runserver` or `manage.py test` outside Docker never runs it — so development keeps the plain backend and unhashed filenames.

### d. Loopback ports, and no source mount

`cloudflared` runs on the same host and connects over loopback, so nothing needs a port on `0.0.0.0`. The `db` service already did this correctly and explains why in a comment; the production override now does the same for the rest:

| Service | Development | Production |
| --- | --- | --- |
| `api` | `8000:8000` | `127.0.0.1:8000:8000` |
| `rustfs` (S3) | `9000:9000` | `127.0.0.1:9000:9000` |
| `rustfs` (console) | `9001:9001` | `127.0.0.1:9001:9001` |
| `frontend` | `8080:80` | `127.0.0.1:8080:80` |
| `db` | already loopback | unchanged |

The override also drops the `api` service's `- .:/app` mount, which exists for `runserver`'s autoreload and in production would shadow the code baked into the image with whatever happens to be checked out on the VM.

Both of those need Compose's merge tags, and this is the easy thing to get wrong: **`ports` is merged by *appending*, not replacing.** Without `!override` the production file's `127.0.0.1:8000:8000` is added alongside the base file's `8000:8000` and the second binding fails with *port is already allocated*. Removing the volume likewise needs `volumes: !reset []`, since there is no other way to subtract a list entry.

### One test change came with it

`myapp/tests.py` had two CORS tests hardcoding `http://localhost:5173` and relying on `settings.py`'s default `CORS_ALLOWED_ORIGINS`. Every deployment must set that variable to its real site origin, so the suite failed inside exactly the container it was meant to validate. Those tests now pin the setting with `@override_settings`, asserting the behaviour instead of the environment. All 50 pass under both configurations.

---

## 3. Hostnames

Three, all proxied through the one tunnel:

| Hostname | Tunnel target | Why it has to be public |
| --- | --- | --- |
| `ziantsabit.com` (+ `www`) | `127.0.0.1:8080` | the SPA |
| `api.ziantsabit.com` | `127.0.0.1:8000` | the browser fetches the API cross-origin |
| `media.ziantsabit.com` | `127.0.0.1:9000` | **every `<img>` loads directly from RustFS** |

The third is the one that gets missed. `AWS_S3_PUBLIC_ENDPOINT_URL` is derived into `AWS_S3_CUSTOM_DOMAIN`, which is written into the stored URL of every upload:

```
https://media.ziantsabit.com/ziantsabit-media/uploads/2026/08/<slug>-<hex>.jpg
```

**Choose this hostname before the first production upload.** Those URLs live in `myapp_post` rows and in Markdown bodies; changing the host later 404s every image already published, with nothing to rewrite them from — the same failure the MinIO → RustFS volume switch produced locally.

Keeping the API on a *subdomain* of the site (rather than a separate domain) is also what lets the admin session cookie work — see [§6](#6-production-environment).

---

## 4. The tunnel

Run `cloudflared` as a **systemd service on the VM**, not as a compose service: it has to reach both compose projects, which are on separate Docker networks, and loopback is the simplest thing that reaches both.

```yaml
# /etc/cloudflared/config.yml
tunnel: <tunnel-uuid>
credentials-file: /etc/cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: ziantsabit.com
    service: http://127.0.0.1:8080
  - hostname: www.ziantsabit.com
    service: http://127.0.0.1:8080
  - hostname: api.ziantsabit.com
    service: http://127.0.0.1:8000
  - hostname: media.ziantsabit.com
    service: http://127.0.0.1:9000
  # Everything else is refused rather than falling through to some service.
  - service: http_status:404
```

```bash
cloudflared tunnel create ziantsabit
cloudflared tunnel route dns ziantsabit ziantsabit.com
cloudflared tunnel route dns ziantsabit www.ziantsabit.com
cloudflared tunnel route dns ziantsabit api.ziantsabit.com
cloudflared tunnel route dns ziantsabit media.ziantsabit.com
cloudflared service install
```

Note `:9001`, the RustFS console, is deliberately absent. Reach it over an SSH port-forward when you need to look at the bucket.

---

## 5. Access policies

> **Do not put an Access policy in front of `api.ziantsabit.com` as a whole.**
>
> Access answers an unauthenticated request with a 302 to its login page. The SPA's `fetch` sees a cross-origin redirect carrying no CORS headers and reports `Failed to fetch`, which `src/services/posts.ts` surfaces as *"Could not reach the API. Is the backend running?"* — on every public page, for every visitor. The site would look completely broken while the API was in fact healthy.

Scope the policies to paths instead:

| Application | Policy |
| --- | --- |
| `ziantsabit.com/admin*` | Allow — your email only. This is the SPA admin console; it is a document navigation, so the Access login page works normally. |
| `api.ziantsabit.com/admin*` | Allow — your email only. Django admin. Skip this if you took option (c)-*drop Django admin* above. |
| `api.ziantsabit.com/api/*` | **No policy.** Open. |
| `media.ziantsabit.com` | **No policy.** Images must load for logged-out visitors. |

Leaving `/api/*` open is the intended design, not a concession: `PostViewSet` is `IsAuthenticatedOrReadOnly`, and `get_queryset` filters drafts for anonymous callers on *every* route, not just the list — so an anonymous reader cannot reach an unpublished post even by guessing its slug. Writes still need a Django session or basic auth.

For `media.ziantsabit.com`, add a **WAF rule blocking anything that is not `GET` or `HEAD`**. The bucket policy grants `s3:GetObject` and deliberately not `s3:ListBucket`, so the exposure is one object per known URL and the bucket cannot be enumerated; the WAF rule just keeps the S3 write API from being probed at all.

---

## 6. Production environment

`docker-compose.prod.yml` already sets everything that differs from development. What it does **not** contain is a single secret — those are interpolated from a `.env` beside it, which Compose reads automatically and which is gitignored. Each one is written `${VAR:?message}`, so a missing value stops the deploy with a readable error instead of quietly shipping a development default.

Two `.env` files, one per half:

```ini
# ziantsabit-be/.env
POSTGRES_PASSWORD=<real password>
RUSTFS_ACCESS_KEY=<not rustfsadmin>
RUSTFS_SECRET_KEY=<not rustfsadmin>
DJANGO_SECRET_KEY=<50+ random characters, not the checked-in default>
DJANGO_ALLOWED_HOSTS=api.ziantsabit.com
SITE_ORIGINS=https://ziantsabit.com https://www.ziantsabit.com
MEDIA_ORIGIN=https://media.ziantsabit.com
```

```ini
# ziantsabit-fe/.env
VITE_API_BASE_URL=https://api.ziantsabit.com/api
```

`SITE_ORIGINS` fills both `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`, because the SPA allowed to read the API is the one that has to write to it. `MEDIA_ORIGIN` becomes `AWS_S3_PUBLIC_ENDPOINT_URL`; `AWS_S3_ENDPOINT_URL` stays `http://rustfs:9000`, the compose-network name, and is not something a deployment changes.

The override also turns on what HTTPS makes possible:

- `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` — the tunnel serves the site over TLS, so both cookies can carry `Secure`.
- `SESSION_COOKIE_SAMESITE` / `CSRF_COOKIE_SAMESITE` stay at `Lax`. `ziantsabit.com` and `api.ziantsabit.com` share a registrable domain, so a request from the SPA to the API is cross-*origin* but not cross-*site*, and the admin's session cookie is sent. Putting the API on a different domain would force `SameSite=None` and change all four of these together.
- `USE_X_FORWARDED_PROTO` — `settings.py` sets `SECURE_PROXY_SSL_HEADER` only when this flag is on. `cloudflared` terminates TLS and forwards plain HTTP, so without it Django reports every request as insecure. It is a flag rather than an unconditional setting because trusting a header the client can also send is only safe when nothing can reach the process directly — true behind the tunnel, false for a local `runserver` on `:8000`.

---

## 7. First run, and after

Write both `.env` files from [§6](#6-production-environment) first — Compose refuses to start without them. Then, from each half's own directory:

```bash
cd ziantsabit-be
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec api python manage.py createsuperuser    # a fresh DB has no user

cd ../ziantsabit-fe
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Note the `-f docker-compose.yml -f docker-compose.prod.yml` pair is required *every* time, including `exec`, `logs` and `down`. A bare `docker compose up -d` in either directory redeploys the **development** configuration over the top of the running one — `DEBUG=1`, `runserver`, ports on `0.0.0.0`, a bundle pointing at localhost. Setting `COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml` in the shell profile on the VM removes the chance to forget.

On a healthy first run, `storage-init` creates the bucket, applies the public-read policy, exits 0 and stays exited. That is not a crash — `api` waits on it with `service_completed_successfully`. The `api` container then logs `migrate`, `collectstatic` (`… static files copied to '/srv/static'`) and gunicorn's `Booting worker`, in that order.

### Backups

A Proxmox snapshot of a *running* VM is not a consistent Postgres backup. Add a cron job on the VM:

- `pg_dump` from the `db` service to a file, rotated. (With [§8](#8-an-external-postgres) this job belongs on the database host instead.)
- A copy of the `rustfs_data` volume. Deleting a post deliberately does **not** delete its images, so this only ever grows — but it is real, unreproducible state. Losing it 404s every image on the site.

### Updating

`git pull`, then `up -d --build` in whichever half changed. The two stacks are independent; a frontend deploy never touches the database. `entrypoint.sh` applies migrations on every `api` start, so a schema change needs no separate step.

---

## 8. An external Postgres

If Proxmox already runs a Postgres you would rather use, `ziantsabit-be/docker-compose.external-db.yml` replaces the bundled `db` service with it. Layer it last:

```bash
docker compose -f docker-compose.yml \
               -f docker-compose.prod.yml \
               -f docker-compose.external-db.yml up -d --build
```

`docker compose config --services` then returns `rustfs`, `storage-init`, `api` — no `db`. A service cannot be *deleted* by an override, so it is hidden behind a `local-db` profile instead, which doubles as an escape hatch: `--profile local-db` brings the bundled database back without editing anything.

`.env` gains the address, and whatever else differs from the defaults:

```ini
POSTGRES_HOST=10.0.0.50
# POSTGRES_PORT=5432
# POSTGRES_DB=zian_tsabit_be
# POSTGRES_USER=zian_tsabit_be
POSTGRES_PASSWORD=<the role's password>
```

**Run `docker compose down` before switching.** A `db` container started by an earlier invocation keeps running — a profile stops Compose from *starting* a service, not from leaving one up — and you would have a database nothing is talking to, quietly holding port 5432.

### On the database host

```sql
CREATE ROLE zian_tsabit_be LOGIN PASSWORD '…';
CREATE DATABASE zian_tsabit_be OWNER zian_tsabit_be;
ALTER ROLE zian_tsabit_be CREATEDB;   -- only if you want `manage.py test` to run against it
```

That last grant is not optional if you plan to run the suite there: it builds and drops a `test_zian_tsabit_be` database, and without `CREATEDB` every run dies at setup.

Then make the server actually reachable:

- `listen_addresses = '*'` in `postgresql.conf`. A stock Debian install listens on localhost only.
- A `pg_hba.conf` line for the **app VM's** address with `scram-sha-256`. Note the source address Postgres sees is the Docker host's, not the container's — bridge networking masquerades — so authorise the VM, not `172.16.0.0/12`.

### TLS

The connection now crosses a network, so `POSTGRES_SSLMODE` defaults to **`require`** in this override rather than to libpq's own `prefer`. That default is the point: `prefer` negotiates TLS when the server offers it and silently falls back to plaintext when it does not, so it is a setting that cannot fail — and therefore one that protects nothing.

`require` encrypts but does not check *who* answered. To authenticate the server as well, raise it to `verify-full` and give it the CA:

```ini
POSTGRES_SSLMODE=verify-full
POSTGRES_SSLROOTCERT=/etc/ssl/postgres-ca.crt
```

That path is inside the container, so the file has to be mounted in — `docker-compose.external-db.yml` carries the volume line, commented out, ready to uncomment. `POSTGRES_HOST` must then match the server certificate's CN or a SAN, which usually means using the hostname rather than the IP.

Both settings feed `DATABASES['default']['OPTIONS']` in `settings.py`, and each is only added when its variable is non-empty — so the local and bundled-`db` setups connect exactly as they always have.

### Verified

This path was exercised end to end against a TLS-enabled Postgres outside the compose file, not just reasoned about:

- `sslmode=require` — migrations applied, `/api/` 200, and the server logged `connection authorized: … SSL enabled (protocol=TLSv1.3, cipher=TLS_AES_256_GCM_SHA384)`.
- `verify-full` with the correct CA mounted — connected.
- `verify-full` with a *wrong* CA — refused with `SSL error: certificate verify failed`, which is what proves the option is threaded through rather than ignored.

### What you give up

`depends_on: db: condition: service_healthy` was what kept `entrypoint.sh`'s `migrate` from racing Postgres's own startup, and across separate guests there is no health check to wait on. The override replaces that dependency with `!override` rather than pointing it somewhere new, so after a host reboot the API can reach a database that is still booting: `migrate` fails, the container exits, and `restart: unless-stopped` brings it back until it connects. Recovery is automatic; the log is just untidy. Set the guest start order in Proxmox — database first — if you would rather it were clean.
