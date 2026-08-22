import { useEffect, useRef } from "react";
import { useColorScheme } from "@mui/material/styles";

/**
 * The site's theme choice, as one value rather than MUI's two.
 *
 * MUI keeps *mode* (light / dark / system) separate from *colour scheme* (which
 * palette answers for light and which for dark), which is the right shape for a
 * site with one palette per brightness and the wrong shape for this one: `rain`
 * is a third look, not a third brightness. It declares `palette.mode: "dark"`
 * so components branching on the mode behave sensibly, which means selecting it
 * is two calls -- set the mode to dark, and name `rain` as the dark scheme --
 * and forgetting either leaves the page half-changed.
 *
 * So this hook is the only thing that should call `setMode` or `setColorScheme`
 * on this site. Everything else asks for a `SiteTheme`.
 *
 * **Picking light or dark resets the dark scheme back to `dark`.** Without
 * that, leaving rain would leave `mui-color-scheme-dark` set to `rain`, and
 * choosing Dark again -- or the OS flipping, if system mode is ever offered --
 * would silently bring the rain back.
 */
export type SiteTheme = "light" | "dark" | "rain";

/** In the order the picker lists them: two brightnesses, then the weather. */
export const SITE_THEMES: SiteTheme[] = ["light", "dark", "rain"];

export const THEME_LABELS: Record<SiteTheme, string> = {
  light: "Light",
  dark: "Dark",
  rain: "Rain",
};

/** Whether a string off the API names one of the three schemes this site has. */
export function asSiteTheme(value: string | null | undefined): SiteTheme | null {
  return SITE_THEMES.includes(value as SiteTheme) ? (value as SiteTheme) : null;
}

/**
 * Where the reader's own theme waits while a post is borrowing the page.
 *
 * The module variable is the one this code reads: it is exact, it survives a
 * blocked `localStorage`, and every hand-back inside a single visit goes
 * through it. The storage key exists for one case the variable cannot cover --
 * the tab being closed mid-post. MUI persists whatever scheme is showing, so
 * without a record on disk the reader would come back tomorrow to the theme
 * some post picked for them, which is the exact thing this feature must not do.
 *
 * Reclaiming that record is the inline script in `index.html`, not this module:
 * it has to happen before first paint, and by the time React runs MUI has
 * already read its own keys.
 */
const HANDBACK_KEY = "theme-handback";

let pending: SiteTheme | null = null;

function rememberChoice(theme: SiteTheme): void {
  pending = theme;
  try {
    localStorage.setItem(HANDBACK_KEY, theme);
  } catch {
    // Private mode or blocked storage. The variable above still holds, so
    // everything but the closed-tab case keeps working.
  }
}

function forgetChoice(): void {
  pending = null;
  try {
    localStorage.removeItem(HANDBACK_KEY);
  } catch {
    /* see above */
  }
}

/** The theme owed back to the reader, or null if nothing was borrowed. */
function takeChoice(): SiteTheme | null {
  const owed = pending;
  forgetChoice();
  return owed;
}

/** MUI's two setters, which only this module may call. */
type Controls = Pick<ReturnType<typeof useColorScheme>, "setMode" | "setColorScheme">;

/**
 * The two-call dance, without the side effects of a reader choosing.
 *
 * Split out from `setTheme` because a post applying a theme must *not* clear
 * the hand-back: it is the thing that wrote it.
 */
function applyTheme({ setMode, setColorScheme }: Controls, next: SiteTheme): void {
  if (next === "light") {
    setColorScheme({ dark: "dark" });
    setMode("light");
    return;
  }
  // Both remaining choices are dark-mode schemes; only which one differs.
  setColorScheme({ dark: next });
  setMode("dark");
}

interface SiteThemeState {
  /** `undefined` until the provider has read storage -- the first render of a
   *  page has no answer yet, and a control that guesses flashes the wrong
   *  icon. Callers render a placeholder until this is set. */
  theme: SiteTheme | undefined;
  setTheme: (next: SiteTheme) => void;
}

