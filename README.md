# ziantsabit.com

My portfolio website — a React SPA plus a Django content API.

The two halves are independent projects that happen to share a repo. Each has its own `Dockerfile` and `docker-compose.yml`, and there is **no root-level build, package manager or compose file** tying them together: you run and build them separately, from their own directories.

```
ziantsabit-fe/        React 19 + TypeScript + Vite  (the live site)
ziantsabit-be/        Django + DRF                  (posts API)
```

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | **20.19+ or 22.12+** | Required by Vite 7. On Node 18, `npm run build` still passes but `npm run dev` fails with `TypeError: crypto.hash is not a function`. |
| Python | 3.10+ | The container image uses 3.12. |
| PostgreSQL | 16+ | Required for the backend even outside Docker — there is no sqlite fallback. `docker compose up` starts one for you; running the backend bare needs your own. |
| Docker | Compose v2 | Optional — only for the containerised runs below. |

---

## Frontend

All commands run from `ziantsabit-fe/`.

```bash
cd ziantsabit-fe
npm install
npm run dev
```

The dev server prints its URL, normally <http://localhost:5173>. Hot reload is on, and client-side routes (`/about`, `/books`, …) work directly.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | `tsc -b` then `vite build` → output in `dist/` |
| `npm run preview` | Serves the built `dist/` locally |
| `npm run lint` | ESLint over the project |

### Building

```bash
npm run build
```

`build` type-checks before it bundles, under `strict`, `noUnusedLocals` and `noUnusedParameters`. **An unused import that `npm run dev` happily ignores will fail the build**, so run this before considering a change finished.

### Frontend in Docker

```bash
cd ziantsabit-fe
docker compose up --build
```

Multi-stage build: Node compiles the bundle, then nginx serves it on <http://localhost:8080>.

Routing is client-side, so `dist/` contains no `about.html` — any static host must rewrite unknown paths to `index.html` or a refresh on `/about` returns 404. `nginx.conf` does that with `try_files $uri $uri/ /index.html`; `npm run dev` and `npm run preview` have the same fallback built in. If you deploy the `dist/` folder somewhere else, that rewrite is on you.

---

## Backend

All commands run from `ziantsabit-be/`. The database is Postgres, with no sqlite fallback, so create it before the first `migrate`:

```bash
createdb zian_tsabit_be   # or: psql -c "CREATE DATABASE zian_tsabit_be"
```

That matches `settings.py`'s defaults (`POSTGRES_DB` and `POSTGRES_USER` both `zian_tsabit_be`, `POSTGRES_PASSWORD=postgres`, on `localhost:5432`) — either create a matching role, or copy `ziantsabit-be/.env.example` to `.env` and point the `POSTGRES_*` variables at whatever server you already have.

```bash
cd ziantsabit-be
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API is then at <http://localhost:8000/api/> and Swagger UI at <http://localhost:8000/api/docs/>. A fresh database has no user account — create one for the admin and for any write request:

```bash
python manage.py createsuperuser
```

### Endpoints

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/posts/` | List, 20 per page. `?category=books\|projects\|garage_sale`, `?status=draft\|published` |
| `POST` | `/api/posts/` | Create |
| `GET` | `/api/posts/{slug}/` | Retrieve |
| `PUT` / `PATCH` | `/api/posts/{slug}/` | Replace / update |
| `DELETE` | `/api/posts/{slug}/` | Delete |
| `GET` | `/api/docs/` | Swagger UI |
| `GET` | `/api/redoc/` | ReDoc |
| `GET` | `/api/schema/` | OpenAPI 3 document |
| `GET` | `/admin/` | Django admin |

Posts are addressed by **slug, not id**. A slug is generated from the title when you leave it out.

**Reads are public; writes need authentication.** From a terminal:

```bash
# public read
curl http://localhost:8000/api/posts/

# create (basic auth with the superuser you made above)
curl -u USER:PASSWORD -X POST http://localhost:8000/api/posts/ \
  -H "Content-Type: application/json" \
  -d '{"title": "Clean Code", "category": "books", "status": "published"}'
```

Or log into `/admin/` and use the browsable API and Swagger's **Try it out** in the same browser session.

