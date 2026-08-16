import { Alert, Box, Button, CircularProgress, Container } from "@mui/material";
import { Outlet } from "react-router-dom";

import type { AdminOutletContext } from "../components/admin/AdminOutletContext";
import AdminNav from "../components/admin/AdminNav";
import LoginForm from "../components/admin/LoginForm";
import { useSession } from "../services/auth";

/**
 * Manage posts: create, edit, publish, unpublish and delete.
 *
 * Deliberately absent from `navItems` in Header.tsx -- this is the owner's page,
 * so advertising it in the public nav would be noise for every visitor. Reach it
 * by typing /admin.
 *
 * Wider than the content pages (`lg`, not `md`) because a row here carries a
 * title, a slug, two labels, a date and three buttons.
 *
 * This is a route shell, not a single page: `App.tsx` nests the overview
 * (index route), the post list, the statistics page and the two editors
 * underneath it, so session-checking happens exactly once here rather than
 * once per nested route -- and `AdminNav` is mounted beside the `<Outlet>` for
 * the same reason, so moving between sections never remounts it. The signed-in
 * case hands both a `useSession` caller would otherwise have to re-derive --
 * `username`, `onSignOut`, `onSessionSuspect` -- down through `<Outlet
 * context>`, typed by `AdminOutletContext`.
 */
function Admin() {
  const { phase, username, error, signIn, signOut, recheck } = useSession();

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
      {/* flex: 1 so the spinner and the login form centre in what is left of the
          page rather than clinging to the top. */}
      <Container
        maxWidth="lg"
        sx={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        {phase === "checking" && (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress aria-label="Checking your session" />
          </Box>
        )}

        {phase === "error" && (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={recheck}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          </Box>
        )}

        {phase === "signed-out" && <LoginForm onSubmit={signIn} />}

        {phase === "signed-in" && (
          // Nav beside the page from `md` up, above it below that. The nav is
          // rendered here rather than by each page so it survives navigation
          // between them and is written once; `minWidth: 0` on the content
          // column is what lets a wide child (the post list's filter row, the
          // cadence chart) scroll inside itself instead of pushing the nav off
          // the screen -- a flex item's default `min-width: auto` refuses to
          // shrink below its content.
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: { xs: 0, md: 4 },
            }}
          >
            <AdminNav username={username} onSignOut={() => void signOut()} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Outlet
                context={
                  {
                    username,
                    onSignOut: () => void signOut(),
                    onSessionSuspect: recheck,
                  } satisfies AdminOutletContext
                }
              />
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
}

export default Admin;