export function useSiteTheme(): SiteThemeState {
  const { mode, colorScheme, setMode, setColorScheme } = useColorScheme();

  // `colorScheme` is the authority, not `mode`: rain and dark share a mode, so
  // the mode alone cannot tell them apart. It is undefined on the first render
  // for the same reason `mode` is.
  const theme = mode === undefined ? undefined : (colorScheme as SiteTheme | undefined);

  const setTheme = (next: SiteTheme) => {
    // An explicit pick settles it: there is no longer an earlier choice worth
    // handing back, so a post that borrowed the page loses its claim on it.
    // Without this, leaving a themed post would undo the reader's own choice
    // seconds after they made it.
    forgetChoice();
    applyTheme({ setMode, setColorScheme }, next);
  };

  return { theme, setTheme };
}

/**
 * Read this post in the theme it asks for, whatever the reader picked before.
 *
 * Pass the post's theme, or `null` for a post that names none -- which is the
 * default and means the reader's own choice stands.
 *
 * It goes through MUI's real state rather than swapping the class on `<html>`
 * by hand, and that is not fussiness: `RainOverlay` mounts off
 * `useColorScheme().colorScheme`, so a rain post whose scheme was applied
 * behind MUI's back would get the palette and no weather.
 *
 * **The reader keeps the last word.** The header's picker still works while an
 * overridden post is open, and using it releases the override for good (see
 * `setTheme`). A theme somebody cannot get out of is the wrong thing to do to
 * a reader who needs a particular one.
 *
 * **The switch happens when the post arrives, not before**, because the theme
 * is part of the post and there is nothing to read until then. That puts the
 * change on the same frame the content appears on, which is the least jarring
 * moment available -- the alternative is a second round trip before anything
 * renders at all.
 */
export function usePostTheme(theme: SiteTheme | null): void {
  const { mode, colorScheme, setMode, setColorScheme } = useColorScheme();
  const controls = { setMode, setColorScheme };

  // `colorScheme` is the authority over `mode` for the same reason it is in
  // `useSiteTheme`: rain and dark share a mode.
  const reader = mode === undefined ? undefined : (colorScheme as SiteTheme | undefined);

  // Read through a ref inside the effects rather than listed as dependencies:
  // applying a theme *changes* both, so depending on them would re-run the
  // effect against the theme it had just applied.
  const latest = useRef({ controls, reader });
  latest.current = { controls, reader };

  // Whether MUI has read storage yet. A dependency because it flips exactly
  // once, from undefined to a real scheme, and the take-over has to wait for
  // it -- overriding before then would record `undefined` as what the reader
  // chose and have nothing to give back.
  const ready = reader !== undefined;

  useEffect(() => {
    if (!ready) return;
    const live = latest.current.controls;

    if (theme === null) {
      // This post asks for nothing, so anything an earlier one borrowed is due
      // back now -- navigating from a rain post to an ordinary one is a
      // hand-back without an unmount.
      const owed = takeChoice();
      if (owed) applyTheme(live, owed);
      return;
    }

    // Only take a note when there is not one already. Moving between two
    // themed posts must not overwrite the reader's choice with the previous
    // post's -- and `latest.reader` is exactly that stale value here, since
    // nothing has re-rendered between the two effect runs.
    if (pending === null) {
      const own = latest.current.reader;
      // Already showing it: nothing was borrowed, so nothing is owed.
      if (own === theme) return;
      if (own) rememberChoice(own);
    }
    applyTheme(live, theme);
  }, [theme, ready]);

  // Leaving the post entirely -- back to the feed, off to the CV. Its own
  // effect, with no dependencies, so it runs on the way out and not between
  // two posts; the effect above is what handles that case.
  useEffect(
    () => () => {
      const owed = takeChoice();
      if (owed) applyTheme(latest.current.controls, owed);
    },
    [],
  );
}
