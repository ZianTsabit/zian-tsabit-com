import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    /** Background of the fixed header once the page is scrolled. */
    headerScrolled: string;
    /** Colour of a falling glyph in the rain scheme's overlay, at full
     *  strength -- `RainOverlay` draws every drop well under 1 alpha, so this
     *  is the ceiling rather than what anything is actually painted at. */
    rainDrop: string;
    /** The wash a lightning strike puts over the page, and the colour of the
     *  bolt itself. Also only ever drawn at a fraction of its alpha. */
    lightning: string;
  }
  interface PaletteOptions {
    headerScrolled?: string;
    rainDrop?: string;
    lightning?: string;
  }
  /** `rain` is a third colour scheme beside light and dark. Without this
   *  augmentation TypeScript rejects the key on `colorSchemes` and every
   *  `setColorScheme("rain")` call. */
  interface ColorSchemeOverrides {
    rain: true;
  }
}

/**
 * Overcast. A third scheme rather than a variant of dark, because it is a
 * different *look* and not a different brightness: desaturated blue-grey
 * throughout, where the dark scheme is warm and neutral.
 *
 * **It is built with its own `createTheme` call, and it has to be.** MUI runs
 * `createPalette` -- which fills in the greys, the action states, the augmented
 * colour channels and everything else a component reads -- only for the schemes
 * it knows by name, `light` and `dark`. A custom scheme is taken as already
 * complete, so declaring this one inline the way the other two are crashes the
 * whole app at import time with `Cannot read properties of undefined (reading
 * 'background')`. Running it through `createTheme` first is what produces the
 * full palette; the three site-specific tokens are added afterwards, since
 * `createPalette` knows nothing about them.
 *
 * `palette.mode` is "dark", which is what tells MUI to treat this as the dark
 * half of the light/dark pair -- every component that branches on the mode (an
 * input's outline, a disabled label) then picks its dark-scheme behaviour
 * rather than its light one. Selecting it therefore means setting the mode to
 * dark *and* naming this as the dark scheme; see `useSiteTheme`.
 *
 * The page is deliberately *bluer and a shade lighter* than the dark scheme's
 * #121212 rather than merely a tint of it: two near-black schemes a visitor
 * cannot tell apart is a picker with a wasted entry, and lightning needs a sky
 * to read against.
 *
 * Contrast, measured against the two backgrounds below: body text 11.83:1 /
 * 10.28:1, secondary 6.48:1 / 5.63:1, links 7.31:1 / 6.35:1. `paper` sits
 * 1.15:1 off the page and `divider` reads at 1.59:1, matching the separations
 * the dark scheme has (1.12:1 and 1.55:1) so a card edge and a rule are exactly
 * as visible here as there.
 */
const rainPalette = {
  ...createTheme({
    palette: {
      mode: "dark",
      primary: { main: "#8ab4d4" },
      background: { default: "#1b2229", paper: "#252d35" },
      text: { primary: "#d7dee5", secondary: "#9aa6b2" },
      divider: "#39434d",
    },
  }).palette,
  headerScrolled: "rgba(27, 34, 41, 0.85)",
  // Dimmer than `primary.main` and greyer: rain read against the sky is not the
  // colour of a link, and drops in the site's accent blue looked like
  // decoration rather than weather.
  rainDrop: "#7f96a8",
  // Pale blue-white. Deliberately not #ffffff: a pure-white flash over a
  // blue-grey page reads as a rendering fault rather than as sky.
  lightning: "#cfe4f5",
};

/** The light scheme, and the site's default. Named rather than declared
 *  inline so `SCHEME_PALETTES` below can hand it to something that is not a
 *  component -- see the note there. */
const lightPalette = {
  // Darker than the dark scheme's link colour: #6497b1 only reaches
  // ~3.1:1 on this background, below the 4.5:1 needed for body text.
  primary: { main: "#1565c0" },
  // Bone white rather than #ffffff -- warmer, and easier to read a long
  // post against. `paper` and `divider` are warmed to match: a neutral
  // grey card on a warm page reads as a slightly dirty white, not as a
  // separate surface. paper sits 1.09:1 off the page, the same
  // separation #f5f5f5 had against pure white, so a card edge is exactly
  // as visible as before. Every foreground still clears AA on both:
  // secondary text 5.60:1 on the page and 5.13:1 on paper, links 5.32:1
  // and 4.87:1.
  background: { default: "#f9f6ee", paper: "#f1ece0" },
  text: { primary: "#1a1a1a", secondary: "#5f6368" },
  divider: "#e3ddd0",
  headerScrolled: "rgba(249, 246, 238, 0.85)",
  // Declared in every scheme; see the note on the dark scheme's pair.
  rainDrop: "#1565c0",
  lightning: "#1a1a1a",
};

