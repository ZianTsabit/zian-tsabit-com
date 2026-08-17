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
                                   # also starts RustFS: S3 API on :9000, console on :9001
```

No test runner is configured for the frontend.

## Frontend architecture

### Adding a page

`src/App.tsx` is the whole routing table and the app shell — `<Header />` and `<Footer />` live there, so both persist across navigation and a new page inherits them for free. Every page renders beneath a fixed bar (56px on `xs`, 64px from `sm`). A new page is three coordinated edits:

1. `src/pages/X.tsx` — default-exported function component.
2. A `<Route path="/x" element={<X />} />` in `App.tsx`.
3. An entry in the `navItems` array in `src/components/Header.tsx` — that one array feeds both the desktop nav and the mobile `Drawer`, so adding it in one place covers both. The "Zian Tsabit" logo `Link` also routes to `/`, which is the Posts feed itself; `navItems` names it "Posts" anyway, so a visitor deep in the site does not have to guess that the logo is the way back to the list.

**There is no separate home page.** `/` renders `Posts` — `src/pages/Home.tsx` and its "Latest Updates" feed (`LatestUpdates.tsx`, `useLatestPosts.ts`, `fetchLatestPosts`) were deleted rather than left as a landing page above the feed. `/posts` is kept as a `<Navigate to="/" replace />` because links and bookmarks to it exist, but the detail route `/posts/:slug` still renders normally: `CROSS_CATEGORY_BASE_PATH` is still `/posts`, so every cross-category card builds that URL and only the *list* path redirects. `PostDetail` at that route takes `backTo="/"`.

**An admin page is different: it goes under the `/admin` route and into `AdminNav`, never into `navItems`.** `/admin` is a shell (`Admin.tsx`) whose children are `AdminOverview` (index), `AdminConsole` (`posts`), `AdminStats` (`stats`) and the two editors — nested so the session is checked once for all of them, and so `AdminNav` is mounted beside the `<Outlet>` and survives navigation between sections rather than remounting. The `items` array in `AdminNav.tsx` is the one place a section is listed; it feeds the `md`+ left column and the phone row alike. Note the `end` prop on the Overview link: `NavLink` matches by prefix, so without it `/admin` would stay highlighted on every child route.

Two layout details in the shell are load-bearing. The content column carries `minWidth: 0`, because a flex item defaults to `min-width: auto` and refuses to shrink below its content — without it the post list's filter row and the cadence chart push the nav off the screen instead of scrolling inside themselves. And **sign-out lives in `AdminNav`, not on the post list where it used to be**: it is chrome for the whole admin, so leaving it on one page would mean either three copies or a control that vanishes when you navigate.

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

A child that should soak up leftover vertical space needs an unbroken `flex: 1` chain down from `<main>` — this is why every page rendering a feed makes its `Container` a flex column, so the list (and `PostList`'s centred loading/empty states) can grow instead of pinning a fixed `30vh` that pushed the page just past the viewport on a phone.

Pages are built from `Box`/`Container`/`Stack` with inline `sx` — no CSS modules, no styled-components except `Typewriter`. Existing pages follow one of two shapes; copy the closer one:

- **Content page** (`CV`, `About`, `Books`): `Box` with `flex: 1`, `bgcolor: "transparent"`, `pt: { xs: 2, sm: 3 }`, wrapping a `Container maxWidth="md"`. Don't add bottom padding for breathing room — the footer's top border now terminates the page.
- **List page** (`Projects`, `Posts`): `bgcolor: "background.default"`, a `Container maxWidth="md"` with `py: { xs: 4, md: 6 }`. `Typewriter text="Coming soon..."` only ever appears now as the *empty state* a section's post list renders itself when it has nothing published — not as page content a page author writes. There is no Garage page any more; see "Frontend/backend seam" below.

Use `Container` (or explicit `px`) rather than a bare `maxWidth` on a `Box` — `Container` supplies the responsive side gutters that keep text off the screen edge on phones.

### Responsive conventions

Responsive values use the MUI breakpoint object form (`{ xs: "12px", sm: "14px", md: "16px", lg: "22px" }`, `direction={{ xs: "column", sm: "row" }}`) rather than media queries. Two rules the existing code now follows:

- **Justified text is `sm`-and-up only** — `textAlign: { xs: "left", sm: "justify" }`. A justified ~35-character phone line opens visible rivers of whitespace.
- **Nothing may widen the page.** `html, body` carry `overflow-x: clip` as a backstop, but that only hides the symptom. **`clip`, not `hidden`, and the difference matters:** `hidden` makes the element a scroll container, which silently disables `position: sticky` anywhere on the page — a since-removed sticky heading on the old home page rendered but never stuck until this was changed, and the Posts page's sticky filter bar depends on it today. If a block genuinely needs a fixed minimum width, give it its own `overflowX: "auto"` container so it pans inside its box while `document.scrollWidth` stays equal to the viewport.

### Component notes

- `Header.tsx` owns everything in `sx` — there is no longer a `Header.css`. A scroll listener flips `isScrolled` past 50px, which swaps `bgcolor` between `transparent` and `palette.headerScrolled` under a `background-color` transition. It had to move out of CSS because a hardcoded `rgba(0,0,0,0.85)` cannot follow the colour scheme.
- `Footer.tsx` is copyright plus LinkedIn/GitHub/Email. It uses `@mui/icons-material` icons rather than the CDN devicon images the CV header uses, so the glyphs take `currentColor` and follow the theme instead of staying fixed-colour.
- `CoverImageField.tsx` is the post form's lead-image control: upload button, preview, remove, alt text, **and an editable URL field**. The URL stays visible rather than hidden behind the picker because an image already hosted elsewhere is a perfectly good cover, and there is no reason to force a re-upload to use one. It tracks a `broken` flag off the preview's `onError` so a URL pointing nowhere says so, instead of showing the browser's broken-image glyph unexplained.
- `SectionHeading.tsx` and `TagChip.tsx` (with its `TagChipRow` export) are shared by the CV and About pages — they were duplicated inline before, so both pages drifting apart was a matter of time. Reuse them rather than restyling a heading or pill locally.
- `TimelineItem.tsx` renders one LinkedIn-style entry: an absolutely positioned dot plus a `&::before` rail that runs from under the dot to the bottom of the entry, so consecutive items join into one continuous line. Pass `last` on the final entry of a section to suppress the trailing rail. Title and date sit on one row at `sm`+ and stack at `xs`.
- `Typewriter.tsx` is the one emotion `styled()` component. Width is driven by a `--characters` CSS custom property computed from `text.length`, typed via `interface CustomStyles extends React.CSSProperties`; the animation loops forever, so it reads as a placeholder, not a one-shot reveal.
- **`@mui/joy` was removed; don't add it back.** Joy and Material read the same theme context, so a Joy component under the Material `ThemeProvider` crashes the whole app with `Cannot read properties of undefined (reading 'xl')` — a blank white page, not a degraded one. Joy also has its own independent colour-scheme system, so it would never follow the light/dark toggle. `Header.tsx` used Joy's `List`/`ListItem`; those are now plain `Box component="ul"/"li"` with the menubar roles kept. `@mui/material` is the only component library.
- `src/css/Projects.css` is an empty leftover imported by nothing (`Home.css` was one too, and went with the home page).

### Markdown

Post bodies are Markdown. `src/components/Markdown.tsx` renders them and is the **only** place that should — the admin's Preview tab renders through the same component as the published page, which is what stops the preview from drifting away from the real output.

- **Raw HTML is not rendered.** `react-markdown` ignores it unless `rehype-raw` is added; leave it out. Bodies are stored and replayed verbatim, so a `<script>` in one should stay text.
- **Headings are demoted one level** — a `#` becomes an `<h2>`, because the page already spends its `<h1>` on the post title. Visual size still follows what was typed.
- **`remark-breaks` is load-bearing.** Bodies written before Markdown existed were rendered with `whiteSpace: "pre-line"`; without this plugin every one of them silently reflows into a single paragraph.
- **Wide blocks scroll in their own box.** `<pre>` and `<table>` carry `overflowX: auto` — see the "nothing may widen the page" rule above.
- `toPlainText()` (in `src/components/markdownText.ts`) flattens Markdown for card previews, which fall back to the body when a post has no excerpt. It is regex, not a parse, on purpose: the output is a clamped teaser. It sits in its own module rather than in `Markdown.tsx` because a file exporting both a component and a plain function breaks Fast Refresh, and `react-refresh/only-export-components` fails `npm run lint` on it.

