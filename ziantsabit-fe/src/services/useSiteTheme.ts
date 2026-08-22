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
    if (next === "light") {
      setColorScheme({ dark: "dark" });
      setMode("light");
      return;
    }
    // Both remaining choices are dark-mode schemes; only which one differs.
    setColorScheme({ dark: next });
    setMode("dark");
  };

  return { theme, setTheme };
}
