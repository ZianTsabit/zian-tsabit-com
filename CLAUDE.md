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
3. An entry in the `navItems` array in `src/components/Header.tsx` — that one array feeds both the desktop nav and the mobile `Drawer`, so adding it in one place covers both. The "Zian Tsabit" logo `Link` also routes to `/`, which is the blog feed itself; `navItems` names it "Blog" anyway, so a visitor deep in the site does not have to guess that the logo is the way back to the list.

**There is no separate home page.** `/` renders `Blog` (`src/pages/Blog.tsx`) — `src/pages/Home.tsx` and its "Latest Updates" feed were deleted rather than left as a landing page above the feed. `/posts` is kept as a `<Navigate to="/" replace />` because links and bookmarks to it exist, and the detail route `/posts/:slug` still renders normally. `PostDetail` at that route takes `backTo="/"` and `backLabel="Blog"`.

**The page is called Blog; its URLs deliberately did not move with the name.** It was `Posts` until the category enum went away, and "Posts" only ever made sense as the name of one of four sections. Renaming `/posts/:slug` to `/blog/:slug` would have broken every link ever shared for the sake of a label, so the component and the nav changed and the routes did not.

**There is no `/projects` page.** It listed one hardcoded category and went with the enum in `0009`; browsing by tag on `/` replaced it. `PostList` went with it — its only other caller was the Books page, which is now the catalogue — so what survives is `components/PostCard.tsx`, the entry `Blog` maps over.

**An admin page is different: it goes under the `/admin` route and into `AdminNav`, never into `navItems`.** `/admin` is a shell (`Admin.tsx`) whose children are `AdminOverview` (index), `AdminConsole` (`posts`), `AdminBookConsole` (`books`), `AdminCommentConsole` (`comments`), `AdminStats` (`stats`) and the four editors — two for posts, two for books, with the book ones under `books/new` and `books/edit/:slug` because `edit/:slug` at the top level is already the post editor's — nested so the session is checked once for all of them, and so `AdminNav` is mounted beside the `<Outlet>` and survives navigation between sections rather than remounting. The `items` array in `AdminNav.tsx` is the one place a section is listed; it feeds the `md`+ left column and the phone row alike. **Its post section is labelled "Blog", matching the public nav, while everything inside it still says "post"** — "New post", "Edit post", "No posts match this filter". The section is the blog; the things in it are posts, and the `Posts` stat tiles on the overview and statistics pages count those, so they keep the plural noun rather than becoming a nonsensical `Blog: 12`. The route stayed `/admin/posts` for the same reason the public `/posts/:slug` did — a rename is not worth invalidating a bookmark over. Note the `end` prop on the Overview link: `NavLink` matches by prefix, so without it `/admin` would stay highlighted on every child route.

**The header does show one `Admin` link, and only to the owner.** `Header.tsx` appends `ADMIN_ITEM` to its map when `useAdminHint()` is true; it stays out of `navItems` itself, so that array remains the list of pages every visitor has. This is the door, not a second copy of the menu behind it — a new admin *section* still goes in `AdminNav` and nowhere else.

**The hint is a `localStorage` flag, not a session request** (`ADMIN_HINT_KEY = "admin-session"` in `services/auth.ts`). The header renders on every route, so calling `/auth/session/` from it would put a credentialed round trip on every visitor's first paint to answer a question that is "no" for everyone but the owner — the exact cost `auth.ts` was written to keep off the public side. `useSession` writes the flag every time it learns the answer: on the mount check, on login, on sign-out. **Nothing is unlocked by setting it** — every `/admin` route still mounts `Admin` and checks the real session, and the API refuses an unauthenticated write regardless, so a forged flag buys a link to a login form. It can only go stale one way, a cookie expiring server-side while the flag still says yes, and that heals itself: following the link runs the real check, which comes back signed-out and clears the flag on its way to the login form. `useAdminHint` is a `useSyncExternalStore` over a listener set **plus** the `storage` event, because that event fires in *other* tabs only — without the set, signing out would leave this tab's own header advertising the session it just ended.

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

`theme.ts` also carries the one component override on the site: **`MuiButton` sets `textTransform: "none"`**. Material capitalises every button label, and nothing else here does — not the nav, not the headings, not the wordmark — so a button was the only thing on a page shouting. It lives in the theme rather than on each button because one sentence-case action beside an uppercase one reads as a mistake; a per-button fix produces exactly that.

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

A child that should soak up leftover vertical space needs an unbroken `flex: 1` chain down from `<main>` — this is why every page rendering a feed makes its `Container` a flex column, so the list (and the centred loading/empty states inside it) can grow instead of pinning a fixed `30vh` that pushed the page just past the viewport on a phone.

Pages are built from `Box`/`Container`/`Stack` with inline `sx` — no CSS modules, no styled-components except `Typewriter`. Existing pages follow one of two shapes; copy the closer one:

- **Content page** (`CV`, `About`, `Books`): `Box` with `flex: 1`, `bgcolor: "transparent"`, `pt: { xs: 2, sm: 3 }`, wrapping a `Container maxWidth="md"`. Don't add bottom padding for breathing room — the footer's top border now terminates the page.
- **List page** (`Blog`, `Books`): `bgcolor: "background.default"`, a `Container maxWidth="md"` with `py: { xs: 4, md: 6 }`. `Typewriter text="Coming soon..."` only ever appears now as the *empty state* a feed renders when it has nothing published — not as page content a page author writes. Note `Books` distinguishes that from "your filter matched nothing", which is the visitor's own doing and says so in plain text; the typewriter is for a genuinely empty shelf.

Use `Container` (or explicit `px`) rather than a bare `maxWidth` on a `Box` — `Container` supplies the responsive side gutters that keep text off the screen edge on phones.

### Responsive conventions

Responsive values use the MUI breakpoint object form (`{ xs: "12px", sm: "14px", md: "16px", lg: "22px" }`, `direction={{ xs: "column", sm: "row" }}`) rather than media queries. Two rules the existing code now follows:

- **Justified text is `sm`-and-up only** — `textAlign: { xs: "left", sm: "justify" }`. A justified ~35-character phone line opens visible rivers of whitespace.
- **Nothing may widen the page.** `html, body` carry `overflow-x: clip` as a backstop, but that only hides the symptom. **`clip`, not `hidden`, and the difference matters:** `hidden` makes the element a scroll container, which silently disables `position: sticky` anywhere on the page — a since-removed sticky heading on the old home page rendered but never stuck until this was changed, and the Posts page's sticky filter bar depends on it today. If a block genuinely needs a fixed minimum width, give it its own `overflowX: "auto"` container so it pans inside its box while `document.scrollWidth` stays equal to the viewport.

### Component notes

- `Header.tsx` owns everything in `sx` — there is no longer a `Header.css`. A scroll listener flips `isScrolled` past 50px, which swaps `bgcolor` between `transparent` and `palette.headerScrolled` under a `background-color` transition. It had to move out of CSS because a hardcoded `rgba(0,0,0,0.85)` cannot follow the colour scheme.
- `Footer.tsx` is copyright plus LinkedIn/GitHub/Email. It uses `@mui/icons-material` icons rather than the CDN devicon images the CV header uses, so the glyphs take `currentColor` and follow the theme instead of staying fixed-colour.
- `CoverImageField.tsx` is the post form's lead-image control: upload button, preview, remove, alt text, **and an editable URL field**. The URL stays visible rather than hidden behind the picker because an image already hosted elsewhere is a perfectly good cover, and there is no reason to force a re-upload to use one. It tracks a `broken` flag off the preview's `onError` so a URL pointing nowhere says so, instead of showing the browser's broken-image glyph unexplained.
- **`admin/ActionButton.tsx` is every action in the admin** — New post, Save as draft, Publish, Edit, Unpublish, Delete. Use it rather than `<Button>` for a new one. They were six different-looking controls doing the same kind of thing (a filled Publish, a grey Save, a blue Edit, a red Delete, two sizes between them), which made the admin look assembled rather than designed. The style is the site's own: a **text link — no surface, no border, no shadow**, since the site has none of those anywhere. What keeps it reading as an action is the 600 weight plus an underline on hover and focus; `px: 0.5` keeps the label flush with the column edge, like `Sign out` in `AdminNav`; and the tinted wash a text button paints on hover is cancelled, because it would put back the surface the style exists to avoid.
  - **Emphasis is position, not decoration.** No variant is louder than another, so a page's primary action is simply last in its row — which is where Publish already was as the filled one.
  - **`tone` changes the colour and nothing else** — size, weight and geometry are identical across all three, and the focus ring follows via `currentcolor`. `primary` is the default; `danger` (`error.main`) is Delete, which stays in the set while still being the one action you cannot take back (the confirmation dialog is what actually guards it); `neutral` is Save as draft, and Unpublish — the post list's one toggle button takes its tone from its label (`published ? "neutral" : "primary"`), so taking a post down is ink and putting one up is the same primary colour Publish carries in the editor. **`neutral` is `text.primary`, not a black literal** — near-black on the light scheme, bone white on the dark one, where a hardcoded black would be an invisible button.
  - `admin/NewPostButton.tsx` is a thin wrapper adding the leading `+`, shared by the overview and the post list because the two rows differ only in where they navigate — a restyle of one would otherwise silently miss the other.