The editor is `src/components/admin/MarkdownEditor.tsx` (Write/Preview tabs, toolbar, shortcuts) over the pure transforms in `markdownCommands.ts`. Three things there are deliberate and easy to break:

- **Every edit goes through `document.execCommand("insertText")`.** It is deprecated and it is still the only way to make a programmatic edit that the browser's native undo stack knows about. Assign to the textarea's value instead and Ctrl+Z after a toolbar click throws away the whole field.
- **Tab is trapped, and Escape releases it for one keypress.** Without that opt-out a keyboard-only user cannot get from the body to the Save button.
- **The image button captures the caret *before* opening the file dialog.** The dialog takes focus, and a blurred textarea reports `selectionStart === selectionEnd === 0` in some browsers — without the saved position every upload lands at the top of the body. The upload runs on selection, then `insertImage` (in `markdownCommands.ts`) writes `![](url)` with the caret parked between the brackets, since the URL is known by then and only the alt text is still the author's to write.

### Autosave in the post editor

Both editor pages save themselves. `useAutosave` (`src/services/useAutosave.ts`) writes the form to the API three seconds after it last changed — idle time, not an interval, so a burst of typing costs one request — and `AutosaveStatus.tsx` is the line beside the Save buttons reporting it. There is no local draft copy: an autosave is a real write, so what it produces is a real post.

