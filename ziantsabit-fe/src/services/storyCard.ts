/**
 * Draws a 1080x1920 Instagram-story card for one post or one book.
 *
 * A canvas rather than a screenshot of a hidden DOM node: html-to-image and its
 * relatives work by inlining the page into an `<svg><foreignObject>`, which
 * means every webfont has to be re-embedded as a data URI and anything the
 * browser lays out differently inside that sandbox comes out wrong. Thirty-odd
 * lines of `fillText` and one `drawImage` are the whole job here, and they
 * produce the same pixels on every machine.
 *
 * Nothing in this module knows about React. `ShareStoryDialog` is the only
 * caller; keeping the drawing separate is what lets the layout be reasoned
 * about (and the numbers below adjusted) without a component re-render in the
 * way.
 */

import theme, { MONO_FONT, SCHEME_PALETTES } from "../theme";
import { toPlainText } from "../components/markdownText";
import type { Post } from "./posts";
import type { Book } from "./books";
import { formatYear } from "./books";
import type { SiteTheme } from "./useSiteTheme";

/**
 * The card. Square, not the 9:16 of the story frame itself.
 *
 * A square posted to a story is centred by Instagram on a background of its
 * own, which costs a band above and below -- and buys two things worth more
 * than that band. **The app's chrome no longer overlaps the card at all**: the
 * account row, the close button and the reply bar fall on the background
 * either side of the square, so every pixel here is usable, where a full-bleed
 * 9:16 had to keep the outer 15% empty against them. And the same file is a
 * feed post, which a 1080x1920 image is not.
 *
 * The trade is height: 794px of content band against a 9:16 card's 1108. What
 * absorbs that is the cover, which is the only elastic thing here -- see the
 * layout pass in `renderStoryCard`.
 */
export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1080;

/** Inset from the top edge to the kicker. A plain margin, not a safe area:
 *  nothing of Instagram's is drawn over a centred square. */
const PADDING_TOP = 96;
/** Inset from the bottom edge to the last line of the footer. Tighter than the
 *  top, because the footer block is visually lighter than the content above it
 *  and an equal inset reads as bottom-heavy. */
const PADDING_BOTTOM = 72;
/** Side margin. Wide, because a card is read at arm's length on a small
 *  screen: short lines are what make it scannable in the two seconds it gets. */
const MARGIN = 96;
const CONTENT_WIDTH = STORY_WIDTH - MARGIN * 2;
/** Rule to the bottom of the wordmark/URL line under it. */
const FOOTER_HEIGHT = 70;

/** The face everything but the URL is set in -- read off the theme rather than
 *  written out again, for the same reason a component may not name it. */
const SANS = theme.typography.fontFamily ?? "sans-serif";

/** Every font this module draws with, so they can be waited for up front. A
 *  canvas silently falls back to the platform sans when a webfont has not
 *  loaded yet, and the result looks like a bug nobody can reproduce -- the
 *  second render, off a warm font cache, comes out right. */
const FONT_SPECS = [
  `600 30px ${SANS}`,
  `700 64px ${SANS}`,
  `700 56px ${SANS}`,
  `700 50px ${SANS}`,
  `400 34px ${SANS}`,
  `600 28px ${SANS}`,
  `700 34px ${SANS}`,
  `400 26px ${MONO_FONT}`,
];

/** What a story card is made of, whatever it was built from. */
export interface StorySubject {
  /** Small line above the title: what kind of thing this is. */
  kicker: string;
  title: string;
  /** Under the title. A book's author and year, or a post's excerpt. */
  blurb: string;
  /** Tags or genres, drawn as pills. Extras that do not fit are dropped. */
  labels: string[];
  coverUrl: string;
  /** How the cover plate is shaped. A jacket is the 2:3 of a paperback, the
   *  same plate `BookCard` uses; a post's lead image is landscape. */
  coverShape: "wide" | "jacket";
  /** The public page this card points at, absolute and with its scheme --
   *  this is what Copy link hands over. The card itself draws it schemeless. */
  url: string;
  /** Used for the download's filename. */
  slug: string;
  /** Whether the page at `url` is actually up. A draft still renders -- the
   *  image is worth preparing ahead of publishing -- but the dialog says so. */
  published: boolean;
}

