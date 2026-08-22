import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { useColorScheme, useTheme } from "@mui/material/styles";

import { MONO_FONT } from "../theme";

/**
 * Resolve a theme colour into something a canvas can use.
 *
 * With `cssVariables` on, `theme.vars.palette.x` is the string
 * `"var(--mui-palette-x)"` -- fine in `sx`, meaningless to `fillStyle`. Reading
 * the variable off the root gets the literal the *active* scheme resolved it
 * to, which `theme.palette.x` would not: on a CSS-variables theme that is the
 * default scheme's value, so it would hand back the light palette's colour
 * while the page is showing rain.
 */
function resolveColour(reference: string): string {
  const name = reference.match(/^var\((--[^),\s]+)/)?.[1];
  if (!name) return reference;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || reference;
}

/** Glyphs a drop is drawn with, nearest tier first. A near drop is a solid
 *  stroke, a far one is barely a speck -- which is most of what sells depth,
 *  since all three tiers are otherwise the same colour. */
const GLYPHS = ["|", ":", "."];
/** Font size per tier, px. Nearer is bigger and faster. */
const SIZES = [15, 11, 8];
/** Falling speed per tier, px per second. */
const SPEEDS = [1150, 780, 460];
/** Alpha ceiling per tier, before the trail's own fade. */
const ALPHAS = [0.55, 0.38, 0.22];
/** Glyphs in one drop's trail, per tier. */
const TRAIL = [4, 3, 2];

/**
 * Horizontal drift, as a fraction of the fall speed.
 *
 * Rain that falls straight down reads as a screensaver; a slight, *consistent*
 * slant reads as weather, because every drop is being pushed by the same wind.
 * Small on purpose -- past about 0.4 the streaks start to look like snow being
 * blown sideways.
 */
const WIND = 0.22;

/** One drop per this many square pixels of viewport. */
const AREA_PER_DROP = 7500;
/** However large the window, never draw more than this many. */
const MAX_DROPS = 260;

/** Seconds between lightning strikes, picked uniformly in this range. */
const STRIKE_GAP = [7, 22];
/** How long one strike's flicker lasts, ms. */
const STRIKE_MS = 620;
/**
 * Peak alpha of the flash wash.
 *
 * Kept low deliberately. This layer sits *over* the page, so the flash is
 * being painted across text somebody may be reading, and a bright full-screen
 * pulse is both unpleasant and a photosensitivity risk. At this alpha it reads
 * as the sky lighting up behind the page rather than as the page blinking --
 * and the whole effect is off under `prefers-reduced-motion` regardless.
 */
const FLASH_ALPHA = 0.16;

interface Drop {
  x: number;
  y: number;
  tier: number;
}

/** A jagged top-to-bottom path, as grid points to draw glyphs along. */
interface Bolt {
  points: { x: number; y: number; glyph: string }[];
}

function randomBolt(width: number, height: number): Bolt {
  const step = 14;
  const points: Bolt["points"] = [];
  // Middle 70% of the width: a bolt hugging the edge is mostly off-screen.
  let x = width * 0.15 + Math.random() * width * 0.7;
  let y = 0;
  // Strikes stop partway down rather than reaching the bottom, so the bolt
  // reads as distant sky rather than as something hitting the page.
  const end = height * (0.45 + Math.random() * 0.3);

  while (y < end) {
    const drift = (Math.random() - 0.5) * step * 2.4;
    // The glyph follows the direction of travel, which is what makes the run
    // of characters read as one continuous line instead of a dotted column.
    const glyph = drift > step * 0.4 ? "\\" : drift < -step * 0.4 ? "/" : "|";
    points.push({ x, y, glyph });
    x += drift;
    y += step;
  }
  return { points };
}

/**
 * The falling-ASCII layer of the rain scheme.
 *
 * **It sits on top of the page, not behind it.** Behind was the first attempt
 * and it does not work: the feed pages paint an opaque `background.default`
 * over their whole column, so the rain was visible on the CV and invisible on
 * the blog. On top it needs no cooperation from any page, and rain in front of
 * the content is the truer image anyway -- you are looking at the site through
 * the weather. `pointerEvents: none` is what keeps it from eating every click.
 *
 * Canvas rather than DOM nodes or one big `<pre>`: a couple of hundred glyphs
 * are repositioned every frame, and per-glyph alpha is what makes a trail fade
 * into the distance -- a single `<pre>` can only be one colour, and 260 spans
 * would be 260 style recalculations a frame.
 *
 * **`prefers-reduced-motion` turns off the animation *and* the lightning**, and
 * leaves a single static field of drops. Not an empty layer: the scheme is
 * called Rain and a visitor who picked it should still get rain, just not
 * moving rain. This is the one branch worth testing by hand after any change
 * here, since nothing else exercises it.
 */
function RainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  // Read as `var(...)` references here and resolved inside the effect, where
  // the DOM can say what the active scheme made of them.
  const dropRef = (theme.vars ?? theme).palette.rainDrop;
  const boltRef = (theme.vars ?? theme).palette.lightning;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const dropColour = resolveColour(dropRef);
    const boltColour = resolveColour(boltRef);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let drops: Drop[] = [];
    let frame = 0;
    let last = 0;
    let nextStrike = 0;
    let strikeStart = -Infinity;
    let bolt: Bolt | null = null;

    const spawn = (drop: Drop, atTop: boolean) => {
      drop.tier = Math.floor(Math.random() * GLYPHS.length);
      drop.x = Math.random() * (width + height * WIND) - height * WIND;
      // On a resize or first fill, scatter drops down the whole height instead
      // of releasing them all from the top -- otherwise the rain arrives as one
      // visible curtain a second after the theme is picked.
      drop.y = atTop ? -Math.random() * height * 0.3 : Math.random() * height;
    };

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      // Reset before scaling: setting canvas.width already cleared the context,
      // but the transform is cumulative and would compound on every resize.
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const wanted = Math.min(
        MAX_DROPS,
        Math.round((width * height) / AREA_PER_DROP),
      );
      drops = Array.from({ length: wanted }, () => {
        const drop = { x: 0, y: 0, tier: 0 };
        spawn(drop, false);
        return drop;
      });
      if (reduced.matches) paint(0);
    };

    /** Draw one frame. `elapsed` is seconds since the previous one. */
    const paint = (elapsed: number) => {
      context.clearRect(0, 0, width, height);
      context.textBaseline = "top";

      for (const drop of drops) {
        const size = SIZES[drop.tier];
        const speed = SPEEDS[drop.tier];
        const trail = TRAIL[drop.tier];
        context.font = `${size}px ${MONO_FONT}`;
        context.fillStyle = dropColour;

        for (let step = 0; step < trail; step += 1) {
          // The trail is where the drop *was*, so it runs back up the slope it
          // is travelling down, fading as it goes.
          const y = drop.y - step * size;
          const x = drop.x - step * size * WIND;
          context.globalAlpha = ALPHAS[drop.tier] * (1 - step / trail);
          context.fillText(GLYPHS[drop.tier], x, y);
        }

        drop.y += speed * elapsed;
        drop.x += speed * WIND * elapsed;
        if (drop.y - TRAIL[drop.tier] * SIZES[drop.tier] > height) {
          spawn(drop, true);
        }
      }

      context.globalAlpha = 1;
    };

    /** The flash envelope: a bright stab, a dip, then a weaker second pulse --
     *  which is what makes it read as lightning rather than as a fade. */
    const flashAlpha = (age: number): number => {
      const t = age / STRIKE_MS;
      if (t < 0 || t > 1) return 0;
      if (t < 0.06) return t / 0.06;
      if (t < 0.22) return 1 - (t - 0.06) / 0.16;
      if (t < 0.34) return (t - 0.22) / 0.12 * 0.7;
      return Math.max(0, 0.7 * (1 - (t - 0.34) / 0.66));
    };

    const paintStrike = (now: number) => {
      const alpha = flashAlpha(now - strikeStart);
      if (alpha <= 0) return;

      context.fillStyle = boltColour;
      context.globalAlpha = alpha * FLASH_ALPHA;
      context.fillRect(0, 0, width, height);

      // The bolt itself is only up for the first stab, so it is a glimpse
      // rather than a shape sitting on the page for half a second.
      if (bolt && now - strikeStart < 170) {
        context.globalAlpha = alpha * 0.75;
        context.font = `16px ${MONO_FONT}`;
        for (const point of bolt.points) {
          context.fillText(point.glyph, point.x, point.y);
        }
      }
      context.globalAlpha = 1;
    };

    const scheduleStrike = (now: number) => {
      const [low, high] = STRIKE_GAP;
      nextStrike = now + (low + Math.random() * (high - low)) * 1000;
    };

    const tick = (now: number) => {
      // The first frame has no previous one to measure against, and a tab
      // returning from the background reports a gap of minutes -- either would
      // teleport every drop off the bottom of the screen.
      const elapsed = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;

      paint(elapsed);

      if (now >= nextStrike) {
        strikeStart = now;
        bolt = randomBolt(width, height);
        scheduleStrike(now);
      }
      paintStrike(now);

      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      last = 0;
      if (reduced.matches) {
        paint(0);
        return;
      }
      scheduleStrike(performance.now());
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    // A visitor turning reduced motion on mid-session should see it stop.
    const onMotionChange = () => {
      stop();
      context.clearRect(0, 0, width, height);
      start();
    };

    resize();
    start();
    window.addEventListener("resize", resize);
    reduced.addEventListener("change", onMotionChange);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      reduced.removeEventListener("change", onMotionChange);
    };
  }, [dropRef, boltRef]);

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      // Decorative, and there is nothing to announce: a screen reader has no
      // use for "canvas" here, and describing the weather would be noise on
      // every page.
      aria-hidden
      sx={{
        position: "fixed",
        inset: 0,
        // Over the fixed header (1000) so the rain falls in front of the whole
        // page, but under MUI's Drawer (1200) and Dialog (1300) -- raining on
        // the delete-confirmation dialog would read as a glitch.
        zIndex: 1001,
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * Mounts the rain layer, and only under the rain scheme.
 *
 * A separate component from the canvas so that leaving the scheme *unmounts*
 * it: the effect's cleanup is what cancels the animation frame, and a canvas
 * that merely hid itself would keep painting forever behind a light page.
 */
function RainOverlay() {
  const { colorScheme } = useColorScheme();
  return colorScheme === "rain" ? <RainCanvas /> : null;
}

export default RainOverlay;