- `SectionHeading.tsx` and `TagChip.tsx` (with its `TagChipRow` export) are shared by the CV and About pages — they were duplicated inline before, so both pages drifting apart was a matter of time. Reuse them rather than restyling a heading or pill locally.
- `TimelineItem.tsx` renders one LinkedIn-style entry: an absolutely positioned dot plus a `&::before` rail that runs from under the dot to the bottom of the entry, so consecutive items join into one continuous line. Pass `last` on the final entry of a section to suppress the trailing rail. Title and date sit on one row at `sm`+ and stack at `xs`.
- `Typewriter.tsx` is the one emotion `styled()` component. Width is driven by a `--characters` CSS custom property computed from `text.length`, typed via `interface CustomStyles extends React.CSSProperties`; the animation loops forever, so it reads as a placeholder, not a one-shot reveal.
- **`@mui/joy` was removed; don't add it back.** Joy and Material read the same theme context, so a Joy component under the Material `ThemeProvider` crashes the whole app with `Cannot read properties of undefined (reading 'xl')` — a blank white page, not a degraded one. Joy also has its own independent colour-scheme system, so it would never follow the light/dark toggle. `Header.tsx` used Joy's `List`/`ListItem`; those are now plain `Box component="ul"/"li"` with the menubar roles kept. `@mui/material` is the only component library.

### Markdown

Post bodies are Markdown. `src/components/Markdown.tsx` renders them and is the **only** place that should — the admin's Preview tab renders through the same component as the published page, which is what stops the preview from drifting away from the real output.

- **Raw HTML is not rendered.** `react-markdown` ignores it unless `rehype-raw` is added; leave it out. Bodies are stored and replayed verbatim, so a `<script>` in one should stay text.
- **Headings are demoted one level** — a `#` becomes an `<h2>`, because the page already spends its `<h1>` on the post title. Visual size still follows what was typed.
- **`remark-breaks` is load-bearing.** Bodies written before Markdown existed were rendered with `whiteSpace: "pre-line"`; without this plugin every one of them silently reflows into a single paragraph.
- **Wide blocks scroll in their own box.** `<pre>`, `<table>` and `.katex-display` carry `overflowX: auto` — see the "nothing may widen the page" rule above. KaTeX ships no overflow of its own, so a wide equation would otherwise put a scrollbar on the whole document; the display rule pairs it with `overflowY: hidden`, or the horizontal scrollbar's height triggers a second vertical one on tall glyphs.
- **LaTeX is `remark-math` + `rehype-katex`**: `$x^2$` inline, `$$…$$` as a centred block. Four things there are deliberate:
  - **`remark-math` must sit before `remark-breaks` in the list**, and it works because it is a *parser* extension rather than a transformer: maths becomes its own node at tokenise time, so `remark-breaks` never sees the newlines inside a multi-line `$$` block and cannot litter it with `<br>`s.
  - **`$` is syntax now.** A body about money needs `\$5`, or the `$5` and the next `$` on the line are read as one expression. Nothing published contained a `$` when this shipped, which is what made single-dollar inline maths safe to enable; if that changes, `remark-math` takes `{ singleDollarTextMath: false }` and `$$…$$` still works inline.
  - **`trust: false` and no `rehype-raw`, together.** `\url`, `\href` and `\includegraphics` are what would quietly undo this file's "raw HTML is text, never markup" rule through a macro. `throwOnError: false` is what keeps the admin's Preview tab showing a half-typed expression in red instead of a blank pane.
  - **KaTeX is loaded on demand, and `src/components/mathPlugins.ts` exists only to be that chunk.** It is ~276 KB of JS plus 30 KB of CSS (~91 KB gzipped together), which is a lot to hand every visitor of a site where most posts are prose — so `Markdown.tsx` reaches it through `import()`, and only when the body contains a `$`. **Nothing may import that module statically**: one ordinary `import` anywhere folds it back into the main chunk and undoes the split, with no error and no symptom but the bundle size. (Its `import type { Options } from "react-markdown"` is safe — type-only imports are erased.) The build output is the check: the main chunk is 853 KB where it was 840 KB before maths existed, and the feed loads no maths chunk at all, because `toPlainText` strips the maths before a card ever reaches `Markdown`.
  - **The load is cached at module scope, not in component state**, so it is paid once per page load rather than once per `Markdown`: the second post a reader opens finds it ready and renders synchronously. A `failed` flag is the other half — without it a chunk that never arrives (a blip, a stale `index.html` naming a hash that no longer exists) would leave the body blank for good. Set, the render falls through to plain Markdown and the post appears with `$x^2$` as literal text, which is the degradation worth having. Verified by deleting the chunk out of `dist/` and reloading.
  - **A body containing a `$` renders nothing until the chunk lands**, rather than rendering without it and swapping. Both waits are short and only the first one happens at all, but they fail differently: an empty region for 50ms goes unnoticed, where a paragraph of raw `\frac{a}{b}` reflowing into set maths is a visible flash and a layout shift.
  - **`katex` in `package.json` must stay on the major `rehype-katex` renders with, today `^0.16`.** The dependency exists only to be that stylesheet — nothing imports the library — and `rehype-katex` resolves its *own* copy for the markup, so bumping this one alone does not upgrade the renderer, it just pairs one version's CSS with another version's HTML. That is not a cosmetic mismatch: 0.18 dropped the `.katex .base { display: inline-block }` rule its own markup no longer needs, which left 0.16's bases as plain inline boxes whose struts no longer sized the line. Display maths then reported a box shorter than the glyphs in it, and `overflowY: hidden` below sliced the top off anything tall — a `\frac` inside a superscript lost its numerator. Both copies deduped to one after the pin, which is the state to keep: two `katex` directories under `node_modules` is the symptom.
  - **KaTeX's CSS rides with the chunk and is self-hosted.** Not the CDN `<link>` its docs lead with: Vite resolves the `url()`s against `katex/dist/fonts/` and emits them into `dist/assets/`, which is where `nginx.conf` serves from — so maths needs no third-party request, and a page pulls only the two or three woff2 faces it actually uses. The error colour is `var(--mui-palette-error-main)`, a theme token through MUI's CSS variables rather than the hex KaTeX defaults to, since KaTeX wants a CSS colour string and `theme.ts` is the only place a colour is written.
- `toPlainText()` treats the two maths forms differently, because they read differently as text: a **display block** is a standalone equation whose source is unreadable on a card, so it is dropped; **inline** maths is usually a symbol or two inside a sentence, and dropping it would delete that sentence's subject, so its source is kept. Display is matched first, or `$$` would be read as an empty inline expression. It also unwraps `\$` back to `$` — the one escape it handles, since `$` is the only character these rules made special.
- `toPlainText()` (in `src/components/markdownText.ts`) flattens Markdown for card previews, which fall back to the body when a post has no excerpt. It is regex, not a parse, on purpose: the output is a clamped teaser. It sits in its own module rather than in `Markdown.tsx` because a file exporting both a component and a plain function breaks Fast Refresh, and `react-refresh/only-export-components` fails `npm run lint` on it.