/** The site's own origin: the admin is served from it, so the public URL of
 *  anything in the admin is this plus a path. Nothing needs configuring. */
function siteOrigin(): string {
  return window.location.origin;
}

/** How a URL reads on the card: no scheme, no trailing slash. The scheme is
 *  noise on a poster and nobody types one any more -- but `StorySubject.url`
 *  keeps it, because that value is also what the Copy link button puts on the
 *  clipboard, and a schemeless link pasted into Instagram is not a link. */
function forDisplay(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function postStory(post: Post): StorySubject {
  return {
    kicker: "New post",
    title: post.title,
    // The same fallback `PostCard` and the admin list use: the excerpt when
    // there is one, the flattened body otherwise. A body's opening sentence on
    // a poster does read as a fragment cut off mid-thought where an excerpt was
    // written to stand alone -- but most posts have no excerpt, and the card
    // that results is a title floating over a rule with nothing under it. A
    // rough teaser beats an empty card, and it is what every other preview of
    // a post on this site already shows.
    blurb: post.excerpt || toPlainText(post.body),
    labels: post.tags,
    coverUrl: post.cover_image_url,
    coverShape: "wide",
    url: `${siteOrigin()}/posts/${post.slug}`,
    slug: post.slug,
    published: post.status === "published",
  };
}

export function bookStory(book: Book): StorySubject {
  return {
    kicker: "Now on the shelf",
    title: book.title,
    // Author and year, not the review: which book this is has to be
    // established first, which is the same call `BookDetail` makes.
    blurb: `${book.author} · ${formatYear(book.release_year)}`,
    labels: book.genres,
    coverUrl: book.cover_image_url,
    coverShape: "jacket",
    url: `${siteOrigin()}/books/${book.slug}`,
    slug: book.slug,
    published: book.status === "published",
  };
}

/** The filename the download lands under. Dated, because the point of these is
 *  that there is a new one every time something is published. */
export function storyFileName(subject: StorySubject): string {
  const day = new Date().toISOString().slice(0, 10);
  return `story-${subject.slug}-${day}.png`;
}

/**
 * The palette of one scheme, as concrete colours.
 *
 * Off `SCHEME_PALETTES` rather than off the live theme, because this has to
 * answer for a scheme that is *not* on screen -- the dialog offers all three.
 * The note on that export lists why none of the three usual ways in work here.
 */
function paletteFor(scheme: SiteTheme) {
  const palette = SCHEME_PALETTES[scheme];
  return {
    background: palette.background.default,
    surface: palette.background.paper,
    text: palette.text.primary,
    muted: palette.text.secondary,
    accent: palette.primary.main,
    divider: palette.divider,
  };
}

/** A hex colour at a given alpha. Every value in `theme.ts` is a hex literal,
 *  so this covers all of them; anything else is returned unchanged rather than
 *  mangled, which loses the transparency but never the colour. */
function withAlpha(colour: string, alpha: number): string {
  const hex = colour.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  const parts = short
    ? short.slice(1).map((c) => parseInt(c + c, 16))
    : long
      ? long.slice(1).map((c) => parseInt(c, 16))
      : null;
  if (!parts) return colour;
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}

/**
 * Load an image the canvas may still be exported after drawing.
 *
 * `crossOrigin = "anonymous"` is the whole point: without it the browser taints
 * the canvas the moment a cross-origin image lands on it, and `toBlob` throws a
 * SecurityError -- so the card would preview perfectly and refuse to save,
 * which is the worst possible place to find out. With it, a bucket that serves
 * no CORS headers fails at *load* instead, here, where the card can simply be
 * drawn without a cover and the dialog can say why.
 *
 * Resolves to null rather than rejecting: a missing cover is a layout the card
 * already has, not an error the caller has to handle.
 */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Greedy word wrap to `maxLines`, the last line ellipsised if there is more.
 *  A word longer than the line is left to overhang rather than broken: a URL
 *  or a title in a language without spaces is rare, and a hyphenated split at
 *  an arbitrary letter looks more like damage than an overhang does. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let line = words[0];
  let truncated = false;

  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${line} ${words[index]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    // The line about to be pushed would be the last one allowed, and there are
    // still words after it: stop and mark it rather than opening a line that
    // has to be thrown away.
    if (lines.length + 1 === maxLines) {
      truncated = true;
      break;
    }
    lines.push(line);
    line = words[index];
  }

  lines.push(truncated ? ellipsise(ctx, `${line}…`, maxWidth) : line);
  return lines;
}

