# ziantsabit.com

My portfolio website — a React SPA plus a Django content API.

The two halves are independent projects that happen to share a repo. Each has its own `Dockerfile` and `docker-compose.yml`, and there is **no root-level build, package manager or compose file** tying them together: you run and build them separately, from their own directories.

```
zian-tsabit-com/      React 19 + TypeScript + Vite  (the live site)
zian_tsabit_be/       Django + DRF                  (posts API)
```

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | **20.19+ or 22.12+** | Required by Vite 7. On Node 18, `npm run build` still passes but `npm run dev` fails with `TypeError: crypto.hash is not a function`. |
| Python | 3.10+ | The container image uses 3.12. |
| Docker | Compose v2 | Optional — only for the containerised runs below. |

---

## Frontend

All commands run from `zian-tsabit-com/`.

```bash
cd zian-tsabit-com
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
cd zian-tsabit-com
docker compose up --build
```

Multi-stage build: Node compiles the bundle, then nginx serves it on <http://localhost:8080>.

Routing is client-side, so `dist/` contains no `about.html` — any static host must rewrite unknown paths to `index.html` or a refresh on `/about` returns 404. `nginx.conf` does that with `try_files $uri $uri/ /index.html`; `npm run dev` and `npm run preview` have the same fallback built in. If you deploy the `dist/` folder somewhere else, that rewrite is on you.

---

## Backend

All commands run from `zian_tsabit_be/`.

```bash
cd zian_tsabit_be
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API is then at <http://localhost:8000/api/> and Swagger UI at <http://localhost:8000/api/docs/>.

`db.sqlite3` is committed, so there is no database to create — but it contains no user account. Create one for the admin and for any write request:

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
cd zian_tsabit_be
docker compose up --build
```

Serves the same URLs on port 8000. Migrations are applied on every start by `entrypoint.sh`, and the source tree is bind-mounted so autoreload and `db.sqlite3` writes behave like a local run.

The container runs as UID 1000 rather than root. Because the database is a bind-mounted host file, **if `id -u` on your machine is not 1000 the mounted `db.sqlite3` is read-only to the container and startup fails on the migrate** — uncomment the `user:` line in `docker-compose.yml`.

Useful once it is up:

```bash
docker compose exec api python manage.py createsuperuser
docker compose exec api python manage.py test
docker compose logs -f
docker compose down
```

### Environment variables

Read by `zian_tsabit_be/settings.py`; the defaults are what a bare `manage.py runserver` uses.

| Variable | Default | |
| --- | --- | --- |
| `DEBUG` | `1` | Any of `0`, `false`, `False`, empty turns it off |
| `DJANGO_ALLOWED_HOSTS` | `localhost 127.0.0.1 [::1]` | Space-separated |
| `DJANGO_SECRET_KEY` | the insecure dev key | Set this for anything deployed |

---

## Ports

| | |
| --- | --- |
| `5173` | Frontend, `npm run dev` |
| `4173` | Frontend, `npm run preview` |
| `8080` | Frontend, Docker (nginx) |
| `8000` | Backend, local or Docker |

## Not wired up yet

The frontend does not call the API. There is no HTTP client dependency and no API base URL, the files in `src/services/` are empty stubs, and `/projects` and `/garage` still render a `Coming soon...` placeholder.

`django-cors-headers` is **not** installed. The SPA and the API are on different origins in every setup here — `:5173` or `:8080` against `:8000` — so the first `fetch` from the browser will fail on CORS preflight until it is added.