The editor is `src/components/admin/MarkdownEditor.tsx` (Write/Preview tabs, toolbar, shortcuts) over the pure transforms in `markdownCommands.ts`. **`toggleMath` is deliberately the same shape as `toggleCode`** — one delimiter inline, a fence across lines — because the two are the same gesture, and an author who has learned what the code button does with a multi-line selection should not have to learn something else for maths. Three things there are deliberate and easy to break:

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

### The book catalogue (frontend)

`/books` is its own stack, parallel to the post one and deliberately shaped the same so the two cannot drift in how they save:

| Posts | Books |
| --- | --- |
| `services/posts.ts` | `services/books.ts` |
| `services/usePaginatedPosts.ts` (plus `useTags`) | `services/useBooks.ts` (plus `useGenres`, `BOOKS_PAGE_SIZE`) |
| `services/usePost.ts` | `services/useBook.ts` |
| `services/adminPosts.ts` | `services/adminBooks.ts` |
| `services/useAdminPosts.ts` | `services/useAdminBooks.ts` |
| `components/PostCard.tsx` | `components/BookCard.tsx` |
| `components/admin/AdminPostList.tsx` | `components/admin/AdminBookList.tsx` |
| `components/admin/PostFormFields.tsx` | `components/admin/BookFormFields.tsx` |
| `components/admin/AdminConsole.tsx` | `components/admin/AdminBookConsole.tsx` |
| `pages/AdminNewPost.tsx` / `AdminEditPost.tsx` | `pages/AdminNewBook.tsx` / `AdminEditBook.tsx` |

What is genuinely shared rather than duplicated: `useAutosave`, `useWriteQueue`, `api.ts`, `CoverImageField`, `MarkdownEditor`, `Markdown`, `toPlainText`, `TagChip`, `Centered`, `ActionButton`, `Typewriter`, and `publicRequest` — which is `posts.ts`'s error-normalising `fetch` wrapper, **exported for `books.ts` rather than copied**, so "Could not reach the API at …" is worded in one place.

Points worth keeping intact:

- **`BookCard` is a grid cell, not a row.** A shelf is scanned by cover, so the jacket leads and every card is a 2:3 plate — the shape of a paperback, so a row of them reads as spines rather than as thumbnails at whatever aspect ratio each scan happened to be. **A book with no cover renders its own title on the plate** rather than collapsing, which keeps the grid rows aligned; a generic placeholder glyph would carry less information than the title it replaced.
- **The catalogue's search box is debounced by 300ms into a second piece of state.** `typed` is what the input shows, `search` is what has been asked for. Without the split every keystroke is a request and an aborted one, and the input would re-render from the fetch rather than from the key that caused it. The admin console does the same.
- **`useGenres` fetches once on mount and is never refreshed**, and a failure is swallowed into an empty list rather than reported — the genre filter is a convenience, and losing it is not worth an error banner over a catalogue that loaded fine. The select is only rendered when the list is non-empty, since a dropdown whose one option is "All genres" is a control that does nothing.
- **The catalogue has two empty states and they mean opposite things.** A filter that matched nothing says so plainly; an empty shelf gets the `Typewriter text="Coming soon..."` this page shipped with.
- **`BookDetail` has no view counter**, because `/api/books/` has nothing to count. It leads with the facts column rather than running straight into the review: which book this is has to be established before anyone's opinion of it is worth reading.
- **`BookDraft.release_year` is a string, not a number** — an `<input>` holds a string, and `""` is how "no year" is typed. `payload()` is what turns it into the `null` the API wants, and it sends that `null` **explicitly rather than omitting the key**: on a PATCH an absent key means "keep the year you have", so clearing the field would otherwise silently do nothing.
- **Autosave on the book editors is off until there is both a title *and* an author**, where the post editor only needs a title. The API requires both, so a write missing either is a 400 rather than a draft — and retrying that every three seconds would be an error banner for a form that is merely half-filled.
- **`AdminEditBook` tracks `status` in state, not in the draft.** The form has no status control (same as the post editor — status is whichever button ends the form), so autosave needs somewhere to read the entry's existing status from in order to write it back unchanged. Putting it in `BookDraft` would make it a field the form could disagree with.
- **`slugToSend` in `AdminNewBook` tests `^base(-.+)?$`, not `^base(-\d+)?$`.** `Book.save()` disambiguates a taken title with the *author* before falling back to a number, so an entry sitting at `ulysses-james-joyce` is already as close to its title as it can get; the post editor's numeric-only pattern would ask for `ulysses` again every three seconds and be refused every time.
- **Both book lists count pages with `BOOKS_PAGE_SIZE`, never `PAGE_SIZE`.** The catalogue's page is 12 where the rest of the API's is 20 (see "The Book model"), so a hook importing the site-wide constant renders a pager with pages that do not exist. `useComments`, `usePaginatedPosts` and the two post/comment admin hooks correctly still use `PAGE_SIZE`.
- **`AdminBookConsole` uses `ActionButton` directly rather than `NewPostButton`**, which hardcodes its label. "New post" on the books page would be wrong in the one way nobody rereads.

### Comments and reactions (frontend)

`PostDetail` ends with two sections in rising order of effort — one tap, then a
paragraph — both handed `post.slug` rather than the route's `:slug` param, since
a post reached by an old URL is served under its current slug and both writes
have to land on the row the page is showing.

| | |
| --- | --- |
| `services/comments.ts` / `useComments.ts` | the public thread and its submit |
| `services/reactions.ts` / `useReactions.ts` | the emoji bar |
| `services/visitor.ts` | the browser's opaque reaction token |
| `services/adminComments.ts` / `useAdminComments.ts` | moderation, credentialed |
| `components/CommentSection.tsx` + `CommentForm.tsx` | thread above, box below |
| `components/ReactionBar.tsx` | the row of buttons |
| `components/admin/AdminCommentConsole.tsx` + `AdminCommentList.tsx` | `/admin/comments` |

Points worth keeping intact:

- **`publicRequest` merges the caller's headers rather than replacing them.** It
  used to hardcode `{ Accept }` *after* spreading `init`, which silently dropped
  a `Content-Type` — fine while every public call was a GET, wrong the moment
  `createComment` had a body.
- **The thread is above the form.** That is the order the page is used in, and
  it puts the newest comment — oldest-first ordering, so the last one — directly
  above the box that just posted it.
- **A successful submit re-fetches; it never splices the draft in.** The stored
  row differs from what was typed (the name is collapsed, the body trimmed), and
  a thread showing the draft would disagree with itself on the next load.
  `useComments` then lands the reader on the page their comment is actually on,
  which it works out **in the fetch's `then`** — the count it needs is the one
  that response carries, and before the fetch there was no way to know it.
- **The form keeps the name and clears the body.** Someone commenting twice on a
  post is the same person both times.
- **`ReactionBar` renders what the API sent** — the emoji, their order and their
  labels all come down with the counts. Adding an emoji is one edit on the
  server. The `aria-label` is the label, never the glyph, because a screen
  reader reads U+2764 as "heavy black heart"; `aria-pressed` is what says this
  is a toggle you already used.
- **The bar swallows its errors and the thread reports them.** A failed reaction
  fetch looks exactly like one still loading, because an error banner over a
  post that loaded fine — because seven emoji did not — is the wrong thing to
  put on the page (same call as `useTags`/`useGenres`). A failed *thread* is
  reported, because a visitor about to reply has to know the conversation failed
  to load rather than being empty.
- **The toggle is not optimistic.** A bar that flips instantly and then flips
  back on a failure is worse than one that takes a moment; the buttons hold
  while a write is in flight, since the hook deliberately runs one at a time.
  Like `useRecordView`, neither the toggle nor the comment submit is aborted on
  unmount — the write already happened, and only the state update is skipped.