/** Trim from the end until it fits, keeping the ellipsis. */
function ellipsise(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  let out = text;
  while (out.length > 1 && ctx.measureText(out).width > maxWidth) {
    out = `${out.slice(0, -2)}…`;
  }
  return out;
}

/** `object-fit: cover` for a canvas: fill the box, crop the overflow, keep the
 *  middle. A jacket squashed to the plate's aspect is instantly recognisable
 *  as wrong, in a way a cropped one is not. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

/** Title sizes tried in turn. The card would rather set a long title smaller
 *  than drop half of it, so this shrinks before `wrap` starts ellipsising.
 *
 *  A step down from the 9:16 card's 76px, and that is the square's doing
 *  rather than taste: the width is unchanged, so 76px still *fits*, but an
 *  ordinary sixty-character title runs to three lines at it, and three lines of
 *  76px eats the whole budget the cover needs. At 64px the same title still
 *  sets in three and leaves the image room to exist. It is 21px in the dialog's
 *  preview and enormous on a phone either way. */
const TITLE_SIZES = [64, 56, 50];
const TITLE_LEADING = 1.16;
const BLURB_SIZE = 34;
const BLURB_LEADING = 1.42;
const LABEL_HEIGHT = 56;
/** A cover shorter than this is a strip rather than an image, and the card is
 *  better off giving the room to the title. Lower than the 9:16 card's floor:
 *  a 200px band across a 1080 square is a fifth of it, which is a picture. */
const MIN_COVER = 200;

export interface StoryRender {
  canvas: HTMLCanvasElement;
  /** False when the subject has a cover but it could not be drawn -- almost
   *  always the bucket answering without an `Access-Control-Allow-Origin`.
   *  The dialog surfaces this; the card itself is complete without it. */
  coverDropped: boolean;
}

/**
 * Draw the card. Resolves once the fonts and the cover have settled, so the
 * canvas handed back is finished rather than one that fills in later.
 */
