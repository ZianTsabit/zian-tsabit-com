import { Alert, Box, Button, CircularProgress, Container } from "@mui/material";
import { Outlet } from "react-router-dom";

import type { AdminOutletContext } from "../components/admin/AdminOutletContext";
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
 * This is a route shell, not a single page: `App.tsx` nests the post list
 * (index route) and `AdminNewPost` ("new") underneath it, so session-checking
 * happens exactly once here rather than once per nested route. The signed-in
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
          <Outlet
            context={
              {
                username,
                onSignOut: () => void signOut(),
                onSessionSuspect: recheck,
              } satisfies AdminOutletContext
            }
          />
        )}
      </Container>
    </Box>
  );
}

export default Admin;
