# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal portfolio website (ziantsabit.com). Two independent sub-projects in one repo, each with its own Dockerfile and docker-compose.yml — there is no root-level build, package manager, or orchestration that ties them together.

- `ziantsabit-fe/` — React 19 + TypeScript + Vite SPA (the live site)
- `ziantsabit-be/` — Django backend, still scaffolding

## Commands

Frontend (run from `ziantsabit-fe/`):

```bash
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b (project references) then vite build
npm run lint       # eslint .
npm run preview    # serve the built dist/
docker compose up --build   # multi-stage build -> nginx on :8080
```

Backend (run from `ziantsabit-be/`):

```bash
pip install -r requirements.txt
python manage.py runserver
python manage.py makemigrations myapp && python manage.py migrate
python manage.py test              # whole suite
python manage.py test myapp.tests.ClassName.test_name   # single test
python manage.py spectacular --validate --fail-on-warn --file /dev/null   # check OpenAPI schema
docker compose up --build          # Django dev server on :8000, Swagger at /api/docs/
```

No test runner is configured for the frontend.

## Frontend architecture

### Adding a page

`src/App.tsx` is the whole routing table and the app shell — `<Header />` and `<Footer />` live there, so both persist across navigation and a new page inherits them for free. Every page renders beneath a fixed bar (56px on `xs`, 64px from `sm`). A new page is three coordinated edits:

1. `src/pages/X.tsx` — default-exported function component.
2. A `<Route path="/x" element={<X />} />` in `App.tsx`.
3. An entry in the `navItems` array in `src/components/Header.tsx` — that one array feeds both the desktop nav and the mobile `Drawer`, so adding it in one place covers both. Home is deliberately absent from it; the "Zian Tsabit" logo `Link` is what routes to `/`.

### Colour and the light/dark theme

`src/theme.ts` is the single source of colour. `main.tsx` wraps the app in `<ThemeProvider theme={theme} defaultMode="system">` plus `<CssBaseline />`, and the theme declares both schemes via MUI's `colorSchemes` with `cssVariables: { colorSchemeSelector: "class" }`.

**Never write a colour literal in a component.** `color: "white"` or `grey.900` resolves to the same thing in both schemes, so a literal silently breaks light mode — dark text on a dark card. Use semantic tokens only:

| Instead of | Use |
| --- | --- |
| `color: "white"` | `color: "text.primary"` |
| `color: "grey.400/500/600"` | `color: "text.secondary"` |
| `bgcolor: "black"` | `bgcolor: "background.default"` |
| `bgcolor: "grey.900"` | `bgcolor: "background.paper"` |
| `#6497b1` | `primary.main` |
| `borderColor: "grey.800"`, `bgcolor: "grey"` | `divider` |

The one custom token is `palette.headerScrolled` (declared through module augmentation in `theme.ts`), the translucent wash behind the scrolled header. Read it via `(theme.vars ?? theme).palette.headerScrolled` — with `cssVariables` on, `theme.vars` is the populated one, and the fallback keeps TypeScript happy since `vars` is optional on the type.

Note the two schemes do **not** share a link colour: dark uses `#6497b1`, light uses the darker `#1565c0`, because `#6497b1` on white is only ~3.1:1 — under the 4.5:1 AA floor for body text. If you add a colour, check it against both backgrounds.

**Mode selection** is `defaultMode="system"`, so a first-time visitor follows their OS. `ColorModeToggle.tsx` calls `setMode()` to store an explicit override under the `mui-mode` localStorage key, which then wins over the OS. `mode` is `undefined` on the first render, so the toggle renders a hidden same-size placeholder until mounted rather than flashing the wrong icon.

**Avoiding a flash of the wrong theme** takes two cooperating pieces, because MUI emits its palette as CSS variables injected by JavaScript — before React mounts there is nothing colouring the page:

