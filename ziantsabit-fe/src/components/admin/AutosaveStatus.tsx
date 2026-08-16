import { CircularProgress, Stack, Typography } from "@mui/material";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";

import type { AutosaveState } from "../../services/useAutosave";

function time(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  state: AutosaveState;
  /** "Draft saved" while creating, "Saved" while editing a post that may well
   *  already be published -- calling that one a draft would be a lie. */
  savedLabel?: string;
}

/**
 * The one line telling the author whether what is on screen is on the server.
 *
 * Sits beside the Save buttons rather than at the top of the form: it answers
 * the question those buttons raise, and this is where the eye already is when
 * deciding whether it is safe to leave.
 */
function AutosaveStatus({ state, savedLabel = "Saved" }: Props) {
  const icon = { fontSize: 16 };

  return (
    // Announced rather than shown only: the whole point is that saving happens
    // without being asked for, so a screen reader user gets no other signal.
    // `polite`, so it waits for a pause instead of interrupting typing.
    <Stack
      role="status"
      aria-live="polite"
      direction="row"
      sx={{
        gap: 0.75,
        alignItems: "center",
        // Reserved whether or not there is anything to say, so the buttons do
        // not shift sideways the first time a save reports in.
        minHeight: 24,
        color: state.phase === "failed" ? "error.main" : "text.secondary",
      }}
    >
      {state.phase === "dirty" && (
        <>
          <EditNoteOutlinedIcon sx={icon} />
          <Typography sx={{ fontSize: "13px" }}>Unsaved changes</Typography>
        </>
      )}

      {state.phase === "saving" && (
        <>
          <CircularProgress size={13} thickness={5} color="inherit" />
          <Typography sx={{ fontSize: "13px" }}>Saving...</Typography>
        </>
      )}

      {state.phase === "saved" && (
        <>
          <CloudDoneOutlinedIcon sx={icon} />
          <Typography sx={{ fontSize: "13px" }}>
            {savedLabel} at {time(state.at)}
          </Typography>
        </>
      )}

      {state.phase === "failed" && (
        <>
          <CloudOffOutlinedIcon sx={icon} />
          {/* Names the cause and what still works: the buttons write through
              the same code path, so a manual save is a real second chance
              rather than the same failure again. */}
          <Typography sx={{ fontSize: "13px" }}>
            Autosave failed ({state.message}) - save below to retry.
          </Typography>
        </>
      )}
    </Stack>
  );
}

export default AutosaveStatus;