- **`ReactionButton` is a pill, not a filled button**, matching `TagChip`; a
  reaction the visitor left is marked the way a published post is in the admin
  list — primary colour on the border and the number, not a fill. The `Tooltip`
  wraps a `span` because MUI attaches its listeners to the child and a disabled
  button fires none.
- **`CommentForm` uses a real `<Button>`, not the admin's `ActionButton`.** That
  component is the admin's own language, where every action is a text link in a
  row of them; this is the one thing a visitor is asked to do on the page and
  has to look like a control a stranger recognises.
- **`PostCard` shows the comment count only when there is one.** A "0 comments"
  on every entry of a young feed is a column of zeros saying nothing.
- **The two switches live in `PostDraft`, not beside it.** Unlike `status` —
  which is whichever button ends the form — they are fields the form owns, so
  autosave carries them like any other edit and `emptyDraft()` starts both
  `true` to match the model. `PostFormFields` groups them under a "What
  visitors can leave" heading; a stray "Comments" toggle between Tags and
  Published at would read as another field of the post rather than a setting
  for it.
- **`PostDetail` decides what to render, `CommentSection` only takes `enabled`.**
  No bar at all when reactions are off; the thread but no form when comments
  are closed; and the whole comments section disappears in exactly one case —
  a closed post with no comments — since a heading over "Comments are closed"
  is a section saying nothing. The dividers between the two are conditional on
  the same flags, so neither can strand.
- **`AdminPostList` chips a switch only when it is *off*.** Both default on, so
  "Comments on" on every row would be a column of noise marking the ordinary
  case; what is worth spotting from a list is the post that behaves
  differently.
- **`/admin/comments` has no editor route and no "new" button.** A comment is
  the visitor's; the only things the owner has over one are hiding it and
  removing it, both on the list itself. It defaults to newest-first, the
  opposite of the public thread: what the owner opens the page for is whatever
  arrived while nobody was looking. Its delete dialog names hiding as the
  reversible alternative.

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

`myapp` is installed and serves four resources: a DRF `ModelViewSet` over `Post`, another over `Book`, a third over `Comment`, and an image upload endpoint they share. `Reaction` has no viewset of its own — it is an action on a post. `requirements.txt` is `Django>=4.2` and `djangorestframework>=3.16`, plus `django-storages[s3]` and `Pillow` for uploads, and `gunicorn` + `whitenoise` for the production container (see "Deployment" below). **Database is Postgres, with no sqlite fallback anywhere** — an object-storage compose file existed alongside an earlier Postgres setup and was removed in `29dd34b`; both came back, Postgres via `psycopg[binary]` and the `db` service, object storage via the `rustfs` service (see "Object storage" below — this was MinIO until `10cb53a` swapped it for RustFS, which touched only compose and settings, no Python). `settings.py`'s `DATABASES` reads `POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_HOST`/`POSTGRES_PORT`, defaulting to `zian_tsabit_be`/`zian_tsabit_be`/`postgres`/`localhost`/`5432` — those defaults resolve inside Docker (`POSTGRES_HOST=db` there) but a bare `manage.py runserver` needs its own reachable Postgres server; there is deliberately no zero-setup fallback, so `createdb zian_tsabit_be` (or a matching role) is a prerequisite, not optional. See `ziantsabit-be/.env.example`.

### The Post model

`Post` is the content model for everything the site publishes as *writing*, and it replaced the earlier `Book` / `Project` / `GarageSale` / `Update` models — four near-identical title-plus-fields tables for what is one feed. `migrations/0001_initial.py` creates only `myapp_post`; the old models never had a migration, so there is nothing to clean up if you go looking for their tables. (`PostViewDay`, added in `0007`, is bookkeeping about posts rather than a kind of post. `Book`, added in `0008`, is the one genuinely separate content model — see "The Book model". `Comment` and `Reaction`, added in `0011`, are what *visitors* leave on a post rather than anything the owner writes — see "Comments and reactions".)

**There is no `categories` column, and no `Post.Category` enum.** `0009` dropped both. The fixed enum and the free-form `tags` list beside it were doing the same job, and the enum was doing it worse: adding a section meant a migration, a post could only ever be filed under one of four things, and every consumer — the API, the admin sidebar, the SPA's filter bar, the post form — had to understand both mechanisms. **A post is labelled with `tags` and browsed with `?tag=`; that is the whole filing system.**

**Nothing meaningful was thrown away.** `0009` copies each post's sections into its tags as display labels (`projects` → `"Projects"`, `garage_sale` → `"Garage Sale"`) before dropping the column, so a post that was in the projects section is still found by `?tag=projects` — the filter is case-insensitive. The migration carries its own copy of the enum rather than importing it, since `Post.Category` no longer exists, and appends rather than prepends so the tags an author actually typed keep leading the list.

**`0010` then strips `"Posts"` back off, and the two are a pair.** `posts` was the section almost everything carried — it was the default, and the one the feed is named after — so as a tag it says nothing: a label on every post cannot tell posts apart, and it led the filter dropdown offering to narrow the feed down to the whole feed. It is matched case-insensitively, so a `"posts"` someone typed by hand goes too.

**Why a second migration rather than an edit to `0009`.** The tag mostly does not exist yet: it only appears where `0009` has run, so a database migrated later would gain it on deploy and keep it, and a one-off `UPDATE` against an already-migrated database would miss that entirely. Running immediately after `0009` is what makes the pair correct on both. Squashing them would also mean editing an applied migration, which makes two databases disagree about what has already run. `0010` has a noop reverse: nothing records which posts carried the tag, so putting it back on all of them would be inventing data — and it round-trips acceptably anyway, since `0009`'s reverse defaults a post with no section label to `["posts"]`, which is exactly what `0010` stripped.

**Going forward is lossless; coming back cannot be.** The reverse rebuilds `categories` from whatever tags look like section labels, defaulting to `["posts"]` (an empty list was never valid), and **deliberately leaves the tags alone** — nothing records which tags were the author's and which the migration added. So reversing and re-applying is idempotent rather than clean. Verify a change to it by migrating down to `0008` and back up, not just forwards.

**`tags` has no `allow_empty=False`, unlike the `categories` it replaced.** An untagged post is a perfectly good post: filing under nothing used to mean appearing on no page at all, which is why that was an error, but the feed at `/` lists every post regardless of its tags. An empty list and a missing key are both accepted now, where both were 400s.

The GIN index moved with the filter — it is on `tags` now, since a btree cannot answer a containment test and tags are what the site browses by.

Two things happen in `Post.save()` rather than in the serializer, so they hold for the admin and shell too:

- **`slug` is derived from `title` when left blank**, and deduped with a `-2`, `-3` suffix. It stays writable so a URL can be pinned by hand. A slug of only whitespace passes the model's unique check and then collides inside `save()`, which surfaces as a 500 — `PostSerializer.validate_slug` rejects it as a 400 first.
- **`status="published"` with no `published_at` stamps it `now()`**. `Meta.ordering` is `["-published_at", "-created_at"]`, so without that a published post with a null date would sort below every draft.

**`view_count` is never written by a post save.** It is a `PositiveIntegerField(editable=False)` raised only by `POST /api/posts/{slug}/view/`, which issues a bare `UPDATE ... view_count = view_count + 1` through an `F()` expression. Two reasons it is not `post.view_count += 1; post.save()`: `save()` would drag `auto_now` along and make every read look like an edit, and two concurrent readers would each write back the number they loaded. It is also `read_only` on the serializer, so an ordinary post edit cannot carry a stale count back over it.

### PostViewDay

The second model, and the only other table: one row per post per day it was read, holding that day's count. A running counter has no history, so `view_count` alone could never answer "how did last week go" — `myapp_postviewday` is that history, written by the same request that bumps the counter (`PostViewSet._record_view_day`).

