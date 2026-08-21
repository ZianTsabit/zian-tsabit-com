import { useEffect, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Box } from "@mui/material";
import { MONO_FONT } from "../theme";

/**
 * KaTeX, loaded on demand -- see `mathPlugins.ts` for why it is a chunk.
 *
 * Module scope rather than component state, so this is paid **once per page
 * load, not once per component**: the second post a reader opens, and every
 * body on a page that already rendered maths, finds `loaded` set and renders
 * synchronously with no gate at all.
 *
 * `failed` is not tidiness. Without it a chunk that never arrives -- a blip, a
 * stale `index.html` pointing at a hash that no longer exists -- would leave
 * the body blank for good. Set it, and the render falls through to plain
 * Markdown: the post appears with `$x^2$` as literal text, which is the
 * degradation worth having.
 */
type MathPlugins = typeof import("./mathPlugins");

let loaded: MathPlugins | null = null;
let failed = false;
// The in-flight import, shared so two bodies mounting together make one
// request rather than racing.
let pending: Promise<void> | null = null;

function loadMath(): Promise<void> {
  pending ??= import("./mathPlugins")
    .then((module) => {
      loaded = module;
    })
    .catch(() => {
      failed = true;
    });
  return pending;
}

/**
 * Whether a body is worth loading KaTeX for.
 *
 * A bare `$` rather than anything cleverer, and deliberately over-eager: an
 * escaped `\$5` trips it too. The cost of a false positive is one cached
 * chunk fetched for nothing; the cost of a false negative is maths that never
 * renders, so the test errs the only way it can afford to.
 */
function mightHaveMath(markdown: string): boolean {
  return markdown.includes("$");
}

/** `=400`, `=400x300` or `=50%` -- nothing else is read as a size. */
const SIZE = /^=(\d{1,4})(%)?(?:x(\d{1,4}))?$/;

/**
 * Reads an image's size out of its Markdown *title*: `![alt](url "=400")`.
 *
 * Markdown has no size syntax, and the two usual answers are both shut here --
 * `![alt](url =400x300)` is a Pandoc extension CommonMark does not parse (the
 * ` =400x300` would be swallowed into the URL and the image would 404), and
 * `<img width>` needs raw HTML, which this renderer deliberately does not
 * enable. The title slot is real CommonMark, so a body using it stays valid
 * everywhere else: another renderer just shows the text as a tooltip.
 *
 * A title that is not a size is left alone and passed through as a title, so
 * the convention costs nothing to anyone not using it.
 *
 * Width and height together become an `aspect-ratio` rather than a literal
 * height: the image then shrinks proportionally inside `maxWidth: 100%` on a
 * narrow screen, where a fixed height would stretch it out of shape.
 */
function imageSize(title?: string): {
  width?: string;
  aspectRatio?: string;
  title?: string;
} {
  const match = title?.match(SIZE);
  if (!match) return { title };

  const [, value, percent, height] = match;
  const width = percent ? `${value}%` : `${value}px`;
  // An aspect ratio needs both numbers in the same unit; a percentage width is
  // resolved against the column, so pairing it with a pixel height means
  // nothing. Height is ignored there rather than guessed at.
  return height && !percent
    ? { width, aspectRatio: `${value} / ${height}` }
    : { width };
}

/**
 * Markdown headings are demoted one level.
 *
 * The page already spends its single `<h1>` on the post title, so a `#` in the
 * body becomes an `<h2>` element -- two `<h1>`s on one page is a genuine
 * screen-reader problem. The *visual* size still follows what was typed, so
 * the author's hierarchy reads the way they wrote it. `######` has nowhere
 * left to go and stays an `<h6>`.
 */
const HEADINGS = {
  h1: { as: "h2", size: { xs: "20px", sm: "24px" } },
  h2: { as: "h3", size: { xs: "18px", sm: "21px" } },
  h3: { as: "h4", size: { xs: "17px", sm: "19px" } },
  h4: { as: "h5", size: { xs: "16px", sm: "18px" } },
  h5: { as: "h6", size: { xs: "16px", sm: "17px" } },
  h6: { as: "h6", size: { xs: "15px", sm: "16px" } },
} as const;

function heading(level: keyof typeof HEADINGS) {
  const { as, size } = HEADINGS[level];
  return function Heading({ children }: { children?: ReactNode }) {
    return (
      <Box
        component={as}
        sx={{
          fontWeight: "bold",
          fontSize: size,
          color: "text.primary",
          // Bound to the heading's top so it groups with the text it
          // introduces rather than floating between two blocks.
          mt: 3,
          mb: 1,
          "&:first-of-type": { mt: 0 },
        }}
      >
        {children}
      </Box>
    );
  };
}