1. `index.css` carries `prefers-color-scheme` media queries plus `html.light` / `html.dark` rules that set *only* the page background. They live in the static, render-blocking stylesheet, so the correct backdrop paints immediately.
2. An inline script in `index.html` reads `localStorage['mui-mode']` and applies the class before that stylesheet is parsed, so a stored choice that contradicts the OS is honoured pre-paint too.

Those background hex values are duplicated from `palette.background.default`; if you change one, change the other. That is the only place a colour literal belongs outside `theme.ts`.

### Page layout: the sticky-footer shell

`App.tsx` is a flex column at least `100vh` tall holding `<main>` and `<Footer />`. `<main>` carries `flex: 1` (plus `pt: HEADER_HEIGHT`, since the header is `position: fixed` and out of flow), so it absorbs the slack and the footer lands at the bottom of a short page rather than one screen below the fold.

**A page therefore sets `flex: 1`, never a height of its own.** There is deliberately no `PAGE_MIN_HEIGHT` constant any more — a page using `minHeight: 100vh` or `calc(100vh - header)` inside this shell is taller than the space available and reintroduces a permanent scrollbar. `HEADER_HEIGHT` in `src/constants/layout.ts` is the only remaining metric, shared by `Header.tsx` and `<main>`'s padding. Pages must not add their own top margin for the header; an earlier `marginTop: "36px"` under a 64px bar left content sitting behind it.

A child that should soak up leftover vertical space needs an unbroken `flex: 1` chain down from `<main>` — this is why `Home`'s `Container` is itself a flex column, so the typewriter block can grow instead of pinning a fixed `30vh` that pushed the page just past the viewport on a phone.

Pages are built from `Box`/`Container`/`Stack` with inline `sx` — no CSS modules, no styled-components except `Typewriter`. Existing pages follow one of two shapes; copy the closer one:

- **Content page** (`Home`, `CV`, `About`, `Books`): `Box` with `flex: 1`, `bgcolor: "transparent"`, `pt: { xs: 2, sm: 3 }`, wrapping a `Container maxWidth="md"`. Don't add bottom padding for breathing room — the footer's top border now terminates the page.
- **List page** (`Projects`, `Posts`): `bgcolor: "background.default"`, a `Container maxWidth="md"` with `py: { xs: 4, md: 6 }`. `Typewriter text="Coming soon..."` only ever appears now as the *empty state* a section's post list renders itself when it has nothing published — not as page content a page author writes. There is no Garage page any more; see "Frontend/backend seam" below.

Use `Container` (or explicit `px`) rather than a bare `maxWidth` on a `Box` — `Container` supplies the responsive side gutters that keep text off the screen edge on phones.

### Responsive conventions

Responsive values use the MUI breakpoint object form (`{ xs: "12px", sm: "14px", md: "16px", lg: "22px" }`, `direction={{ xs: "column", sm: "row" }}`) rather than media queries. Two rules the existing code now follows:

- **Justified text is `sm`-and-up only** — `textAlign: { xs: "left", sm: "justify" }`. A justified ~35-character phone line opens visible rivers of whitespace.
- **Nothing may widen the page.** `html, body` carry `overflow-x: hidden` as a backstop, but that only hides the symptom. If a block genuinely needs a fixed minimum width, give it its own `overflowX: "auto"` container so it pans inside its box while `document.scrollWidth` stays equal to the viewport.

### Component notes

