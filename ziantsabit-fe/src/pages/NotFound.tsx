import { Link } from "react-router-dom";
import { Box, Container, Typography } from "@mui/material";

import Centered from "../components/Centered";
import Typewriter from "../components/Typewriter";

/**
 * The catch-all for a path no route matches.
 *
 * Worth having beyond tidiness: routing is client-side, so `nginx.conf` rewrites
 * every unknown path to `index.html` (see the Dockerfile). A typo'd or stale URL
 * therefore reaches the app rather than the server's 404, and without this route
 * it rendered the header and footer wrapped around a completely empty `<main>` --
 * indistinguishable from a page that failed to load.
 *
 * It reuses `Centered` + `Typewriter` so a missing *page* reads the same way as
 * PostDetail's missing *post*, rather than inventing a second 404 style.
 */
function NotFound() {
  return (
    <Box
      sx={{
        width: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "transparent",
        alignItems: "center",
        pt: { xs: 2, sm: 3 },
      }}
    >
      <Container
        maxWidth="md"
        sx={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        <Centered>
          <Typewriter text="Page not found..." />
          <Typography
            component={Link}
            to="/"
            sx={{
              fontSize: { xs: "13px", sm: "14px" },
              color: "primary.main",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {/* A literal glyph, matching PostDetail's "← Back to ..." link. */}
            ← Back to home
          </Typography>
        </Centered>
      </Container>
    </Box>
  );
}

export default NotFound;