- **The write is an UPDATE first, an INSERT only when it matched nothing.** Every read after the first of a day — nearly all of them — is then one statement, with the same `F()` reasoning as the counter. The INSERT is wrapped in `transaction.atomic()` and its `IntegrityError` swallowed, because two first-reads of a day can race into it: the `unique_post_view_day` constraint picks a winner and the loser just retries the UPDATE, which now has a row to hit. Without the `atomic()` that failure would poison an enclosing transaction — a `TestCase` runs inside one.
- **The day is `timezone.localdate()`, the server's day**, so the boundary between two bars is one the site's owner recognises rather than each reader's own midnight. That is also why the API sends the date as a `"YYYY-MM-DD"` string and the client parses it as UTC: shifting it into the browser's zone would relabel every bar.
- **Rows cascade with the post.** Deleting a post therefore rewrites the daily chart's past — accepted deliberately, because `total_views` on the same page already drops the same reads, and two figures disagreeing about whether a deleted post ever existed is worse than a history that moves.
- **Days with no reads have no row**, so the table grows with traffic rather than with the age of the site. The gaps are filled when the window is built, in `stats`.
- **The history starts when this shipped.** `0007_postviewday.py` creates an empty table; reads counted before it exist only inside `view_count`, which is why the statistics page carries both a chart and a lifetime `views_per_day` figure, and says so on the page.

**`cover_image_url` is a `URLField`, not an `ImageField`** (with `cover_image_alt` beside it, blank falling back to the title at render time). The bytes are uploaded separately, through `/api/uploads/images/`, and the post only ever stores the URL that came back. That is what lets the New Post form attach an image before the post exists — an `ImageField` has nothing to hang an upload off until after the first save — and it makes a cover and an inline `![](...)` in the body the same kind of thing, so one endpoint serves both. The cost is that nothing links a bucket object back to the post using it; see "Object storage".

### The Book model

`Book` is the reading catalogue behind `/books`, and it is the **one place the "add a category, not a model" rule above does not apply**. A post is a piece of writing with a title, a body and a publication date. A book is a thing that exists in the world: it has an author who is not the site's owner, a year it was released, an ISBN that identifies it globally, and a review that is the owner's writing *about* it rather than the entry itself. Those five columns would be null on every non-book post, and `/books` could not sort by author or by year because neither is something a post has.

**`Post.Category.BOOKS` still exists and still means something different** — an essay that happens to be about reading, which appears in the feed at `/` and reaches its page at `/posts/:slug`. Nothing was migrated out of it, and nothing should be: the catalogue is the shelf, the category is writing about the shelf.

Fields: `title`, `slug`, `author`, `genres`, `isbn`, `release_year`, `review`, `cover_image_url` + `cover_image_alt`, `status`, and the two timestamps. No `view_count` and no `published_at` — a shelf entry has neither a readership worth counting nor a publication date of its own (`created_at` is when it was shelved, which is what `ordering` uses).

Points that are deliberate:

- **`author` is a `CharField`, not an Author table.** A catalogue this size never needs to hang anything off an author, and "Le Guin, Ursula K." against "Ursula K. Le Guin" would immediately become two rows in the table that was supposed to prevent exactly that. Several authors go in as one line, as they read on the cover.
- **`genres` is a free-text `ArrayField`, not an enum.** Genre is argued about rather than agreed on, so a fixed list would be wrong for the first book needing a term nobody thought of. Same storage reasoning as `Post.tags`.
- **`isbn` is stored without separators and is not unique.** `normalise_isbn` strips hyphens, spaces and en dashes and upper-cases the check digit, so the stored value is the number itself — which is what a search for one has to match. Not unique because two editions are two entries with two ISBNs, and a unique constraint over a mostly-blank column is a trap.
- **The ISBN's check digit is verified, in the serializer.** `isbn_is_valid` covers both ISBN-10 and ISBN-13. Length alone would accept a transposed pair, which is the typo that leaves an ISBN looking right and matching nothing. It is a serializer rejection rather than a model constraint so it is a 400 with a message, and so an entry typed into the Django admin still saves — a bad ISBN is worth refusing at the form, not worth losing the rest of the record over.
- **`release_year`'s ceiling is a *callable*, `max_release_year`** (this year plus one, since a book bought in December can carry next year on its title page). A hardcoded ceiling starts rejecting valid entries the moment the year turns. The cost: `drf-spectacular` cannot serialise a function into an OpenAPI `maximum`, so `BookSerializer` **declares `release_year` explicitly** with the static floor and enforces the moving ceiling in `validate_release_year`. Remove that declaration and `manage.py spectacular` crashes.
- **`_slug_base` reaches for the author only when the plain title is taken.** Two books called "Ulysses" is ordinary; `/ulysses-2` says nothing about which one it is and `/ulysses-james-joyce` does. A third falls back to `-2` as usual.
- **A book and a post may share a slug.** `unique_slug(model, instance, base)` in `models.py` dedupes against the model it is given, so each table checks only its own — an essay about Dune should not push the catalogue entry to a stuttered URL.

**Three helpers in `models.py` are now shared** and were extracted rather than copied: `clean_labels` (behind both `Post.clean_tags` and `Book.clean_genres`), `unique_slug`, and the ISBN pair. `views.py` likewise has a module-level `reject_unknown` that both viewsets use.

### Comments and reactions

The two things a *visitor* can leave on a post, and the only two routes on the
site anyone can write to without logging in. They are deliberately shaped
differently, because they are different kinds of thing:

| | `Comment` | `Reaction` |
| --- | --- | --- |
| Resource | `/api/comments/`, top-level | `/api/posts/{slug}/reactions/`, nested |
| Vocabulary | free text | a fixed server-side set, `REACTION_EMOJI` |
| Identity | a typed name, unverified | an opaque browser token |
| Moderation | `status` (published/hidden) + delete | delete only |

**Comments are a top-level resource; reactions are an action on a post.** A
reaction bar is a fixed-size summary that only ever makes sense attached to its
post, so a nested action is exactly its shape. Comments are *rows*: they page,
they filter, and the admin console reads them **across** posts, which a route
nested under one post cannot express. `?post=<slug>` is how the public thread
gets the nested view back.

**Either can be switched off per post**, from the two switches in the post
editor (`comments_enabled` / `reactions_enabled` on `Post`, added in `0012`).
Per post rather than site-wide: a piece on something contentious can have its
thread closed without turning comments off everywhere. Both default `True`, so
`0012` changed no behaviour anywhere and saying no is the deliberate act.

The two switches do **different** things, because the two features are
different:

- **Closing comments is about what may be added, not what is there.** The
  thread stays readable and only the form goes away — a switch that also hid
  the comments would be a bulk-hide with no way to see what it hid, and
  `Comment.status` is the control for that. `comment_count` still counts them.
- **Turning reactions off hides the bar**, since a row of counts nobody may
  change is furniture. The rows stay in the table — a reaction someone left is
  a thing that happened — so flipping the switch back brings the counts with it.
- **The owner is exempt from both**, the same way they are exempt from the
  draft rule: the switches are about what *visitors* may add, and leaving the
  last word on a thread you just closed is reasonable. The public page renders
  no form and no bar either way, so this only ever comes up through the API.
- **A closed thread says so; a draft plays dead.** `validate_post` refuses both
  but words them differently on purpose — a draft is answered as if it did not
  exist, while a closed thread is a post the visitor is looking at right now.
- **`GET` on the reactions action stays open with reactions off.** It is a
  count of things that already happened, the page stops asking for it once the
  bar is hidden, and 404ing a summary that exists would make the switch look
  like the post had gone. Only the `POST` is refused.

Points that are deliberate:

- **A comment is published on arrival and moderated afterwards.** A queue means
  every comment sits invisible until the owner happens to look — days, on a
  personal site — and a commenter who sees nothing appear assumes it was lost
  and writes it again. The trade is that something unpleasant is briefly
  visible, which is why `/admin/comments` exists and why hiding is one click
  from every row. `status` is a hide, not a delete, so the row is still there
  to look at.
- **`perform_create` forces `published` for an anonymous caller.** `status` has
  to stay writable — that is how the admin hides and restores — so without this
  a visitor could name their own moderation state, which is wrong whatever they
  choose.
- **There is no email field, on the model or on the form.** Nothing here sends
  mail, so an address would exist only to be leaked. Same instinct as the
  removed CV PDF.
