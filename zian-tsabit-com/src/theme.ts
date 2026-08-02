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
        // ~3.1:1 on white, below the 4.5:1 needed for body text.
        primary: { main: "#1565c0" },
        background: { default: "#ffffff", paper: "#f5f5f5" },
        text: { primary: "#1a1a1a", secondary: "#5f6368" },
        divider: "#e0e0e0",
        headerScrolled: "rgba(255, 255, 255, 0.85)",
      },
    },
    dark: {
      palette: {
        primary: { main: "#6497b1" },
        background: { default: "#000000", paper: "#121212" },
        text: { primary: "#ffffff", secondary: "#9e9e9e" },
        divider: "#2e2e2e",
        headerScrolled: "rgba(0, 0, 0, 0.85)",
      },
    },
  },
  typography: {
    fontFamily: "'Ubuntu', sans-serif",
  },
});

export default theme;