export async function renderStoryCard(
  subject: StorySubject,
  scheme: SiteTheme,
): Promise<StoryRender> {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser would not give up a 2D canvas.");

  // Both waits are what stop a first render coming out in the platform sans or
  // without its cover. `document.fonts.load` resolves immediately once a face
  // is cached, so only the very first card pays for it.
  const [image] = await Promise.all([
    loadImage(subject.coverUrl),
    Promise.all(FONT_SPECS.map((spec) => document.fonts.load(spec))).catch(() => []),
  ]);

  const colours = paletteFor(scheme);
  ctx.textBaseline = "top";

  // --- background -------------------------------------------------------
  ctx.fillStyle = colours.background;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  // One wash of the scheme's accent, top-left, well under half strength. A
  // flat fill reads as a slide; this reads as a page with a light on it, and
  // it is the one thing that makes the three schemes obviously different at
  // thumbnail size.
  const glow = ctx.createRadialGradient(
    STORY_WIDTH * 0.16,
    STORY_HEIGHT * 0.08,
    0,
    STORY_WIDTH * 0.16,
    STORY_HEIGHT * 0.08,
    STORY_WIDTH * 1.05,
  );
  glow.addColorStop(0, withAlpha(colours.accent, 0.24));
  glow.addColorStop(1, withAlpha(colours.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  // --- footer, drawn first because it is anchored, not flowed ------------
  // Wordmark and URL on **one** line, where the 9:16 card stacked them. Stacked
  // they cost 124px below the rule, which on a square is 12% of the card and
  // came straight out of the cover; side by side they cost 70. There is room
  // across, since neither is long.
  const footerRuleY = STORY_HEIGHT - PADDING_BOTTOM - FOOTER_HEIGHT;
  ctx.fillStyle = colours.divider;
  ctx.fillRect(MARGIN, footerRuleY, CONTENT_WIDTH, 2);

  ctx.font = `700 34px ${SANS}`;
  ctx.fillStyle = colours.text;
  const markWidth = ctx.measureText("Zian Tsabit").width;
  ctx.fillText("Zian Tsabit", MARGIN, footerRuleY + 34);

  // Right-aligned against the same margin the rule ends at, and ellipsised to
  // whatever the wordmark left -- a long slug must not run under it.
  ctx.font = `400 26px ${MONO_FONT}`;
  ctx.fillStyle = colours.muted;
  ctx.textAlign = "right";
  ctx.fillText(
    ellipsise(ctx, forDisplay(subject.url), CONTENT_WIDTH - markWidth - 32),
    STORY_WIDTH - MARGIN,
    footerRuleY + 40,
  );
  ctx.textAlign = "left";

  // --- measure the content block before placing any of it ----------------
  // Everything is laid out against the space that is actually left, so a long
  // title shrinks the cover rather than sliding under the footer. Measuring
  // first is also what lets the whole block be centred in the band, which is
  // what keeps a two-word title from floating alone at the top.
  const available = footerRuleY - 64 - PADDING_TOP;

  ctx.letterSpacing = "6px";
  ctx.font = `600 30px ${SANS}`;
  const kicker = subject.kicker.toUpperCase();
  ctx.letterSpacing = "0px";

  let titleSize = TITLE_SIZES[TITLE_SIZES.length - 1];
  let titleLines: string[] = [];
  // Two lines each beside a cover, four without. This is what the square costs:
  // the 9:16 card could afford three and three, and at those the text alone ate
  // the whole budget here and the cover was squeezed under MIN_COVER and
  // dropped -- a card with a picture that silently has no picture. Clamping the
  // *text* instead lets the shrink do the right thing: a long title steps down
  // through TITLE_SIZES until it sets in two, and the room it gives up goes to
  // the image. With these the cover cannot be squeezed out at all, which makes
  // MIN_COVER a safety net rather than something reached in practice.
  const titleMaxLines = image ? 2 : 4;
  for (const size of TITLE_SIZES) {
    ctx.font = `700 ${size}px ${SANS}`;
    const lines = wrap(ctx, subject.title, CONTENT_WIDTH, titleMaxLines);
    titleSize = size;
    titleLines = lines;
    // Fits without being cut: stop here. Otherwise try the next size down, and
    // accept the smallest if even that has to ellipsise.
    if (!lines[lines.length - 1]?.endsWith("…")) break;
  }

  ctx.font = `400 ${BLURB_SIZE}px ${SANS}`;
  const blurbLines = wrap(ctx, subject.blurb, CONTENT_WIDTH, image ? 2 : 4);

  ctx.font = `600 28px ${SANS}`;
  const labels = fitLabels(ctx, subject.labels, CONTENT_WIDTH);

  const kickerHeight = 30 + 40;
  const titleHeight = titleLines.length * titleSize * TITLE_LEADING;
  const blurbHeight = blurbLines.length
    ? 28 + blurbLines.length * BLURB_SIZE * BLURB_LEADING
    : 0;
  const labelsHeight = labels.length ? 32 + LABEL_HEIGHT : 0;
  const textHeight = kickerHeight + titleHeight + blurbHeight + labelsHeight;

  // The cover takes whatever is left over, up to the shape's natural size. It
  // is the only elastic thing on the card: text that shrinks to fit stops
  // being readable, and a cover that does is still a cover.
  const coverGap = 56;
  // Ceilings, not sizes: the cover takes whatever the text leaves, up to these.
  // Both are down from the 9:16 card's, which a square has no room for.
  const preferred = subject.coverShape === "jacket"
    ? { width: 420, height: 630 }
    : { width: CONTENT_WIDTH, height: 420 };
  let coverHeight = image
    ? Math.min(preferred.height, available - textHeight - coverGap)
    : 0;
  if (coverHeight < MIN_COVER) coverHeight = 0;
  const coverWidth = coverHeight
    ? preferred.width * (coverHeight / preferred.height)
    : 0;
  const coverHeightTotal = coverHeight ? coverHeight + coverGap : 0;

  // --- draw the block ----------------------------------------------------
  // Centred in the band. The 9:16 card anchored this to the footer instead, so
  // that its slack collected at the top where Instagram's chrome was going to
  // cover it anyway -- on a square nothing covers anything, so that trade is
  // gone and anchoring only buys a conspicuously empty top half on a card with
  // a short title. A card carrying a cover fills the band to within a few
  // pixels either way, so this changes nothing for most of them.
  const total = textHeight + coverHeightTotal;
  let y = PADDING_TOP + Math.max(0, (available - total) / 2);

  ctx.letterSpacing = "6px";
  ctx.font = `600 30px ${SANS}`;
  ctx.fillStyle = colours.accent;
  ctx.fillText(kicker, MARGIN, y);
  ctx.letterSpacing = "0px";
  y += kickerHeight;

  if (image && coverHeight) {
    // Rounded like every surface on the site, and on a plate of `paper` so a
    // cover with transparency (a PNG jacket) still sits on something rather
    // than on the gradient.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(MARGIN, y, coverWidth, coverHeight, 28);
    ctx.fillStyle = colours.surface;
    ctx.fill();
    ctx.clip();
    drawCover(ctx, image, MARGIN, y, coverWidth, coverHeight);
    ctx.restore();
    y += coverHeightTotal;
  }

  ctx.fillStyle = colours.text;
  for (const line of titleLines) {
    ctx.font = `700 ${titleSize}px ${SANS}`;
    ctx.fillText(line, MARGIN, y);
    y += titleSize * TITLE_LEADING;
  }

  if (blurbLines.length) {
    y += 28;
    ctx.font = `400 ${BLURB_SIZE}px ${SANS}`;
    ctx.fillStyle = colours.muted;
    for (const line of blurbLines) {
      ctx.fillText(line, MARGIN, y);
      y += BLURB_SIZE * BLURB_LEADING;
    }
  }

  if (labels.length) {
    y += 32;
    drawLabels(ctx, labels, MARGIN, y, colours);
  }

  return { canvas, coverDropped: Boolean(subject.coverUrl) && !image };
}

const LABEL_PAD = 26;
const LABEL_GAP = 16;

/** As many labels as fit on one row. A second row of pills starts to look like
 *  a form rather than a poster, and the tags are the least important thing on
 *  the card -- the ones that do not fit are simply not shown. The caller has
 *  already set the label font. */
function fitLabels(
  ctx: CanvasRenderingContext2D,
  labels: string[],
  maxWidth: number,
): string[] {
  const kept: string[] = [];
  let used = 0;
  for (const label of labels) {
    const width = ctx.measureText(label).width + LABEL_PAD * 2;
    if (used + width > maxWidth) break;
    kept.push(label);
    used += width + LABEL_GAP;
  }
  return kept;
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  labels: string[],
  x: number,
  y: number,
  colours: ReturnType<typeof paletteFor>,
) {
  ctx.font = `600 28px ${SANS}`;
  let cursor = x;
  for (const label of labels) {
    const width = ctx.measureText(label).width + LABEL_PAD * 2;
    // An outline, not a fill: the same pill `TagChip` renders on the site.
    ctx.beginPath();
    ctx.roundRect(cursor, y, width, LABEL_HEIGHT, LABEL_HEIGHT / 2);
    ctx.strokeStyle = colours.divider;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = colours.muted;
    ctx.fillText(label, cursor + LABEL_PAD, y + (LABEL_HEIGHT - 28) / 2 - 2);
    cursor += width + LABEL_GAP;
  }
}

/** The canvas as a PNG blob, for saving and for the share sheet. */
export function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      // Only a tainted canvas fails here, which `loadImage` already prevents --
      // but a silent null would leave the dialog waiting forever.
      if (blob) resolve(blob);
      else reject(new Error("The card could not be turned into an image."));
    }, "image/png");
  });
}