Anonymous callers only ever see published posts — on the detail route too, not just the list. An unrecognised `?category=` or `?status=` is a `400`, not an empty list.

### Tests and schema

```bash
python manage.py test                                    # whole suite (23 tests)
python manage.py test myapp.tests.PostAPITests           # one class
python manage.py spectacular --validate --fail-on-warn --file /dev/null   # check OpenAPI output
```

Run the schema check after editing a serializer or viewset. Note that `?category=` and `?status=` are read straight off the query string, so the generator cannot infer them — they are declared by hand on `PostViewSet` and a new filter needs the same treatment or it will be missing from Swagger.

### Backend in Docker

```bash
cd ziantsabit-be
docker compose up --build
```

Starts a `db` (Postgres 16, named volume) alongside `api`; `api` waits for `db`'s healthcheck before its own `entrypoint.sh` applies migrations on every start. The source tree is still bind-mounted so autoreload picks up edits, but the database itself is not — it lives in the `postgres_data` volume, independent of the host.

The container runs as UID 1000 rather than root; that no longer has anything to do with the database (which is reached over the network now), just standard non-root hygiene.

Useful once it is up:

```bash
docker compose exec api python manage.py createsuperuser
docker compose exec api python manage.py test
docker compose logs -f
docker compose down
```

### Environment variables

Read by `ziantsabit-be/ziantsabit_be/settings.py`; the defaults are what a bare `manage.py runserver` uses.

| Variable | Default | |
| --- | --- | --- |
| `DEBUG` | `1` | Any of `0`, `false`, `False`, empty turns it off |
| `DJANGO_ALLOWED_HOSTS` | `localhost 127.0.0.1 [::1]` | Space-separated |
| `DJANGO_SECRET_KEY` | the insecure dev key | Set this for anything deployed |
| `CORS_ALLOWED_ORIGINS` | `:5173`, `:4173`, `:8080` on localhost and 127.0.0.1 | Space-separated. Must include whichever origin serves the SPA |
| `POSTGRES_DB` | `zian_tsabit_be` | |
| `POSTGRES_USER` | `zian_tsabit_be` | |
| `POSTGRES_PASSWORD` | `postgres` | Dev-only default; set a real one for anything deployed |
| `POSTGRES_HOST` | `localhost` | `db` inside docker-compose |
| `POSTGRES_PORT` | `5432` | |

See `ziantsabit-be/.env.example` for a copy-pasteable `.env`.

---

## Ports

| | |
| --- | --- |
| `5173` | Frontend, `npm run dev` |
| `4173` | Frontend, `npm run preview` |
| `8080` | Frontend, Docker (nginx) |
| `8000` | Backend, local or Docker |

## Running the two together

`/books`, `/projects` and `/garage` fetch their content from the API, so they need the backend up. Two terminals:

```bash
# terminal 1
cd ziantsabit-be && source .venv/bin/activate && python manage.py runserver

# terminal 2
cd ziantsabit-fe && npm run dev
```

The SPA reads its API location from `VITE_API_BASE_URL`, defaulting to `http://localhost:8000/api` — the default is correct for the setup above, so there is nothing to configure locally. To point it elsewhere, copy `ziantsabit-fe/.env.example` to `.env`. **Vite inlines env vars at build time**, so a change means restarting `npm run dev` or rebuilding.

The two are always on different origins, so every request is cross-origin. `CORS_ALLOWED_ORIGINS` on the backend already lists `:5173`, `:4173` and `:8080`; **an origin missing from that list gets its responses discarded by the browser**, which surfaces as the same "Could not reach the API" message as a backend that is simply down.

Each of those three pages has four states: a spinner, an error with a **Retry** button, the original `Coming soon...` placeholder when the category has no posts, and a list of cards once it does. Add content through `/admin/` or `POST /api/posts/` — remember `status: "published"`, since drafts are invisible to the site.

## Not wired up yet

Home's "Latest Updates" section is still a `Coming soon...` placeholder, and `src/services/Updates.tsx` is still an empty stub — posts have no "update" category, so that feed has no backend behind it. `/`, `/about` and `/curriculum-vitae` are hardcoded copy by design.