/** The dark scheme. Named for the same reason as `lightPalette`. */
const darkPalette = {
  primary: { main: "#6497b1" },
  // Soft black rather than #000000 -- an OLED-black page under white
  // text glares, and there is nowhere left to go below it when a surface
  // needs to sit *under* the page. `paper` rises with it (#121212 was
  // the page's old colour, so it would have vanished into it) and keeps
  // the 1.12:1 separation a card had before. `divider` is lifted to
  // #363636, which reads at 1.55:1 here -- what #2e2e2e read at on pure
  // black. Foregrounds are still far clear of AA: secondary text 6.99:1
  // on the page and 6.22:1 on paper, links 5.89:1 and 5.24:1.
  background: { default: "#121212", paper: "#1e1e1e" },
  // The same bone white the light scheme uses as its page, now as the
  // text: pure #ffffff on a dark page is the pairing that glares, and
  // the two schemes end up sharing one ink-and-paper pair rather than
  // each inventing a white. `secondary` is warmed to #a39e95 to match --
  // a neutral grey beside warm white reads faintly blue -- and it lands
  // at 7.03:1 on the page, where #9e9e9e was 6.99:1. Body text is
  // 17.35:1 on the page and 15.44:1 on paper.
  text: { primary: "#f9f6ee", secondary: "#a39e95" },
  divider: "#363636",
  headerScrolled: "rgba(18, 18, 18, 0.85)",
  // Unused outside the rain scheme, but every scheme has to declare them
  // or the CSS variable is simply absent under `.light`/`.dark` and
  // `RainOverlay` resolves an empty string. It cannot be reached from
  // those schemes -- the overlay only mounts under `rain` -- so the
  // values here are just the tokens that would make sense if it could.
  rainDrop: "#6497b1",
  lightning: "#f9f6ee",
};

// Colours live here rather than inline in components, because a literal like
// `color: "white"` or `grey.900` means the same thing in both schemes and so
// cannot follow the mode. Components should reference semantic tokens
// (`text.primary`, `background.default`, `divider`, `primary.main`) instead.
const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: lightPalette,
    },
    dark: {
      palette: darkPalette,
    },
    // Built above rather than declared inline; see `rainPalette`.
    rain: { palette: rainPalette },
  },
  typography: {
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  components: {
    MuiButton: {
      styleOverrides: {
        // Material sets every button label in capitals. Nothing else on this
        // site does -- not the nav, not the headings, not the wordmark -- so a
        // button was the one thing on a page shouting, and it read as a control
        // borrowed from another design rather than part of this one. Here
        // rather than per-button so the buttons cannot disagree with each
        // other: one sentence-case action beside an uppercase one looks like a
        // mistake, which is exactly what a per-button fix produces.
        root: { textTransform: "none" },
      },
    },
  },
});

/**
 * The monospace face, for `code`, the Markdown editor's Write tab and the
 * admin's slug column.
 *
 * It needs a home of its own because MUI's typography has one `fontFamily`
 * slot and it is already spent on the body face. Everything else inherits the
 * theme, so this is the only font any component should name: a component
 * writing out the *body* font is redundant at best, and silently ignores a
 * later change to the theme at worst -- the same trap as a colour literal.
 */
export const MONO_FONT = "'IBM Plex Mono', monospace";


/**
 * The three schemes' palettes, reachable without a `ThemeProvider`.
 *
 * For code that has to *draw* a colour rather than hand a token to a component
 * -- `storyCard.ts`, which paints onto a canvas -- and specifically for code
 * that needs a scheme other than the one on screen. The three usual ways in all
 * fail there: `theme.vars.palette.x` is the string "var(--mui-palette-x)",
 * which means nothing to `fillStyle`; `theme.palette.x` always answers for the
 * default scheme; and reading the CSS variable off the root, which is what
 * `RainOverlay` does, can only ever describe the scheme being displayed.
 *
 * The values are the same objects `colorSchemes` above is built from, so this
 * is a second way in rather than a second copy -- `theme.ts` is still the only
 * place a colour is written.
 */
export const SCHEME_PALETTES = {
  light: lightPalette,
  dark: darkPalette,
  rain: rainPalette,
};

export default theme;
