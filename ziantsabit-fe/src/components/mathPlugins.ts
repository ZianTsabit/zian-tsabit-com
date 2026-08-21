/**
 * The LaTeX half of `Markdown.tsx`, in its own module so it can be a **chunk**.
 *
 * This file is only ever reached through a dynamic `import()`, and that is the
 * whole point of it existing: KaTeX and its stylesheet are about 290 KB of the
 * bundle (~87 KB gzipped), which is a lot to hand every visitor of a site where
 * most posts contain no maths at all. Split out here, the cost falls only on
 * the first body that actually needs it, and never on the feed, the CV, the
 * books page or a post that is only prose.
 *
 * **Nothing may import this statically.** A single `import { ... } from
 * "./mathPlugins"` anywhere would fold it back into the main chunk and quietly
 * undo the split -- no error, no visible symptom beyond the bundle size.
 * `Markdown.tsx` is the only caller, and it reaches this through `import()`.
 *
 * The KaTeX stylesheet rides along with the chunk rather than sitting in
 * `index.css`: Vite emits it as this chunk's own CSS, so it is fetched with the
 * code that needs it. It is **self-hosted, not the CDN link KaTeX's docs lead
 * with** -- Vite resolves the `url()`s against `katex/dist/fonts/` and emits
 * the font files into `dist/assets/`, which is where `nginx.conf` serves from,
 * so maths renders with no third-party request.
 */

// A type-only import, so it is erased at compile time and does **not** pull
// react-markdown into this chunk -- which would defeat the split.
import type { Options } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import "katex/dist/katex.min.css";

/**
 * How KaTeX is asked to render, and every option here is load-bearing.
 *
 * `throwOnError: false` renders a broken expression in place, in red, instead
 * of throwing -- which in the admin's Preview tab is the difference between
 * seeing your mistake and seeing a blank pane, since half-typed maths is what a
 * preview shows most of the time.
 *
 * `trust: false` (the default, named here because it matters) is what keeps
 * `\url`, `\href` and `\includegraphics` inert. A post body is the owner's own
 * writing, but this renderer is also what book reviews go through and what any
 * future untrusted source would reach, and the rule `Markdown.tsx` already
 * follows -- raw HTML is text, never markup -- would be quietly undone by a
 * macro that injects an anchor.
 *
 * `strict: false` accepts the small Unicode and spacing liberties people
 * actually type; the alternative is a console warning for every stray `∂`.
 */
const KATEX_OPTIONS = {
  throwOnError: false,
  trust: false,
  strict: false as const,
  // A theme token through MUI's CSS variables, not a hex: `theme.ts` is the
  // only place a colour is written, and KaTeX takes a CSS colour string here
  // rather than anything React could resolve. `cssVariables` in the theme is
  // what puts this variable on the page, and it follows the light/dark scheme
  // like every other token.
  errorColor: "var(--mui-palette-error-main)",
};

/** Spliced into the remark list **before** `remark-breaks` -- see `Markdown.tsx`. */
export const remarkMathPlugins: Options["remarkPlugins"] = [remarkMath];

/** The whole rehype list, since maths is the only thing here that needs one. */
export const rehypeMathPlugins: Options["rehypePlugins"] = [
  [rehypeKatex, KATEX_OPTIONS],
];