- **A comment body is plain text and is never rendered as Markdown.** `Markdown`
  is for the owner's own writing; running a stranger's input through a renderer
  is how a comment box becomes an injection surface. `whiteSpace: pre-line`
  keeps the commenter's paragraphs, which is the only formatting a comment
  needs. The backend agrees — see the `Comment.body` comment.
- **Anonymous callers see neither hidden comments nor a draft's comments.** Two
  conditions in `get_queryset`, not one: the thread would otherwise be a way to
  read around the draft filter and confirm an unpublished post exists.
  `CommentSerializer.validate_post` refuses the matching *write* for the same
  reason.
- **`CommentPermission` is not `IsAuthenticatedOrReadOnly`.** POST is open to
  everyone — that is the entire point of a comment box — while PUT/PATCH/DELETE
  stay the owner's, so nobody can hide anyone else's comment or unhide the one
  that was taken down.
- **`REACTION_EMOJI` is a fixed set and lives on the server.** This is the one
  place the "free text, not an enum" rule that governs `tags` and `genres` is
  deliberately reversed: a reaction is a one-tap gesture, so the vocabulary has
  to be small enough to sit in a row and identical on every post — otherwise the
  counts fragment across a hundred spellings of "nice" and there is nothing to
  compare. It is a plain `CharField` validated against the tuple rather than
  `choices`, so adding an emoji is a code change with no migration.
  **The Love entry carries a `VARIATION SELECTOR-16`**: U+2764 alone is a *text*
  character and renders as a small monochrome heart in the page font, so without
  it one button in the row looks like a typo.
- **The reaction summary is dense over `REACTION_EMOJI`**, zeros included, and
  it carries each emoji's accessible `label`. The client renders the row the
  server defines rather than keeping a second copy of the list — same reasoning
  as `views_by_day`. `total` sums only the emoji currently offered: a reaction
  left with an emoji since retired stays in the table (it is a thing that
  happened) but a total counting it would disagree with the buttons under it.
- **`visitor` is an opaque token, not a user.** There are no accounts, so
  answering "did *you* already pick this one" needs something to key on; the
  browser generates one and keeps it in `localStorage` (`services/visitor.ts`).
  Clearing site data or opening the post elsewhere buys another reaction, which
  is the same bargain the view counter already makes with its `sessionStorage`
  guard. A blank token is a 400 — everyone who sent nothing would otherwise be
  one visitor sharing one reaction.
- **A reaction is one toggle endpoint, not a POST and a DELETE.** The button is
  one control with two meanings, and making the client decide which would mean
  trusting a count that may be seconds stale. `_toggle_reaction` deletes first
  and inserts only if nothing was deleted, with the insert wrapped exactly like
  `_record_view_day`'s: two taps racing both find nothing to delete, the unique
  constraint picks a winner, and the loser has nothing to do.
- **Both open routes are rate-limited by scope, and nothing else is.** There is
  no `DEFAULT_THROTTLE_CLASSES` — a global limit would also cover the owner's
  admin, where a burst of writes is normal. `CommentViewSet.get_throttles`
  applies `ScopedRateThrottle` only to `create`; `PostViewSet` declares
  `throttle_scope = None` at class level purely so `@action(throttle_scope=...)`
  is accepted as an initkwarg. Rates come from `COMMENT_RATE_LIMIT` /
  `REACTION_RATE_LIMIT`. The counters live in Django's cache, which defaults to
  a per-*process* LocMemCache, so under gunicorn's workers the real limit is
  roughly the rate times the worker count.

**`comment_count` on `PostSerializer` is an annotation, and it has two traps.**
`PostViewSet._with_comment_count` counts *published* comments only, even for the
owner — the number means "what a visitor sees under this post", and an admin
list saying 4 where the page shows 3 would report a different figure under the
same word.

1. **An aggregate annotation drops `Meta.ordering`.** The GROUP BY makes a
   default ordering ambiguous, so Django clears it rather than guess, and the
   feed came back in whatever order Postgres felt like. The queryset restates
   `order_by(*Post._meta.ordering)`, which keeps `Meta.ordering` the one place
   the default lives.
2. **It is applied only to the actions that serialise a post**
   (`SERIALISED_POST_ACTIONS`). `tags` aggregates *again* on top of
   `get_queryset()`, and a second `.values(...).annotate(...)` over an already
   grouped query counts the wrong thing and drops labels outright.

`get_comment_count`'s fallback is not decoration either: a create/update
response serialises the instance `save()` returned, which never went through the
queryset and carries no annotation.

Three `status` fields now exist and only two mean the same thing, so
`SPECTACULAR_SETTINGS['ENUM_NAME_OVERRIDES']` names both choice sets — left
alone the generator invents `Status68aEnum`, which is meaningless in a generated
client and unstable, since the suffix is a hash of the choice set. It resolves
its values with `import_string`, which cannot reach through a nested class,
which is why `models.py` ends with the `PUBLICATION_STATUS_CHOICES` /
`COMMENT_STATUS_CHOICES` aliases.

### API surface

Routed at `api/` from the project `urls.py` via `myapp/urls.py`'s `DefaultRouter`; `DefaultRouter` also serves the index at `/api/` and the browsable HTML API.

| | |
| --- | --- |
| `GET /api/posts/` | list, paginated 20 per page (`?tag=`, `?status=`, `?ordering=`, `?published_after=`, `?published_before=`) |
| `POST /api/posts/` | create |
| `GET|PUT|PATCH|DELETE /api/posts/{slug}/` | detail |
| `GET /api/posts/tags/` | every tag in use with its count, scoped to what the caller may see |
| `POST /api/posts/{slug}/view/` | record one read; open to anonymous callers, returns `{slug, view_count}` |
| `GET /api/posts/stats/` | site-wide aggregates for the admin, **authenticated only** |
| `POST /api/uploads/images/` | multipart image upload, authenticated only; returns `{url, name}` |
| `GET /api/books/` | catalogue, paginated **12** per page (`?genre=`, `?search=`, `?status=`, `?ordering=`) |
| `POST /api/books/` | create |
| `GET\|PUT\|PATCH\|DELETE /api/books/{slug}/` | detail |
| `GET /api/books/genres/` | every genre in the catalogue with its count, scoped to what the caller may see |
| `GET /api/comments/` | comments, paginated 20 per page (`?post=`, `?status=`, `?search=`, `?ordering=`); oldest first |
| `POST /api/comments/` | leave a comment — **open to anonymous callers**, rate-limited, status forced to `published` |
| `GET\|PUT\|PATCH\|DELETE /api/comments/{id}/` | detail; everything but GET needs the owner |
| `GET /api/posts/{slug}/reactions/` | the whole emoji bar, dense; `?visitor=` answers `reacted`. Open even with reactions off |
| `POST /api/posts/{slug}/reactions/` | toggle one emoji for one browser and return the bar; open to anonymous callers, refused when the post has reactions off |
| `GET /api/schema/` | OpenAPI 3 document (drf-spectacular) |
| `GET /api/docs/` | Swagger UI |
| `GET /api/redoc/` | ReDoc |

**Lookup is by `slug`, not `id`** (`lookup_field = "slug"`), matching the URLs the frontend will use. One consequence of that plus the list-level actions: `DefaultRouter` registers `@action` routes *before* the detail route, so a post slugged `stats` or `tags` would be shadowed and unreachable at its own detail URL (likewise `genres` on books). Not worth guarding against, but worth knowing before debugging it.

**`GET /api/posts/stats/` is aggregates, not rows**, and backs the admin's overview and statistics pages. Three things about it are deliberate: it is `IsAuthenticated` rather than read-open, because the draft count and drafts' view counts are the owner's business; it is built from `Post.objects.all()` rather than `get_queryset()`, so the list's `?category=` / `?status=` params cannot silently narrow what is meant to be a total; and `average_views` is per *published* post, since a draft has no public page to be read on and counting drafts in the denominator would move the number for a reason unrelated to readership. `published_by_month` returns only months that have a post — filling the gaps is the client's job (`fillMonths`), because which range to show is a question about the chart rather than about the data.

