import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    /** Background of the fixed header once the page is scrolled. */
    headerScrolled: string;
  }
  interface PaletteOptions {
    headerScrolled?: string;
  }
}

// Colours live here rather than inline in components, because a literal like
// `color: "white"` or `grey.900` means the same thing in both schemes and so
// cannot follow the mode. Components should reference semantic tokens
// (`text.primary`, `background.default`, `divider`, `primary.main`) instead.
const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
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
      },
    },
    dark: {
      palette: {
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
      },
    },
  },
  typography: {
    fontFamily: "'IBM Plex Sans', sans-serif",
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

export default theme;