- `Header.tsx` owns everything in `sx` — there is no longer a `Header.css`. A scroll listener flips `isScrolled` past 50px, which swaps `bgcolor` between `transparent` and `palette.headerScrolled` under a `background-color` transition. It had to move out of CSS because a hardcoded `rgba(0,0,0,0.85)` cannot follow the colour scheme.
- `Footer.tsx` is copyright plus LinkedIn/GitHub/Email. It uses `@mui/icons-material` icons rather than the CDN devicon images the CV header uses, so the glyphs take `currentColor` and follow the theme instead of staying fixed-colour.
- `SectionHeading.tsx` and `TagChip.tsx` (with its `TagChipRow` export) are shared by the CV and About pages — they were duplicated inline before, so both pages drifting apart was a matter of time. Reuse them rather than restyling a heading or pill locally.
- `TimelineItem.tsx` renders one LinkedIn-style entry: an absolutely positioned dot plus a `&::before` rail that runs from under the dot to the bottom of the entry, so consecutive items join into one continuous line. Pass `last` on the final entry of a section to suppress the trailing rail. Title and date sit on one row at `sm`+ and stack at `xs`.
- `Typewriter.tsx` is the one emotion `styled()` component. Width is driven by a `--characters` CSS custom property computed from `text.length`, typed via `interface CustomStyles extends React.CSSProperties`; the animation loops forever, so it reads as a placeholder, not a one-shot reveal.
- **`@mui/joy` was removed; don't add it back.** Joy and Material read the same theme context, so a Joy component under the Material `ThemeProvider` crashes the whole app with `Cannot read properties of undefined (reading 'xl')` — a blank white page, not a degraded one. Joy also has its own independent colour-scheme system, so it would never follow the light/dark toggle. `Header.tsx` used Joy's `List`/`ListItem`; those are now plain `Box component="ul"/"li"` with the menubar roles kept. `@mui/material` is the only component library.
- `src/css/Home.css` and `src/css/Projects.css` are empty leftovers imported by nothing.

### Markdown

Post bodies are Markdown. `src/components/Markdown.tsx` renders them and is the **only** place that should — the admin's Preview tab renders through the same component as the published page, which is what stops the preview from drifting away from the real output.

- **Raw HTML is not rendered.** `react-markdown` ignores it unless `rehype-raw` is added; leave it out. Bodies are stored and replayed verbatim, so a `<script>` in one should stay text.
- **Headings are demoted one level** — a `#` becomes an `<h2>`, because the page already spends its `<h1>` on the post title. Visual size still follows what was typed.
- **`remark-breaks` is load-bearing.** Bodies written before Markdown existed were rendered with `whiteSpace: "pre-line"`; without this plugin every one of them silently reflows into a single paragraph.
- **Wide blocks scroll in their own box.** `<pre>` and `<table>` carry `overflowX: auto` — see the "nothing may widen the page" rule above.
- `toPlainText()` (exported from the same file) flattens Markdown for card previews, which fall back to the body when a post has no excerpt. It is regex, not a parse, on purpose: the output is a clamped teaser.

The editor is `src/components/admin/MarkdownEditor.tsx` (Write/Preview tabs, toolbar, shortcuts) over the pure transforms in `markdownCommands.ts`. Two things there are deliberate and easy to break:

- **Every edit goes through `document.execCommand("insertText")`.** It is deprecated and it is still the only way to make a programmatic edit that the browser's native undo stack knows about. Assign to the textarea's value instead and Ctrl+Z after a toolbar click throws away the whole field.
- **Tab is trapped, and Escape releases it for one keypress.** Without that opt-out a keyboard-only user cannot get from the body to the Save button.

### Content and assets

All copy is hardcoded in components. `CV.tsx` is the outlier and the one page with a real data shape: module-level `summary`, `experience`, `projects`, `skills`, and `education` arrays declared above the component, mapped into `<TimelineItem />`. Its content is a manual transcription of the owner's CV, so keeping it current is a hand edit.

**No CV PDF is shipped, deliberately.** The site used to serve `public/Ghazian_Tsabit_Alkamil.pdf` behind a "Download CV" button; both were removed because the document contains a personal phone number. Don't reintroduce a downloadable CV without checking what personal data is in it — a PDF in `public/` is world-readable to anyone who guesses the URL, with no link required.

Static files live in `public/` and are referenced by absolute path (`/pp-github.png` on Home, `/professional-photo.jpeg` on About). These are untyped string literals that Vite will not check, so renaming anything in `public/` means grepping for the old filename — the CV download button silently 404'd for months after `c77e4ac` renamed its target.