- **Autosave never changes a post's status.** The new-post page always writes `status: "draft"`, and the edit page writes back the status the post already has. Publishing and unpublishing stay button decisions, and the status a save carries is the only thing standing between an autosave and an accidentally-published post.
- **Every write goes through `useWriteQueue`**, one at a time, in the order asked for. Two things break without it: an autosave landing after a Publish would unpublish the post it just published, and two writes racing on the new-post page would each read `savedSlug` before the other set it — two POSTs, two posts.
- **The new-post page creates on the first write and updates on every one after** (`persist`). Pressing Publish is a PATCH of the post autosave already made, not a second create.
- **A new post's slug follows its title until the author pins one** (`slugToSend` + `deriveSlug` in `adminPosts.ts`, which matches Django's `slugify`). Autosave creates the post from whatever the title said at the first pause, and `Post.save()` generates a slug once and never again — so without this, "My first post" would live at `/my-fir` forever. Two things make it survive collisions: a current slug matching `^base(-\d+)?$` is treated as already in sync, and a rejected slug falls back to a write that omits it. **The serializer's unique check refuses a taken slug outright — `Post.save()`'s `-2` dedupe never sees it** — so "re-send it and let the server sort it out" is not an option.
- **Autosave on the edit page never renames.** It sends a blank slug, which `payload()` omits and the API reads as "keep the current URL"; a half-typed slug written three seconds later would break every link to the post, then break it differently on the next keystroke.
- **Leaving flushes a pending save rather than cancelling it**, the same reasoning as `useRecordView`: leaving is exactly when the last few seconds of typing would otherwise be lost. Only the state update is skipped once the component is gone. **An unmount is the least important of the three exits it listens for** — a closed tab, a reload and an off-site link destroy the document without React running a cleanup, which is how the debounce window used to swallow the last three seconds of writing outright. `pagehide` is the event that means "this document is going away" (and unlike `unload` it fires for a bfcache navigation); `visibilitychange` to `hidden` is there because a backgrounded tab can be discarded on mobile without any unload-family event at all. Whichever fires first writes; the other finds the fingerprint already saved and returns. Flushing on `hidden` also means switching tabs saves, which is worth having.
- **The exit flush is the one write sent with `keepalive`**, since an ordinary `fetch` is cancelled along with the document that started it. Two consequences: it needs `apiRequest` to already hold a CSRF token (fetching one needs a *response*, which a page being torn down will never read — the admin shell asking for the session on mount is what guarantees it), and `api.ts` drops the flag rather than setting it once the body passes `KEEPALIVE_MAX_BYTES`. The browser rejects a keepalive request outright past a shared 64 KiB budget, and that rejection would read as "Autosave failed" on exactly the longest posts; sending such a body as an ordinary request is no worse than the behaviour every write had before.
- **`inFlight` is a count, not a flag.** The exit path starts a save without waiting for one already running, so a boolean would be cleared by whichever finished first and report the other as done.
- **Ctrl+S / Cmd+S writes now and stays on the page**, which is deliberately *not* what the Save buttons do — they write and navigate back to the console. It saves exactly what autosave would have (a draft on the new-post page, the post's existing status on the edit page), so the shortcut can no more publish than the timer can. It is bound on the `window` from inside `useAutosave` rather than on the body textarea, so it also works from the title, the tags field and the full-screen editor; since only the two editor pages mount the hook, that is the whole scope. **The `preventDefault` comes before any check of whether there is something to save** — suppressing "Save page as..." is the point of catching the key at all, and that dialog would block the tab whether or not the form was dirty. With a clean or title-less form it is otherwise a no-op, which is why `AutosaveStatus` is the only feedback there is.
- **The full-screen body editor renders a second `AutosaveStatus`**, handed to `MarkdownEditor` as the already-rendered `fullscreenStatus` node (through `PostFormFields`) rather than as an `AutosaveState`, so the editor still knows nothing about how posts are saved and each page keeps its own wording. Full screen is `position: fixed; inset: 0` over an opaque background, so it covers the form's own line beside the Save buttons — and Ctrl+S works in there, which without this saves with nothing on screen to say so. **The copy passes `duplicate`**, which swaps `role="status" aria-live="polite"` for `aria-hidden`: the covered original is still in the document and a live region does not have to be visible to be announced, so both would report every save twice.
- **`enabled` is the guard for everything autosave must not do**, and whatever is on screen when it flips to true becomes the baseline. That is what stops a post arriving from the API from being read as an edit and saved straight back over itself, and what keeps a manual save's own changes from being written twice.

### Content and assets

All copy is hardcoded in components. `CV.tsx` is the outlier and the one page with a real data shape: module-level `summary`, `experience`, `projects`, `skills`, and `education` arrays declared above the component, mapped into `<TimelineItem />`. Its content is a manual transcription of the owner's CV, so keeping it current is a hand edit.

**No CV PDF is shipped, deliberately.** The site used to serve `public/Ghazian_Tsabit_Alkamil.pdf` behind a "Download CV" button; both were removed because the document contains a personal phone number. Don't reintroduce a downloadable CV without checking what personal data is in it — a PDF in `public/` is world-readable to anyone who guesses the URL, with no link required.

Static files live in `public/` and are referenced by absolute path (`/pp-github.png` and `/professional-photo.jpeg`, both on About). These are untyped string literals that Vite will not check, so renaming anything in `public/` means grepping for the old filename — the CV download button silently 404'd for months after `c77e4ac` renamed its target.

The Ubuntu font comes from a Google Fonts `<link>` in `index.html`, not from npm, and **that URL must keep requesting the `ital` axis**. `index.css` sets `font-synthesis: none`, so with a regular-only font the browser will not fake a slant: `<em>` and every `fontStyle: "italic"` (the Books quote, `TimelineItem`'s company blurb) render identically to body text. That was the case until the axis was added — the markup looked right and the output was silently wrong.

External links are inconsistent: `CV.tsx` routes them through react-router's `Link` (`to="https://..."`, `to="mailto:..."`) while other pages use a plain `<a>`. The plain anchor is the correct one for off-site URLs.

### Serving the built site

Routing is client-side, so `/about`, `/books`, … exist only in `App.tsx` — there is no matching file in `dist/`. Any static host must rewrite unknown paths to `index.html` or a direct hit (or a refresh, or a shared link) returns 404 while in-app navigation works fine.

`nginx.conf` does this for the Docker image via `try_files $uri $uri/ /index.html`, and the Dockerfile copies it to `/etc/nginx/conf.d/default.conf`. Two details there are deliberate: `/assets/` uses `try_files $uri =404` so a missing bundle fails as a 404 instead of silently returning HTML that the browser then tries to parse as JavaScript, and `index.html` is sent `Cache-Control: no-store` so a returning visitor never gets an old shell pointing at asset hashes that no longer exist.

`npm run dev` and `npm run preview` both have this fallback built in, so this class of bug only ever shows up in the container.

### Build gotcha

`tsconfig.app.json` sets `strict`, `noUnusedLocals`, and `noUnusedParameters`. `npm run dev` tolerates an unused import; `npm run build` runs `tsc -b` first and fails on it. Run `npm run build` before assuming a change is complete.

## Backend status

`myapp` is installed and serves two resources: a DRF `ModelViewSet` over `Post`, and an image upload endpoint. `requirements.txt` is `Django>=4.2` and `djangorestframework>=3.16`, plus `django-storages[s3]` and `Pillow` for uploads, and `gunicorn` + `whitenoise` for the production container (see "Deployment" below). **Database is Postgres, with no sqlite fallback anywhere** — an object-storage compose file existed alongside an earlier Postgres setup and was removed in `29dd34b`; both came back, Postgres via `psycopg[binary]` and the `db` service, object storage via the `rustfs` service (see "Object storage" below — this was MinIO until `10cb53a` swapped it for RustFS, which touched only compose and settings, no Python). `settings.py`'s `DATABASES` reads `POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_HOST`/`POSTGRES_PORT`, defaulting to `zian_tsabit_be`/`zian_tsabit_be`/`postgres`/`localhost`/`5432` — those defaults resolve inside Docker (`POSTGRES_HOST=db` there) but a bare `manage.py runserver` needs its own reachable Postgres server; there is deliberately no zero-setup fallback, so `createdb zian_tsabit_be` (or a matching role) is a prerequisite, not optional. See `ziantsabit-be/.env.example`.

### The Post model

`Post` is the whole content model, and it replaced the earlier `Book` / `Project` / `GarageSale` / `Update` models — four near-identical title-plus-fields tables for what the site renders as sections of one feed. **Add a section by adding a `Post.Category` member, not a new model.** `migrations/0001_initial.py` creates only `myapp_post`; the old models never had a migration, so there is nothing to clean up if you go looking for their tables.

**A post is filed under one or more sections, in `categories`** — an `ArrayField` of `Category` values, not a single `CharField` and not a join table. The reasoning matches `tags`: the sections are a fixed enum declared on the model itself, so a `Category` table would carry no column the array does not, and nothing ever reads a post's sections without the post. A write-up of a book that is also a project belongs on both feeds, and the alternative — duplicating the post — means two slugs, two view counts and two things to keep in step.

**`categories` is a set, and nothing may read `[0]` as a primary category.** `Post.clean_categories` (called from `save()`, so the admin and shell get it too) deduplicates and returns them in `Category` declaration order, which is also the site's nav order. Two posts that differ only in the order someone ticked the boxes have to be the same post, or autosave sees an edit where there is none and every consumer has to sort before comparing. The serializer calls it again so the *response* to a write matches what was stored.

**The serializer needs both `allow_empty=False` and `required=True` on it**, and they catch different mistakes: the first rejects an explicit `[]`, the second rejects leaving the key out — which the model's `default=list` would otherwise turn into a silently successful write. That default exists only so the column could be added to existing rows in `0006`; a post filed under nothing appears on no page at all, which is a mistake every time and an invisible one. The admin form has a matching guard: the last remaining category cannot be unticked, since autosave would otherwise retry a doomed write every three seconds.

**`0006_post_categories.py` is reversible, and the ordering inside it is load-bearing.** It relaxes `category` to `null=True` *before* copying the data, because going backwards Django re-adds the column in whatever state it held just before `RemoveField` — and a `NOT NULL` `CharField` with no default cannot be added to a table that already has rows. Nullable there means the reverse adds an empty column, `to_category` fills it (keeping the first section in declaration order, since one column has room for one), and only then is it tightened back. The composite `("category", "status")` index is dropped first, since it names the column. Verify a change to it by migrating down to `0005` and back up, not just forwards.

Two things happen in `Post.save()` rather than in the serializer, so they hold for the admin and shell too:

- **`slug` is derived from `title` when left blank**, and deduped with a `-2`, `-3` suffix. It stays writable so a URL can be pinned by hand. A slug of only whitespace passes the model's unique check and then collides inside `save()`, which surfaces as a 500 — `PostSerializer.validate_slug` rejects it as a 400 first.
- **`status="published"` with no `published_at` stamps it `now()`**. `Meta.ordering` is `["-published_at", "-created_at"]`, so without that a published post with a null date would sort below every draft.

**`view_count` is never written by a post save.** It is a `PositiveIntegerField(editable=False)` raised only by `POST /api/posts/{slug}/view/`, which issues a bare `UPDATE ... view_count = view_count + 1` through an `F()` expression. Two reasons it is not `post.view_count += 1; post.save()`: `save()` would drag `auto_now` along and make every read look like an edit, and two concurrent readers would each write back the number they loaded. It is also `read_only` on the serializer, so an ordinary post edit cannot carry a stale count back over it.

**`cover_image_url` is a `URLField`, not an `ImageField`** (with `cover_image_alt` beside it, blank falling back to the title at render time). The bytes are uploaded separately, through `/api/uploads/images/`, and the post only ever stores the URL that came back. That is what lets the New Post form attach an image before the post exists — an `ImageField` has nothing to hang an upload off until after the first save — and it makes a cover and an inline `![](...)` in the body the same kind of thing, so one endpoint serves both. The cost is that nothing links a bucket object back to the post using it; see "Object storage".

### API surface

Routed at `api/` from the project `urls.py` via `myapp/urls.py`'s `DefaultRouter`; `DefaultRouter` also serves the index at `/api/` and the browsable HTML API.

| | |
| --- | --- |
| `GET /api/posts/` | list, paginated 20 per page (`?category=`, `?status=`, `?ordering=`, `?published_after=`, `?published_before=`) |
| `POST /api/posts/` | create |
| `GET|PUT|PATCH|DELETE /api/posts/{slug}/` | detail |
| `POST /api/posts/{slug}/view/` | record one read; open to anonymous callers, returns `{slug, view_count}` |
| `GET /api/posts/stats/` | site-wide aggregates for the admin, **authenticated only** |
| `POST /api/uploads/images/` | multipart image upload, authenticated only; returns `{url, name}` |
| `GET /api/schema/` | OpenAPI 3 document (drf-spectacular) |
| `GET /api/docs/` | Swagger UI |
| `GET /api/redoc/` | ReDoc |

**Lookup is by `slug`, not `id`** (`lookup_field = "slug"`), matching the URLs the frontend will use. One consequence of that plus the `stats` action: `DefaultRouter` registers list-level `@action` routes *before* the detail route, so a post slugged `stats` would be shadowed by `/api/posts/stats/` and unreachable at its own detail URL. Not worth guarding against, but worth knowing before debugging it.

**`GET /api/posts/stats/` is aggregates, not rows**, and backs the admin's overview and statistics pages. Three things about it are deliberate: it is `IsAuthenticated` rather than read-open, because the draft count and drafts' view counts are the owner's business; it is built from `Post.objects.all()` rather than `get_queryset()`, so the list's `?category=` / `?status=` params cannot silently narrow what is meant to be a total; and `average_views` is per *published* post, since a draft has no public page to be read on and counting drafts in the denominator would move the number for a reason unrelated to readership. `published_by_month` returns only months that have a post — filling the gaps is the client's job (`fillMonths`), because which range to show is a question about the chart rather than about the data.

`permission_classes = [IsAuthenticatedOrReadOnly]`: reads are open, writes need a logged-in user. Auth is session (for the browsable API while logged into `/admin/`) plus basic (`curl -u`). A fresh database has no user in it — `manage.py createsuperuser` before trying a write by hand.

Two deliberate details in `PostViewSet.get_queryset`:

- **Drafts are filtered for anonymous users on every route, not just the list.** Filtering only the list would still hand an unpublished post to anyone who guessed its slug.
- **`?category=` stays singular and is a containment test** (`categories__contains=[value]`), not equality: it asks "which section am I looking at", which has one answer per page, and a post in several is returned by each of them. It cannot return duplicates, since it is a filter rather than a join. The model's index is a `GinIndex` on `categories` for the same reason — a btree cannot answer containment — plus a plain one on `status`, the composite having no array equivalent.
- **An unknown `?category=`, `?status=` or `?ordering=` is a 400, not an empty result.** Dropping an unrecognised filter silently would answer a typo'd `?category=book` with every post on the site.

`?published_after=` / `?published_before=` are inclusive `YYYY-MM-DD` bounds, either usable alone. **They filter on `Coalesce(published_at, created_at)`, not on `published_at`** — a draft has no publish date, so filtering on that column alone would drop every draft out of the admin list the moment a date was applied; the coalesced value is also exactly the date each row displays. The comparison is `__date__gte` / `__date__lte` rather than a raw datetime `lte`, which would compare against midnight and silently exclude the end day. A malformed or impossible date (`2026-02-31`) is a 400; an empty value is ignored.

`?ordering=` is `recent` (the default, `Meta.ordering`) or `views`; `ORDERINGS` at the top of `views.py` maps each to an `order_by()`. `views` keeps the date ordering as its tie-breaker, so a page of all-zero counts still reads newest-first instead of in whatever order the database returns rows. An absent param applies no `order_by()` at all rather than restating the default, so `Meta.ordering` stays the single place it lives.

### Object storage and image uploads

Post images live in an S3-compatible bucket — RustFS locally, via the `rustfs` service — not on the API container's disk, which is ephemeral and would drop every upload on a rebuild. `django-storages`' S3 backend is the `default` entry in `STORAGES`, and nothing in `settings.py` names the server, so this is the same code path a real S3/R2 deployment would use. That is not a claim, it is a demonstrated fact: `10cb53a` replaced MinIO with RustFS and changed no Python at all.

**The two endpoint settings are different addresses, and confusing them is the classic object-storage-behind-Docker bug** — uploads succeed and every `<img>` on the site points at a host the browser has never heard of:

| | |
| --- | --- |
| `AWS_S3_ENDPOINT_URL` | Django → RustFS. `http://rustfs:9000` in Docker, a name only the compose network resolves. |
| `AWS_S3_PUBLIC_ENDPOINT_URL` | browser → RustFS. Must be reachable from a visitor's machine. Derived into `AWS_S3_CUSTOM_DOMAIN`, which is what actually appears in stored URLs. |

A deployment needs the public one set to a real host; it defaults to the internal one, which is only correct when they genuinely are the same.

Three more settings are load-bearing:

- **`AWS_S3_ADDRESSING_STYLE = 'path'`.** boto3 defaults to virtual-host style (`bucket.host`), which needs wildcard DNS a self-hosted bucket does not have.
- **`AWS_QUERYSTRING_AUTH = False`, and the bucket is public-read.** `storage-init` puts a `PublicReadGetObject` policy on it with the AWS CLI — this was `mc anonymous set download` under MinIO, and RustFS has no drop-in `mc`, so the policy is now written as raw S3. It grants `s3:GetObject` only, deliberately not `s3:ListBucket`, so finding one image URL does not let anyone enumerate the bucket. Presigned URLs were the alternative and are wrong here: they expire, so every image on a page a visitor or CDN had cached would rot.
- **`AWS_DEFAULT_ACL = None`.** Per-object ACLs are unsupported by RustFS by design (and were only partly implemented by MinIO); the bucket policy is what makes objects readable, so don't send an ACL at all.
- **The policy's `"Principal": {"AWS": ["*"]}` is not interchangeable with the more common `"Principal": "*"`.** RustFS rejects both the bare string and an unwrapped `{"AWS": "*"}` with a 400 `InvalidArgument` (rustfs/rustfs#1336); the single-element array is the only form it accepts.

`myapp/uploads.py` holds the endpoint. Two details worth keeping:

- **The stored extension comes from Pillow's verdict on the bytes, not the filename.** DRF's `ImageField` is what makes this more than a file drop — a renamed archive with an `image/png` Content-Type is rejected, and a JPEG uploaded as `photo.png` is stored as `.jpg`. SVG is excluded by construction, since Pillow cannot open it.
- **Keys are `uploads/YYYY/MM/<slug>-<random hex>.<ext>`.** Date-partitioned so the bucket stays browsable, random-suffixed so two `screenshot.png`s cannot collide and a key is not guessable from a filename.

**Deleting a post does not delete its images.** That is deliberate rather than missing: an inline image's only record that it is referenced at all is Markdown text inside `body`, which any edit can silently invalidate, so reference-counting would be unreliable exactly where it mattered. Occasional orphans beat a scheme that quietly deletes a live image.

### Swagger / OpenAPI

`drf-spectacular` generates the schema from the serializer and viewset; the three doc routes are declared in `myapp/urls.py` **above** `include(router.urls)`, and `SPECTACULAR_SETTINGS` lives in `settings.py`.

Because `category` and `status` are read straight off `request.query_params` in `get_queryset` rather than declared by a filter backend, **the generator cannot see them** — they are documented by the `@extend_schema_view(list=extend_schema(parameters=[...]))` decorator on `PostViewSet`, with `enum` pulled from the model's `TextChoices` so the two cannot drift. Any new hand-rolled query param needs the same treatment or it will be missing from Swagger.

Check the schema after touching a serializer or viewset:

```bash
python manage.py spectacular --validate --fail-on-warn --file /dev/null
```

Swagger UI and ReDoc load their JS from a CDN, so the pages need internet; the `/api/schema/` document itself does not, and no `collectstatic` is involved.

**`list_filter` on `categories` has to be hand-written** (`CategoryFilter` in `admin.py`). Django builds an exact-match filter from a plain `list_filter` entry, so on an `ArrayField` the sidebar would offer whole combinations — "books, projects" — as single values and match nothing else. The `SimpleListFilter` performs the same containment test `?category=` does.

### Tests

`myapp/tests.py` is a real suite (104 tests, `APITestCase`) covering slug generation, publish stamping, the draft visibility rules, filter validation, basic-auth writes, each CRUD verb for both anonymous and authenticated callers, the upload endpoint, the view counter, and the date-range filter. Run it with `python manage.py test`.

**Tests must not depend on a setting a deployment overrides.** The three CORS tests pin `CORS_ALLOWED_ORIGINS` with `@override_settings` for exactly this reason: they previously hardcoded `http://localhost:5173` and relied on the default, so they failed inside any production-configured container — the one place running the suite is most worth doing.

**`ImageUploadTests` overrides `STORAGES` to `InMemoryStorage`**, so the suite never needs RustFS running and never leaves test objects in a real bucket. The view only calls `save()`/`url()` on the default storage, so the swap exercises the same code path. Keep any new storage test under that decorator.

### Settings and the container

`SECRET_KEY`, `DEBUG` and `ALLOWED_HOSTS` read the environment (`DJANGO_SECRET_KEY`, `DEBUG`, `DJANGO_ALLOWED_HOSTS`), with defaults that keep a bare `manage.py runserver` behaving as it did. The compose file had been passing `DEBUG` and `DJANGO_ALLOWED_HOSTS` since it was written while `settings.py` hardcoded both, so those variables did nothing; changing one and seeing no effect was the symptom.

The image is `python:3.12-slim` running `runserver`, with `entrypoint.sh` applying migrations **and `collectstatic`** before handing off to `CMD` — a fresh container has no other opportunity to create `myapp_post`, and the API 500s on its first request without it. `collectstatic` writes to `/srv/static` (`DJANGO_STATIC_ROOT`, set in the Dockerfile), which is outside `/app` on purpose: the compose file bind-mounts the source tree over `/app` for autoreload and would shadow anything collected into it. `docker-compose.yml`'s `api` service has `depends_on: db: condition: service_healthy`, so that migrate never races Postgres's own startup — without it, `entrypoint.sh` would sometimes hit a port nothing is listening on yet.

Compose runs four services, not two: `db`, `rustfs`, a one-shot `storage-init`, and `api`. **`storage-init` creates the bucket and makes it public-read**, and `api` waits on it with `condition: service_completed_successfully` — the bucket has to exist before the first upload, and nothing else creates it. It exits 0 and stays exited; that is not a crash.

Two things about the storage services are worth knowing before you debug them:

- **`rustfs/rustfs` is pinned to `latest`, which is a known liability.** RustFS ships no dated `RELEASE.*` tags the way MinIO did, so there is nothing better to pin to by name; pin a digest once a build is known good, because the project is young enough that `latest` moves under you. (The MinIO tags in the removed `minio/docker-compose.yml` from `29dd34b` are dead for the opposite reason — quay.io reaps old MinIO tags.)
- **`rustfs_data` is a different volume from the old `minio_data`.** Nothing migrates objects across, so uploads made under MinIO are still sitting in `minio_data` and their stored URLs 404 until you copy them over. Orphaned `ziantsabit-be_minio` / `_minio_init` containers from the old stack may also still be on the machine; `docker compose down --remove-orphans` clears them.

**`db` publishes `127.0.0.1:5432:5432`, and the loopback prefix is the point.** The `api` service reaches Postgres over the compose network and needs nothing published; the mapping exists for the host, so that `.env.example`'s `POSTGRES_HOST=localhost` and every `manage.py test` / `runserver` run outside Docker have something to connect to. `db` published nothing until this was added, which made that documented workflow impossible.

The short form `"5432:5432"` would bind all interfaces and hand the throwaway `zian_tsabit_be` / `postgres` credentials to anything that can route to the machine — a laptop on a café network included. Keep the explicit `127.0.0.1:`. If a local Postgres already owns 5432, change the *host* side only (`"127.0.0.1:5433:5432"`, plus `POSTGRES_PORT=5433` outside Docker); the container side has to stay 5432, since that is where the `api` service and the healthcheck look.

**It runs as UID 1000 (`app`), not root** — plain non-root hygiene now that the database is Postgres reached over the network rather than a bind-mounted file. The earlier UID-matching requirement (`db.sqlite3` had to be writable by the container's user, which meant it had to be writable by whatever `id -u` the host reported) no longer applies: Postgres's data directory lives in the `postgres_data` named volume, not a bind mount, so no host UID matters for it.

`requirements.txt` pins nothing but lower bounds, and it shows: the container resolves **Django 6.0** while a local venv built earlier may hold 5.2. The suite passes on both, but pin the versions if that drift matters.

## Frontend/backend seam

`/` (the Posts feed), `/books`, `/projects` and each one's `/…/:slug` detail route render live data from `GET /api/posts/`. The CV and About pages are the only hardcoded copy left.

**There is no `/garage` page.** `Post.Category.GARAGE_SALE` is still a valid backend category — the admin console can still file a post under it — but nothing public links there any more; the page, its route, and its nav item were deleted. `VISIBLE_CATEGORIES` in `posts.ts` (`posts`, `books`, `projects`) is the list every cross-category view filters to, so a stray `garage_sale` post can never end up linked from a page that no longer exists. Filter with `isVisible(post)` rather than testing a single value: a post filed under both `garage_sale` and `projects` does have a page, and only one filed *solely* under `garage_sale` should be dropped.

**The Posts page at `/` is the odd one out: it browses every visible category, not just its own.** `/books` and `/projects` are still single-category pages built on `PostList` + `usePosts`, exactly as before. `Posts.tsx` instead has its own filter bar — a category select defaulting to "All categories", plus "From"/"To" `<input type="date">` fields for an inclusive date range — and numbered `Pagination` instead of a "Load more" button; see `usePaginatedPosts.ts` and `Posts.tsx`. **Every filter change resets `page` to 1**, since page 3 of an unfiltered list is usually past the end of a filtered one. The same two date fields sit in the admin console's filter row (`AdminConsole.tsx`, threaded through `useAdminPosts`). They are native date inputs rather than a picker component: they carry their own calendar and locale formatting, and hand back the `YYYY-MM-DD` string the API wants. Both force `slotProps={{ inputLabel: { shrink: true } }}`, because the browser paints its own `mm/dd/yyyy` placeholder in an empty field and an unshrunk floating label would sit on top of it.

No HTTP client dependency anywhere — `fetch` plus a handful of hooks:

- **`src/services/posts.ts`** — types mirroring `PostSerializer`, plus every fetch function: `fetchPosts(category, signal)` (one category), `fetchPost(slug, signal)` (one post, for a detail page — throws `PostNotFoundError` on a 404 so a "not found" state is distinguishable from a real error), `fetchPostsPage({category, page, after, before}, signal)` (one numbered page; category and the inclusive `YYYY-MM-DD` date bounds all optional), `recordPostView(slug, signal)` (POSTs the read counter, returns the new total), and the shared `fetchPostPage(url, signal)` they all funnel through. Also `CATEGORY_LABELS`, `CATEGORY_ORDER` (the one display order, mirroring the model's declaration order — anything building its own list of categories uses it so the badges cannot come out in a different order than the form's checkboxes), `VISIBLE_CATEGORIES`, `isVisible` and `CROSS_CATEGORY_BASE_PATH`.

  **`CROSS_CATEGORY_BASE_PATH` is always `/posts`, and replaced a per-category route map.** A post can be in several sections and none outranks the others, so picking one would be inventing a primary category. It costs nothing: `PostDetail` looks posts up by slug alone and the route prefix only supplies the "back" link, so `/posts/x` reaches the identical page `/books/x` would. A card *on* a section page still uses that section's path, so "back" returns you where you came from.
- **`src/services/usePosts.ts`** — one category, loading/error/empty/populated, appends pages via `loadMore`. Used by `Books`/`Projects`.
- **`src/services/usePost.ts`** — one post by slug, for a `PostDetail` page; adds a `not-found` phase on top of the usual three.
- **`src/services/useRecordView.ts`** — counts one read of the loaded post and returns the total for `PostDetail` to render (the post's own `view_count` until the endpoint answers, since the GET happened before the increment). **Deliberately the one request in the app that is not aborted on unmount** — the read already happened, so only the state update is skipped. Repeat reads are suppressed by a `viewed:<slug>` key in `sessionStorage`, written *before* the request so React's double-invoked development effect cannot count twice; every touch of `sessionStorage` is try/caught because it throws outright in some privacy modes. A failed record is swallowed: a counter is not worth an error banner over.
- **`src/services/usePaginatedPosts.ts`** — one numbered page, category and date range optional; backs `Posts.tsx`. The date bounds are two separate string arguments rather than one object, for the same reason `useAdminPosts` takes its filters apart: a fresh object literal every render would re-trigger the effect forever. When no category is given it drops posts filed *only* under `garage_sale` client-side, so `count`/`totalPages` can run slightly high if any such post exists — not worth a backend change for a category the site no longer surfaces.
- **`src/services/adminStats.ts` / `useAdminStats.ts`** — the one call to `GET /api/posts/stats/`, backing both `AdminOverview` and `AdminStats`. `fillMonths` inserts the empty months the API leaves out and windows the result to the most recent twelve: without it a gap year reads as a busy one, since three bars for 2024, 2025 and 2026 sit side by side looking like three consecutive months. It counts back from the newest month rather than forward from the oldest, so a long history loses its distant past and not its current month.
- **`src/components/admin/MonthlyBars.tsx` and `StatTile.tsx`** — the statistics page's two visual pieces, both plain `Box`es on theme tokens. No charting library: this is a dozen rectangles and a baseline, and the smallest dependency would outweigh the feature. Points worth keeping: one series means one colour (`primary.main`, which differs per scheme) and no legend; bars are capped at `MAX_BAR` so a short history does not stretch into slabs; an empty month draws a 2px floor in `divider`, because a zero-height bar is indistinguishable from one the chart forgot; only the peak is direct-labelled, with the rest reachable by tooltip **and** by the "Show as a table" twin, so no value is hover-gated; and the tile values use proportional figures while the tables use `tabular-nums`, since only the latter are columns that must line up.
- **`src/services/uploads.ts`** — `uploadImage(file, signal)` against `POST /api/uploads/images/`, plus `ACCEPT_ATTRIBUTE` and `MAX_UPLOAD_BYTES`, which mirror `ALLOWED_FORMATS` and `MAX_UPLOAD_SIZE` on the backend. Those client-side checks are a courtesy that avoids a pointless round trip; **the server re-checks the bytes, and that is the check that counts.** Used by both `CoverImageField` and the editor's image button.
- **`src/components/PostList.tsx`** — renders the four states for a single-category page; also exports `PostCard` so `Posts.tsx`'s all-categories view can reuse the same card without a second implementation. **Needs an unbroken `flex: 1` chain from `<main>`**, which is why every page using it makes its `Container` a flex column; without it the loading spinner and the empty placeholder stop being vertically centred. `src/components/Centered.tsx` is that centring wrapper, shared by `PostList`, `PostDetail` and `Posts`. `PostCard` renders `cover_image_url` when a post has one — a leading 120px square at `sm`+, full-width on top at `xs`, where 120px of thumbnail would leave the title no room — and is unchanged for posts without one. `PostDetail` renders the same image full-width under the category chip. Both pass `cover_image_alt` straight through, so a blank one correctly marks the image decorative rather than repeating the title a screen reader has already read.

`API_BASE_URL` is `import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api"`, typed in `src/vite-env.d.ts` and documented in `.env.example`. Trailing slashes are stripped, because `//posts/` earns an `APPEND_SLASH` redirect instead of a response.

Points worth keeping intact:

- **An aborted request is not an error.** Every fetch takes an `AbortSignal`; the effect cancels on unmount and on a category change, and both the client and the hook check `isAbort` before reporting anything. Skip that and a fast navigation logs a spurious "Could not reach the API", or a resolved request writes state into an unmounted component.
- **`fetch` rejects identically for a dead backend and a CORS failure** — the browser only ever says `Failed to fetch`. `posts.ts` rewrites that into `Could not reach the API at <url>. Is the backend running?` with a Retry button, because the raw message tells nobody anything.
- **The empty state is the old `Coming soon...` typewriter.** A section with no posts looks exactly as the page did before it was wired, so publishing the first post is what changes the page.
- **`CORS_ALLOWED_ORIGINS` must list whatever origin serves the SPA.** Defaults cover `:5173` (dev), `:4173` (preview) and `:8080` (nginx container); a deployed site needs its real origin added or every response is discarded by the browser.
- **`api.ts` sends `FormData` untouched and must not name its `Content-Type`.** The header carries the multipart boundary, which only the browser knows; setting it by hand — even to the apparently correct `multipart/form-data` — produces a boundary-less header that Django parses as an empty request, so the upload arrives with no file and fails validation. Everything that is not `FormData` is still JSON-serialised as before, which is why a post write stays a plain JSON request even though its cover came from an upload.

## Deployment

`DEPLOY.md` in the repository root is the plan: a Proxmox VM, both compose stacks, and a Cloudflare Zero Trust tunnel as the only way in. Three things there constrain how this code may change.

**Each half has a `docker-compose.prod.yml`, layered over its base file and never used alone:**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

They carry no secrets — every value is `${VAR:?message}`, interpolated from a gitignored `.env` beside them, so a missing one stops the deploy instead of shipping a development default. Compose **appends** list-valued keys when merging, so overriding a port needs `ports: !override` (otherwise both bindings survive and the second fails with "port is already allocated"), and dropping the `api` service's `.:/app` source mount needs `volumes: !reset []`.

**`VITE_API_BASE_URL` is a build argument, not a runtime setting.** Vite resolves `import.meta.env` when the bundle is built, so the frontend Dockerfile takes it as an `ARG` (defaulting to the localhost value, which keeps a plain `docker build .` unchanged) and the prod compose file passes it through `build.args`. Changing the API address is a rebuild. Note `docker compose up --build` has no `--build-arg` flag — only `docker compose build` does — which is why it lives in the file rather than in a command.

**A third override, `docker-compose.external-db.yml`, swaps the bundled `db` service for a Postgres elsewhere on the network.** A service cannot be deleted by an override file, so `db` is hidden behind a `local-db` profile and `api`'s `depends_on` is rewritten with `!override` — the base file waits on `db: service_healthy`, and Compose refuses to run with that reference dangling. Nothing replaces the wait, so `restart: unless-stopped` is what recovers when `migrate` reaches a database that is still booting. `DATABASES['default']['OPTIONS']` picks up `POSTGRES_SSLMODE` / `POSTGRES_SSLROOTCERT`, each added only when non-empty so the bundled setups connect exactly as before; that override defaults the mode to `require` rather than libpq's `prefer`, which falls back to plaintext without complaint and so cannot fail.

**Static files are WhiteNoise's, and only under `DEBUG=0`.** There is no nginx in front of the API — the tunnel goes straight to gunicorn — so nothing else can serve Django admin's and DRF's CSS. `STORAGES['staticfiles']` is `CompressedManifestStaticFilesStorage` when `DEBUG` is off and the plain backend when it is on, because manifest storage cannot resolve a `{% static %}` tag until `collectstatic` has run and a bare `manage.py runserver` / `manage.py test` outside Docker never runs it. `SECURE_PROXY_SSL_HEADER` is likewise gated behind `USE_X_FORWARDED_PROTO`: trusting a header the client can send is only safe when nothing reaches the process except through the proxy.