const components: Components = {
  h1: heading("h1"),
  h2: heading("h2"),
  h3: heading("h3"),
  h4: heading("h4"),
  h5: heading("h5"),
  h6: heading("h6"),

  p: ({ children }) => (
    <Box
      component="p"
      sx={{
        fontSize: { xs: "15px", sm: "17px" },
        color: "text.primary",
        lineHeight: 1.7,
        my: 2,
        // A justified ~35-character phone line opens visible rivers of
        // whitespace, so justification is sm and up only -- same rule the
        // rest of the site follows.
        textAlign: { xs: "left", sm: "justify" },
      }}
    >
      {children}
    </Box>
  ),

  a: ({ href, children }) => {
    // A bare "#anchor" or a relative path stays in the tab it was clicked in.
    const external = /^https?:\/\//.test(href ?? "");
    return (
      <Box
        component="a"
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        sx={{ color: "primary.main", textDecoration: "underline" }}
      >
        {children}
      </Box>
    );
  },

  ul: ({ children }) => (
    <Box
      component="ul"
      sx={{
        fontSize: { xs: "15px", sm: "17px" },
        color: "text.primary",
        lineHeight: 1.7,
        my: 2,
        pl: 3,
      }}
    >
      {children}
    </Box>
  ),

  ol: ({ children }) => (
    <Box
      component="ol"
      sx={{
        fontSize: { xs: "15px", sm: "17px" },
        color: "text.primary",
        lineHeight: 1.7,
        my: 2,
        pl: 3,
      }}
    >
      {children}
    </Box>
  ),

  li: ({ children }) => <Box component="li" sx={{ mb: 0.5 }}>{children}</Box>,

  blockquote: ({ children }) => (
    <Box
      component="blockquote"
      sx={{
        borderLeft: "3px solid",
        borderColor: "divider",
        pl: 2,
        my: 2,
        mx: 0,
        color: "text.secondary",
        fontStyle: "italic",
      }}
    >
      {children}
    </Box>
  ),

  hr: () => (
    <Box
      component="hr"
      sx={{ border: 0, borderTop: "1px solid", borderColor: "divider", my: 3 }}
    />
  ),

  // Inline code. A fenced block's <code> sits inside <pre>, which resets these
  // below -- the block already supplies its own background and padding.
  code: ({ children }) => (
    <Box
      component="code"
      sx={{
        fontFamily: MONO_FONT,
        fontSize: "0.9em",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 0.5,
        px: 0.75,
        py: 0.25,
      }}
    >
      {children}
    </Box>
  ),

  pre: ({ children }) => (
    <Box
      component="pre"
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 2,
        my: 2,
        // A long line pans inside its own box; letting it widen the page would
        // put a horizontal scrollbar on the whole document.
        overflowX: "auto",
        "& code": {
          bgcolor: "transparent",
          border: 0,
          p: 0,
          fontSize: { xs: "13px", sm: "14px" },
        },
      }}
    >
      {children}
    </Box>
  ),

  table: ({ children }) => (
    // Same reason as <pre>: a wide table scrolls in its own container rather
    // than stretching the page.
    <Box sx={{ overflowX: "auto", my: 2 }}>
      <Box
        component="table"
        sx={{
          fontSize: { xs: "14px", sm: "15px" },
          color: "text.primary",
          borderCollapse: "collapse",
          width: "100%",
        }}
      >
        {children}
      </Box>
    </Box>
  ),

  th: ({ children }) => (
    <Box
      component="th"
      sx={{
        border: "1px solid",
        borderColor: "divider",
        px: 1.5,
        py: 1,
        textAlign: "left",
        fontWeight: "bold",
      }}
    >
      {children}
    </Box>
  ),

  td: ({ children }) => (
    <Box
      component="td"
      sx={{ border: "1px solid", borderColor: "divider", px: 1.5, py: 1 }}
    >
      {children}
    </Box>
  ),

  img: ({ src, alt, title }) => {
    const { width, aspectRatio, title: caption } = imageSize(title);
    return (
      <Box
        component="img"
        src={typeof src === "string" ? src : undefined}
        alt={alt ?? ""}
        title={caption}
        sx={{
          // Stays first: an author asking for a width wider than the column
          // must still not widen the page (see the overflow rule in index.css).
          maxWidth: "100%",
          width,
          aspectRatio,
          height: "auto",
          borderRadius: 1,
          my: 2,
        }}
      />
    );
  },
};