The Ubuntu font comes from a Google Fonts `<link>` in `index.html`, not from npm, and **that URL must keep requesting the `ital` axis**. `index.css` sets `font-synthesis: none`, so with a regular-only font the browser will not fake a slant: `<em>` and every `fontStyle: "italic"` (the Books quote, `TimelineItem`'s company blurb) render identically to body text. That was the case until the axis was added — the markup looked right and the output was silently wrong.

External links are inconsistent: `CV.tsx` routes them through react-router's `Link` (`to="https://..."`, `to="mailto:..."`) while `Home.tsx` uses a plain `<a>`. The plain anchor is the correct one for off-site URLs.

### Serving the built site

Routing is client-side, so `/about`, `/books`, … exist only in `App.tsx` — there is no matching file in `dist/`. Any static host must rewrite unknown paths to `index.html` or a direct hit (or a refresh, or a shared link) returns 404 while in-app navigation works fine.

`nginx.conf` does this for the Docker image via `try_files $uri $uri/ /index.html`, and the Dockerfile copies it to `/etc/nginx/conf.d/default.conf`. Two details there are deliberate: `/assets/` uses `try_files $uri =404` so a missing bundle fails as a 404 instead of silently returning HTML that the browser then tries to parse as JavaScript, and `index.html` is sent `Cache-Control: no-store` so a returning visitor never gets an old shell pointing at asset hashes that no longer exist.

`npm run dev` and `npm run preview` both have this fallback built in, so this class of bug only ever shows up in the container.

### Build gotcha

`tsconfig.app.json` sets `strict`, `noUnusedLocals`, and `noUnusedParameters`. `npm run dev` tolerates an unused import; `npm run build` runs `tsc -b` first and fails on it. Run `npm run build` before assuming a change is complete.

## Backend status

`myapp` is installed and serves one working resource: a DRF `ModelViewSet` over `Post`. `requirements.txt` is `Django>=4.2` plus `djangorestframework>=3.15`. **Database is Postgres, with no sqlite fallback anywhere** — a MinIO compose file existed alongside an earlier Postgres setup and was removed in `29dd34b`, but Postgres itself came back via `psycopg[binary]` and the `db` service in `docker-compose.yml`. `settings.py`'s `DATABASES` reads `POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_HOST`/`POSTGRES_PORT`, defaulting to `zian_tsabit_be`/`zian_tsabit_be`/`postgres`/`localhost`/`5432` — those defaults resolve inside Docker (`POSTGRES_HOST=db` there) but a bare `manage.py runserver` needs its own reachable Postgres server; there is deliberately no zero-setup fallback, so `createdb zian_tsabit_be` (or a matching role) is a prerequisite, not optional. See `ziantsabit-be/.env.example`.

### The Post model

`Post` is the whole content model, and it replaced the earlier `Book` / `Project` / `GarageSale` / `Update` models — four near-identical title-plus-fields tables for what the site renders as sections of one feed. **Add a section by adding a `Post.Category` member, not a new model.** `migrations/0001_initial.py` creates only `myapp_post`; the old models never had a migration, so there is nothing to clean up if you go looking for their tables.

Two things happen in `Post.save()` rather than in the serializer, so they hold for the admin and shell too:

- **`slug` is derived from `title` when left blank**, and deduped with a `-2`, `-3` suffix. It stays writable so a URL can be pinned by hand. A slug of only whitespace passes the model's unique check and then collides inside `save()`, which surfaces as a 500 — `PostSerializer.validate_slug` rejects it as a 400 first.
- **`status="published"` with no `published_at` stamps it `now()`**. `Meta.ordering` is `["-published_at", "-created_at"]`, so without that a published post with a null date would sort below every draft.

### API surface

Routed at `api/` from the project `urls.py` via `myapp/urls.py`'s `DefaultRouter`; `DefaultRouter` also serves the index at `/api/` and the browsable HTML API.

| | |
| --- | --- |
| `GET /api/posts/` | list, paginated 20 per page (`?category=`, `?status=`) |
| `POST /api/posts/` | create |
| `GET|PUT|PATCH|DELETE /api/posts/{slug}/` | detail |
| `GET /api/schema/` | OpenAPI 3 document (drf-spectacular) |
| `GET /api/docs/` | Swagger UI |
| `GET /api/redoc/` | ReDoc |

**Lookup is by `slug`, not `id`** (`lookup_field = "slug"`), matching the URLs the frontend will use.

`permission_classes = [IsAuthenticatedOrReadOnly]`: reads are open, writes need a logged-in user. Auth is session (for the browsable API while logged into `/admin/`) plus basic (`curl -u`). A fresh database has no user in it — `manage.py createsuperuser` before trying a write by hand.

Two deliberate details in `PostViewSet.get_queryset`:

- **Drafts are filtered for anonymous users on every route, not just the list.** Filtering only the list would still hand an unpublished post to anyone who guessed its slug.
- **An unknown `?category=` or `?status=` is a 400, not an empty result.** Dropping an unrecognised filter silently would answer a typo'd `?category=book` with every post on the site.

### Swagger / OpenAPI

`drf-spectacular` generates the schema from the serializer and viewset; the three doc routes are declared in `myapp/urls.py` **above** `include(router.urls)`, and `SPECTACULAR_SETTINGS` lives in `settings.py`.

Because `category` and `status` are read straight off `request.query_params` in `get_queryset` rather than declared by a filter backend, **the generator cannot see them** — they are documented by the `@extend_schema_view(list=extend_schema(parameters=[...]))` decorator on `PostViewSet`, with `enum` pulled from the model's `TextChoices` so the two cannot drift. Any new hand-rolled query param needs the same treatment or it will be missing from Swagger.

Check the schema after touching a serializer or viewset:

```bash
python manage.py spectacular --validate --fail-on-warn --file /dev/null
```

Swagger UI and ReDoc load their JS from a CDN, so the pages need internet; the `/api/schema/` document itself does not, and no `collectstatic` is involved.

### Tests

`myapp/tests.py` is a real suite (23 tests, `APITestCase`) covering slug generation, publish stamping, the draft visibility rules, filter validation, basic-auth writes, and each CRUD verb for both anonymous and authenticated callers. Run it with `python manage.py test`.

### Settings and the container

`SECRET_KEY`, `DEBUG` and `ALLOWED_HOSTS` read the environment (`DJANGO_SECRET_KEY`, `DEBUG`, `DJANGO_ALLOWED_HOSTS`), with defaults that keep a bare `manage.py runserver` behaving as it did. The compose file had been passing `DEBUG` and `DJANGO_ALLOWED_HOSTS` since it was written while `settings.py` hardcoded both, so those variables did nothing; changing one and seeing no effect was the symptom.

The image is `python:3.12-slim` running `runserver`, with `entrypoint.sh` applying migrations before handing off to `CMD` — a fresh container has no other opportunity to create `myapp_post`, and the API 500s on its first request without it. `docker-compose.yml`'s `api` service has `depends_on: db: condition: service_healthy`, so that migrate never races Postgres's own startup — without it, `entrypoint.sh` would sometimes hit a port nothing is listening on yet.

**It runs as UID 1000 (`app`), not root** — plain non-root hygiene now that the database is Postgres reached over the network rather than a bind-mounted file. The earlier UID-matching requirement (`db.sqlite3` had to be writable by the container's user, which meant it had to be writable by whatever `id -u` the host reported) no longer applies: Postgres's data directory lives in the `postgres_data` named volume, not a bind mount, so no host UID matters for it.

`requirements.txt` pins nothing but lower bounds, and it shows: the container resolves **Django 6.0** while a local venv built earlier may hold 5.2. The suite passes on both, but pin the versions if that drift matters.

## Frontend/backend seam

`/books`, `/projects`, `/posts` and each one's `/…/:slug` detail route render live data from `GET /api/posts/`. `/` and the CV/About pages are still hardcoded copy, except Home's "Latest Updates" block, which is also live (see below).

**There is no `/garage` page.** `Post.Category.GARAGE_SALE` is still a valid backend category — the admin console can still file a post under it — but nothing public links there any more; the page, its route, and its nav item were deleted. `VISIBLE_CATEGORIES` in `posts.ts` (`posts`, `books`, `projects`) is the list every cross-category view filters to, so a stray `garage_sale` post can never end up linked from a page that no longer exists.

**`/posts` is the odd one out: it browses every visible category, not just its own.** `/books` and `/projects` are still single-category pages built on `PostList` + `usePosts`, exactly as before. `/posts` instead has its own category filter (`TextField select`, defaulting to "All categories") and numbered `Pagination` instead of a "Load more" button — see `usePaginatedPosts.ts` and `Posts.tsx`.

No HTTP client dependency anywhere — `fetch` plus a handful of hooks:

- **`src/services/posts.ts`** — types mirroring `PostSerializer`, plus every fetch function: `fetchPosts(category, signal)` (one category), `fetchPost(slug, signal)` (one post, for a detail page — throws `PostNotFoundError` on a 404 so a "not found" state is distinguishable from a real error), `fetchLatestPosts(signal)` (newest posts across all categories, unfiltered — the API's default ordering is already newest-first), `fetchPostsPage({category, page}, signal)` (one numbered page, category optional), and the shared `fetchPostPage(url, signal)` they all funnel through. Also `CATEGORY_LABELS`, `CATEGORY_BASE_PATHS` (category → route, needed only where a caller doesn't already know its own category statically) and `VISIBLE_CATEGORIES`.
- **`src/services/usePosts.ts`** — one category, loading/error/empty/populated, appends pages via `loadMore`. Used by `Books`/`Projects`.
- **`src/services/usePost.ts`** — one post by slug, for a `PostDetail` page; adds a `not-found` phase on top of the usual three.
- **`src/services/useLatestPosts.ts`** — newest `limit` posts across `VISIBLE_CATEGORIES`, no pagination. Backs Home's `LatestUpdates` component.
- **`src/services/usePaginatedPosts.ts`** — one numbered page, category optional; backs `Posts.tsx`. When no category is given it filters `garage_sale` out client-side, so `count`/`totalPages` can run slightly high if any such post exists — not worth a backend change for a category the site no longer surfaces.
- **`src/components/PostList.tsx`** — renders the four states for a single-category page; also exports `PostCard` so `LatestUpdates` and `Posts.tsx`'s all-categories view can reuse the same card without a second implementation. **Needs an unbroken `flex: 1` chain from `<main>`**, which is why every page using it makes its `Container` a flex column; without it the loading spinner and the empty placeholder stop being vertically centred. `src/components/Centered.tsx` is that centring wrapper, shared by `PostList`, `PostDetail` and `LatestUpdates`.

`API_BASE_URL` is `import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api"`, typed in `src/vite-env.d.ts` and documented in `.env.example`. Trailing slashes are stripped, because `//posts/` earns an `APPEND_SLASH` redirect instead of a response.

Points worth keeping intact:

- **An aborted request is not an error.** Every fetch takes an `AbortSignal`; the effect cancels on unmount and on a category change, and both the client and the hook check `isAbort` before reporting anything. Skip that and a fast navigation logs a spurious "Could not reach the API", or a resolved request writes state into an unmounted component.
- **`fetch` rejects identically for a dead backend and a CORS failure** — the browser only ever says `Failed to fetch`. `posts.ts` rewrites that into `Could not reach the API at <url>. Is the backend running?` with a Retry button, because the raw message tells nobody anything.
- **The empty state is the old `Coming soon...` typewriter.** A section with no posts looks exactly as the page did before it was wired, so publishing the first post is what changes the page.
- **`CORS_ALLOWED_ORIGINS` must list whatever origin serves the SPA.** Defaults cover `:5173` (dev), `:4173` (preview) and `:8080` (nginx container); a deployed site needs its real origin added or every response is discarded by the browser.
