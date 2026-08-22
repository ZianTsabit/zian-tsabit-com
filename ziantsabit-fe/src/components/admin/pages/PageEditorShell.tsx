import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";

import ActionButton from "../ActionButton";
import AutosaveStatus from "../AutosaveStatus";
import type { AutosaveState } from "../../../services/useAutosave";

interface Props {
  title: string;
  /** Where the page this edits lives, for the "View page" link. */
  viewPath: string;
  phase: "loading" | "ready" | "error";
  loadError: string | null;
  onRetry: () => void;
  saveError: string | null;
  autosave: AutosaveState;
  saving: boolean;
  onSave: () => void;
  children: ReactNode;
}

/**
 * The frame both page editors share: heading, load and save states, and the
 * save row at the bottom.
 *
 * Only the fields differ between the CV and About editors, so everything around
 * them is written once -- the same split as `PostFormFields` inside the two post
 * editor pages.
 *
 * **The banner is not decoration.** Unlike a post, a page has no draft copy and
 * no status: every save is live the moment it lands, and autosave means that
 * happens three seconds after typing stops rather than when a button is
 * pressed. That is a surprise worth spending a line on, once, at the top.
 *
 * Save stays on the page rather than navigating, because there is no list of
 * pages to return to -- and being thrown out of the CV every time it saved
 * would be the wrong end of that trade.
 */
function PageEditorShell({
  title,
  viewPath,
  phase,
  loadError,
  onRetry,
  saveError,
  autosave,
  saving,
  onSave,
  children,
}: Props) {
  return (
    <Box sx={{ maxWidth: 720, width: "100%", mx: "auto" }}>
      <Stack
        direction="row"
        sx={{
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 2,
          mb: 3,
        }}
      >
        <Typography
          component="h1"
          sx={{ fontWeight: "bold", fontSize: { xs: "20px", sm: "24px" } }}
        >
          {title}
        </Typography>
        <Box
          component={Link}
          to={viewPath}
          sx={{
            fontSize: "14px",
            color: "primary.main",
            textDecoration: "none",
            flexShrink: 0,
            "&:hover": { textDecoration: "underline" },
          }}
        >
          View page
        </Box>
      </Stack>

      {phase === "loading" && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress aria-label={`Loading ${title}`} />
        </Box>
      )}

      {phase === "error" && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {phase === "ready" && (
        <Stack sx={{ gap: 3 }}>
          {saveError && <Alert severity="error">{saveError}</Alert>}

          <Alert severity="info">
            This page has no draft. Changes save themselves a few seconds after
            you stop typing, and go live straight away.
          </Alert>

          {children}

          {/* The page has no bottom padding of its own, so without this the
              save row sits flush against the footer's top border. */}
          <Stack
            direction="row"
            sx={{
              gap: 1,
              alignItems: "center",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              pt: 1,
              pb: { xs: 3, sm: 4 },
            }}
          >
            <Box sx={{ mr: "auto", minWidth: 0 }}>
              <AutosaveStatus state={autosave} />
            </Box>
            <ActionButton disabled={saving} onClick={onSave}>
              {saving ? "Saving..." : "Save now"}
            </ActionButton>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

export default PageEditorShell;