Two of its fields are about reading rather than writing, and they deliberately answer different questions:

- **`views_by_day` is dense, and that is the opposite of `published_by_month` on purpose.** It is exactly `DAILY_VIEWS_DAYS` (30) rows ending on the server's today, zeros included, summed across posts from `PostViewDay`. The window is anchored to a clock only the server has: a browser a day ahead would fill its own gaps and draw a last bar for a day this server has never seen, and one behind would drop today's reads off the end. Bounding it here also keeps a year of history from becoming 365 rows for a chart that shows a month.
- **`views_per_day` is the lifetime rate**: every view ever counted, over the days since the *first publication*, both ends inclusive. It exists because `views_by_day` knows nothing from before the table did, so on the day that shipped the chart was empty and the page had nothing to say about reading. The denominator counts from publication rather than from the first post being written, since a site with nothing published has no page to be read on; `max(1, …)` guards a publish date set in the future, and nothing published at all gives `0.0` rather than a division by zero. The numerator is every view including drafts', because those are reads that happened.

`stats` reads the clock once, into `today`, so a request that straddles midnight cannot build the window against one day and the rate against another.

`permission_classes = [IsAuthenticatedOrReadOnly]`: reads are open, writes need a logged-in user. Auth is session (for the browsable API while logged into `/admin/`) plus basic (`curl -u`). A fresh database has no user in it — `manage.py createsuperuser` before trying a write by hand.

Two deliberate details in `PostViewSet.get_queryset`:

- **Drafts are filtered for anonymous users on every route, not just the list.** Filtering only the list would still hand an unpublished post to anyone who guessed its slug.
- **`?tag=` stays singular and is a case-insensitive containment test**: it asks "which tag am I browsing", which has one answer per page, and a post carrying several is returned by each of them. It cannot return duplicates, since it is a filter rather than a join.
- **An unknown `?status=` or `?ordering=` is a 400; an unused `?tag=` is an empty result.** That difference is the point of the change: dropping an unrecognised *enum* value silently would answer a typo'd `?status=pubished` with everything, but tags are free text — there is no list to be wrong about, and a tag nobody has used legitimately matches nothing.

**`?tag=` on posts and `?genre=` on books are the same mechanism**, and share three helpers in `views.py` rather than two copies:

- **`filter_by_label(queryset, model, field, label)`** — case-insensitive containment. It takes two steps because an `ArrayField` has no `icontains` lookup and `__contains` is exact: find the stored spellings that casefold-match, then ask for rows carrying any of them (`__overlap`). `clean_labels` dedupes *one row's* labels case-insensitively but keeps what was typed, so "Sci-Fi" on one row and "sci-fi" on another genuinely both exist, and a filter naming either has to find both.
- **`label_counts(queryset, field, limit)`** — backs the two vocabulary endpoints, `/api/posts/tags/` and `/api/books/genres/`. Both exist because a filter control needs options to offer and free text has no enum to read them off; counting on the client from one page of results would offer only the labels that landed on page one. **Spellings are folded together here, which the stored values are not**: offering "Sci-Fi" and "sci-fi" separately would be offering the same filter twice with its count split, so the commonest spelling wins (ties alphabetical, so the answer does not depend on row order). Both are scoped by `get_queryset()`, so an anonymous caller is never offered a label only a draft carries — which would be an option returning nothing, and would disclose what is being written about.
- **`stored_labels(model, field)`** — the `unnest` query both of the above sit on. `output_field` is required: Django cannot infer the element type of a set-returning function.

`reject_unknown` is shared the same way, by both viewsets.

`BookViewSet` otherwise follows `PostViewSet`'s shape — `IsAuthenticatedOrReadOnly`, `lookup_field = "slug"`, drafts filtered on every route — with one difference worth knowing:

- **The catalogue pages 12 at a time, not the site-wide 20** (`BookPagination`, set as `BookViewSet.pagination_class`). `/books` is a grid of covers rather than a column of rows, and twenty covers is five rows of a four-up grid — more scrolling than a shelf is worth, and on a small shelf it meant the pager never appeared at all, since the client hides it at one page. **12 rather than a round 10** because it is what the grid divides by: two columns on a phone and `auto-fill` from `sm` up, so a page lands as 6x2, 4x3 or 3x4 with no ragged last row. Deliberately not a `?page_size=` the caller may name — that is the usual way the setting goes wrong. `REST_FRAMEWORK.PAGE_SIZE` still covers posts and comments, which really are columns of rows.

  **The number is a contract across three places**: `BookPagination.page_size`, `BOOKS_PAGE_SIZE` in the SPA's `books.ts`, and the page counts `useBooks`/`useAdminBooks` derive from it. Move one alone and the pager offers pages the API has nothing to put on; `BookPaginationTests` is what catches that.
- **Every `BOOK_ORDERINGS` entry ends in `-id`.** Sorting by author puts a dozen rows on the same value, and without a total tie-breaker a page boundary falling inside that group shows one book twice and drops another. `year` also uses `F("release_year").desc(nulls_last=True)`: a bare `-release_year` puts NULLs first in Postgres, which reads as "these are the newest" when it means "these are unknown".

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

Django's own admin registers all four models. `PostAdmin` lists and filters on both visitor switches, so "which posts did I close" is a sidebar question rather than a shell one. `CommentAdmin` marks the post, name and body **read-only** and offers hide/publish as bulk actions, and `ReactionAdmin` has no add permission at all: a comment is the visitor's writing and a reaction is something that happened, so neither is a thing to author from here.

**`list_filter` on an `ArrayField` has to be hand-written** — `ArrayFieldFilter` in `admin.py`, subclassed as `TagFilter` and `GenreFilter`. Django builds an exact-match filter from a plain `list_filter` entry, so on an `ArrayField` the sidebar would offer whole combinations — "books, projects" — as single values and match nothing else. It performs the same containment test its API parameter does, and builds its options from the rows themselves — both fields are free text, so there is no enum to read them off.

### Tests

`myapp/tests.py` is a real suite (232 tests, `APITestCase`) covering slug generation, publish stamping, the draft visibility rules, the tag filter and its vocabulary endpoint (`TagVocabularyTests`), filter validation, basic-auth writes, each CRUD verb for both anonymous and authenticated callers, the upload endpoint, the view counter, the daily reading history (`ViewDayTests`), the date-range filter, and the book catalogue (`BookModelTests` / `BookAPITests` — slug derivation and its author fallback, genre and ISBN normalisation, both check-digit schemes, the release-year bounds, the case-insensitive genre filter, the genres action's spelling fold, and each CRUD verb for both anonymous and authenticated callers), and comments and reactions (`CommentAPITests` / `CommentCountTests` / `ReactionTests` — the open create and its forced status, the draft and hidden visibility rules, moderation by the owner and its refusal to anyone else, the dense reaction bar, the toggle, per-visitor `reacted`, and the rejected emoji), the per-post switches (`VisitorSwitchTests` — both defaulting on, each refusal, the owner's exemption from both, a closed thread staying readable, and reaction counts surviving the switch), and the catalogue's shorter page (`BookPaginationTests` — the page length, the count being the whole catalogue rather than the page, non-overlapping pages, and a cross-check that posts keep the site-wide 20). Run it with `python manage.py test`.

**The two throttle tests patch `ScopedRateThrottle.THROTTLE_RATES` rather than using `override_settings(REST_FRAMEWORK=...)`**, which looks like it should work and does not: DRF binds that dict to the class *at import time*, so a settings override moves `api_settings` and leaves the throttle reading the rate it was born with. They also `cache.clear()` in `setUp`, since the throttle counter lives in a LocMemCache that outlives a single test.

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

`/` (the blog feed) and `/posts/:slug` render live data from `GET /api/posts/`. The post page also carries the two things a visitor can leave — a reaction bar and a comment thread — which are the only requests in the app a stranger writes with; see "Comments and reactions (frontend)". **`/books` is the catalogue, backed by `GET /api/books/`** — a different resource, so `/books/:slug` renders `BookDetail` over a `Book`. A post *about* a book is writing: it lives in the feed, tagged however its author likes, and reaches its page at `/posts/:slug` like every other post. The CV and About pages are the only hardcoded copy left.