/**
 * Renders a post body written in Markdown.
 *
 * `react-markdown` does not render raw HTML unless `rehype-raw` is added, so
 * a body containing `<script>` is shown as text rather than executed -- worth
 * keeping that way, since post bodies are stored and replayed verbatim.
 *
 * Plugins:
 * - `remark-gfm` for tables, strikethrough and autolinks.
 * - `remark-breaks` so a single newline is still a line break. Bodies written
 *   before this page understood Markdown were rendered with `pre-line`, and
 *   without this plugin every one of them would silently reflow into one
 *   paragraph.
 * - `remark-math` + `rehype-katex` for LaTeX: `$x^2$` inline, `$$...$$` as a
 *   centred block. **Loaded only when the body contains a `$`** -- see
 *   `mathPlugins.ts`, and `loadMath` above.
 *
 * **`remark-math` has to come before `remark-breaks`, and it is a parser
 * extension rather than a transformer.** That is what keeps the two from
 * fighting: maths becomes its own node at tokenise time, so `remark-breaks`
 * never sees the newlines inside a multi-line `$$` block and cannot litter it
 * with `<br>`s. Note the spread below preserves that order.
 *
 * **`$` is now syntax.** A body writing about money needs `\$5`, or the `$5`
 * and the next `$` on the same line are read as an expression. Nothing already
 * published contains one, which is why single-dollar inline maths was worth
 * having; if that stops being true, `remark-math` takes
 * `{ singleDollarTextMath: false }` and `$$...$$` still works inline.
 *
 * **While the maths chunk is in flight the body renders nothing**, rather than
 * rendering without it and swapping. Both waits are short and only the first
 * one happens at all, but they fail differently: an empty region for 50ms is
 * not noticed, where a paragraph of raw `\frac{a}{b}` reflowing into set
 * maths is a visible flash and a layout shift. A body with no `$` in it never
 * reaches this branch and renders exactly as it always did.
 */
function Markdown({ children }: { children: string }) {
  const needsMath = mightHaveMath(children);
  // Nothing renders from this; it exists to re-render once the chunk lands.
  // The real answer lives at module scope, so a component mounting after the
  // load never waits.
  const [, settled] = useState(0);

  useEffect(() => {
    if (!needsMath || loaded || failed) return;
    let live = true;
    void loadMath().then(() => {
      // Skipped on an unmounted component; the module-level cache is already
      // set either way, so nothing is lost.
      if (live) settled((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [needsMath]);

  // `failed` falls through to plain Markdown rather than waiting forever.
  const waitingForMath = needsMath && !loaded && !failed;

  return (
    <Box
      sx={{
        // The first and last blocks' own margins would otherwise add to the
        // gap the surrounding Stack already provides.
        "& > *:first-of-type": { mt: 0 },
        "& > *:last-child": { mb: 0 },

        // Display maths, styled here rather than through `components` because
        // KaTeX emits its own markup below the React tree -- there is no
        // `math` component for react-markdown to hand over.
        "& .katex-display": {
          // The same rule <pre> and <table> follow: a long equation pans
          // inside its own box, because nothing may widen the page. KaTeX
          // ships no overflow of its own, so a wide integral would otherwise
          // put a scrollbar on the whole document.
          overflowX: "auto",
          // Vertical clip, or the horizontal scrollbar's own height triggers a
          // second, vertical one on the tall glyphs.
          overflowY: "hidden",
          // Room for the scrollbar, so it does not sit on top of the maths.
          py: 0.5,
          my: 2,
        },
        // KaTeX sizes display maths at 1.21em of its parent. That parent is
        // this Box, not a paragraph, so without a size named here the block
        // renders against the browser default rather than the body's own.
        "& .katex": { fontSize: { xs: "15px", sm: "17px" } },
      }}
    >
      {!waitingForMath && (
        <ReactMarkdown
          // `remark-math` is spliced in ahead of `remark-breaks`, which is the
          // order that matters; with the chunk absent the list is exactly what
          // it was before maths existed.
          remarkPlugins={[
            remarkGfm,
            ...(loaded?.remarkMathPlugins ?? []),
            remarkBreaks,
          ]}
          rehypePlugins={loaded?.rehypeMathPlugins}
          components={components}
        >
          {children}
        </ReactMarkdown>
      )}
    </Box>
  );
}

export default Markdown;