**There is no `/garage` page.** `Post.Category.GARAGE_SALE` is still a valid backend category — the admin console can still file a post under it — but nothing public links there any more; the page, its route, and its nav item were deleted. `VISIBLE_CATEGORIES` in `posts.ts` (`posts`, `books`, `projects`) is the list every cross-category view filters to, so a stray `garage_sale` post can never end up linked from a page that no longer exists. Filter with `isVisible(post)` rather than testing a single value: a post filed under both `garage_sale` and `projects` does have a page, and only one filed *solely* under `garage_sale` should be dropped.

**`Blog.tsx` at `/` is the only feed there is.** Its filter bar is a tag select defaulting to "All tags", plus "From"/"To" `<input type="date">` fields for an inclusive date range, over numbered `Pagination`; see `usePaginatedPosts.ts`. **The tag select is only rendered when there is a vocabulary to offer** — unlike the category select it replaced, whose four values were hardcoded and so could always be shown, these come from `/api/posts/tags/` via `useTags`, and a select whose one option is "All tags" is a control that does nothing. **Every filter change resets `page` to 1**, since page 3 of an unfiltered list is usually past the end of a filtered one. The same two date fields sit in the admin console's filter row (`AdminConsole.tsx`, threaded through `useAdminPosts`). They are native date inputs rather than a picker component: they carry their own calendar and locale formatting, and hand back the `YYYY-MM-DD` string the API wants. Both force `slotProps={{ inputLabel: { shrink: true } }}`, because the browser paints its own `mm/dd/yyyy` placeholder in an empty field and an unshrunk floating label would sit on top of it.

No HTTP client dependency anywhere — `fetch` plus a handful of hooks:

- **`src/services/posts.ts`** — types mirroring `PostSerializer`, plus every fetch function: `fetchPosts(category, signal)` (one category), `fetchPost(slug, signal)` (one post, for a detail page — throws `PostNotFoundError` on a 404 so a "not found" state is distinguishable from a real error), `fetchPostsPage({category, page, after, before}, signal)` (one numbered page; category and the inclusive `YYYY-MM-DD` date bounds all optional), `recordPostView(slug, signal)` (POSTs the read counter, returns the new total), and the shared `fetchPostPage(url, signal)` they all funnel through. Also `CATEGORY_LABELS`, `CATEGORY_ORDER` (the one display order, mirroring the model's declaration order — anything building its own list of categories uses it so the badges cannot come out in a different order than the form's checkboxes), `VISIBLE_CATEGORIES`, `isVisible` and `CROSS_CATEGORY_BASE_PATH`.

  **There is no `CROSS_CATEGORY_BASE_PATH` any more.** It existed because a post could be in several sections and none outranked the others, so a card had to be told which prefix to build. With one feed there is exactly one path — `PostCard` is handed `/posts/:slug` by its only caller.
- **`src/services/usePost.ts`** — one post by slug, for a `PostDetail` page; adds a `not-found` phase on top of the usual three.
- **`src/services/useRecordView.ts`** — counts one read of the loaded post and returns the total for `PostDetail` to render (the post's own `view_count` until the endpoint answers, since the GET happened before the increment). **Deliberately the one request in the app that is not aborted on unmount** — the read already happened, so only the state update is skipped. Repeat reads are suppressed by a `viewed:<slug>` key in `sessionStorage`, written *before* the request so React's double-invoked development effect cannot count twice; every touch of `sessionStorage` is try/caught because it throws outright in some privacy modes. A failed record is swallowed: a counter is not worth an error banner over.
- **`src/services/usePaginatedPosts.ts`** — one numbered page, tag and date range optional; backs `Blog.tsx`. Every filter is a separate string argument rather than one object, for the same reason `useAdminPosts` takes its filters apart: a fresh object literal every render would re-trigger the effect forever. `count` is now exactly what the API reports — it used to run slightly high, because the unfiltered case dropped garage-sale-only posts client-side after the server had counted them. It also exports **`useTags`**, the twin of `useGenres`: fetched once on mount, never refreshed, and a failure swallowed into an empty list, since the filter is a convenience and losing it is not worth an error banner over a feed that loaded fine.
- **`src/services/adminStats.ts` / `useAdminStats.ts`** — the one call to `GET /api/posts/stats/`, backing both `AdminOverview` and `AdminStats`. `fillMonths` inserts the empty months the API leaves out and windows the result to the most recent twelve: without it a gap year reads as a busy one, since three bars for 2024, 2025 and 2026 sit side by side looking like three consecutive months. It counts back from the newest month rather than forward from the oldest, so a long history loses its distant past and not its current month. **`views_by_day` has no equivalent and must not grow one** — it arrives dense from the API, and filling it here would mean guessing which day the server thinks it is.
- **`src/components/admin/Bars.tsx`, its two callers, and `StatTile.tsx`** — the statistics page's visual pieces, all plain `Box`es on theme tokens. No charting library: this is a few dozen rectangles and a baseline, and the smallest dependency would outweigh the feature. `Bars` does the drawing and knows nothing about time: it takes `{key, value, label, ticks}` and the bar-width bounds. `MonthlyBars.tsx` (publishing cadence) and `DailyBars.tsx` (reads per day) are thin mappers over it, so the two charts cannot drift apart in scale, spacing or how an empty period is drawn while still wording their own tooltips ("3 posts" / "3 views"). Points worth keeping: one series means one colour (`primary.main`, which differs per scheme) and no legend; bars are capped at `maxBar` so a short history does not stretch into slabs, and `DailyBars` lowers `minBar` to 12 because thirty bars at the monthly chart's 26px would scroll on every screen; an empty period draws a 2px floor in `divider`, because a zero-height bar is indistinguishable from one the chart forgot; only the peak is direct-labelled, with the rest reachable by tooltip **and** by the "Show as a table" twin, so no value is hover-gated; and the tile values use proportional figures while the tables use `tabular-nums`, since only the latter are columns that must line up.
- **`DailyBars` ticks every fifth bar, counted back from the last**, so today is always the labelled one and the spacing stays even whatever the window length. The month name rides under a *labelled* bar rather than under whichever bar is a 1st — a month beginning between two ticks would otherwise go unnamed, and a name under an unlabelled bar has no number to attach to.
- **The daily section says out loud that it can disagree with the Views tile.** The tile counts every read ever; the bars start when `PostViewDay` did. Without that line the owner is left to explain a mismatch that is not a bug. Its table twin lists only the days that had a read — thirty rows of mostly zero reads worse than the bars do.
- **`src/services/uploads.ts`** — `uploadImage(file, signal)` against `POST /api/uploads/images/`, plus `ACCEPT_ATTRIBUTE` and `MAX_UPLOAD_BYTES`, which mirror `ALLOWED_FORMATS` and `MAX_UPLOAD_SIZE` on the backend. Those client-side checks are a courtesy that avoids a pointless round trip; **the server re-checks the bytes, and that is the check that counts.** Used by both `CoverImageField` and the editor's image button.
- **`src/components/PostCard.tsx`** — one entry in the blog feed, and all that is left of the old `PostList`: the list wrapper had two callers, `/projects` and `/books`, and both are gone. `Blog` renders the loading/error/empty states itself. `src/components/Centered.tsx` is the centring wrapper those states use, shared by `Blog`, `PostDetail`, `Books` and `BookDetail`; it **needs an unbroken `flex: 1` chain from `<main>`**, which is why every page rendering a feed makes its `Container` a flex column. `PostCard` renders `cover_image_url` when a post has one — a leading 120px square at `sm`+, full-width on top at `xs`, where 120px of thumbnail would leave the title no room — and is unchanged for posts without one. `PostDetail` renders the same image full-width. Both pass `cover_image_alt` straight through, so a blank one correctly marks the image decorative rather than repeating the title a screen reader has already read.

  **Neither shows a category badge any more.** `PostDetail` led its chip row with them; they were the less specific of the two labels, and showing both meant showing "Posts" on nearly every post. The tags are the row now.

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
