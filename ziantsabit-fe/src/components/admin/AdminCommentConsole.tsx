import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
  DialogTitle,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import AdminCommentList from "./AdminCommentList";
import type { AdminOutletContext } from "./AdminOutletContext";
import { HEADER_HEIGHT } from "../../constants/layout";
import { ApiError } from "../../services/api";
import {
  COMMENT_SORTS,
  COMMENT_STATUSES,
  deleteComment,
  setCommentStatus,
} from "../../services/adminComments";
import type { Comment } from "../../services/comments";
import { useAdminComments } from "../../services/useAdminComments";

const ALL = "";

/** Matches the other two consoles: long enough that typing a phrase is one
 *  request rather than one per letter. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Moderation for what visitors leave: hide a comment, put it back, or remove
 * it.
 *
 * **This page is why comments can be published on arrival.** The backend
 * publishes a comment the moment it is written rather than holding it in a
 * queue -- a queue on a personal site means a commenter waits days and assumes
 * their comment was lost -- and the trade only works if taking something down
 * is a click away. That is this.
 *
 * Deliberately newest-first by default, the opposite of the public thread: a
 * thread is read in the order it was written, but what the owner opens this
 * page for is whatever arrived while nobody was looking.
 *
 * There is no editor and no "new comment" button. A comment is the visitor's;
 * see `adminComments.ts`.
 */
function AdminCommentConsole() {
  const { onSessionSuspect } = useOutletContext<AdminOutletContext>();

  const [status, setStatus] = useState(ALL);
  const [ordering, setOrdering] = useState("newest");
  const [page, setPage] = useState(1);

  // Two pieces of state for one box: what is being typed, and what has been
  // asked for. Same as the other consoles.
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typed.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const list = useAdminComments(ALL, status, search, ordering, page);
  // Stable across renders, unlike `list` itself, so the callbacks below are too.
  const { reload } = list;

  const [pendingDelete, setPendingDelete] = useState<Comment | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Every filter change goes back to page 1: page 3 of everything is usually
   *  past the end of a filtered list. */
  const changeFilter = (set: (value: string) => void, value: string) => {
    set(value);
    setPage(1);
  };

  // A mutation can empty the page being shown -- delete the only row on page 3
  // and page 3 stops existing, leaving "No comments match this filter" over a
  // list that is not in fact empty.
  useEffect(() => {
    if (list.phase === "ready" && list.comments.length === 0 && page > 1) {
      setPage((current) => current - 1);
    }
  }, [list.phase, list.comments.length, page]);

  const handleFailure = useCallback(
    (failure: unknown) => {
      setActionError(
        failure instanceof Error ? failure.message : "The change did not go through.",
      );
      // api.ts already retried a CSRF rejection, so a 403 that survives to here
      // means the session itself is gone; re-checking swaps in the login form.
      if (failure instanceof ApiError && failure.status === 403) onSessionSuspect();
    },
    [onSessionSuspect],
  );

  const runOnComment = useCallback(
    async (comment: Comment, action: () => Promise<unknown>) => {
      setBusyId(comment.id);
      setActionError(null);
      try {
        await action();
        reload();
      } catch (failure: unknown) {
        handleFailure(failure);
      } finally {
        setBusyId(null);
      }
    },
    [handleFailure, reload],
  );

  const handleToggleStatus = (comment: Comment) =>
    runOnComment(comment, () =>
      setCommentStatus(
        comment.id,
        comment.status === "published" ? "hidden" : "published",
      ),
    );

  const confirmDelete = () => {
    const comment = pendingDelete;
    setPendingDelete(null);
    if (comment) void runOnComment(comment, () => deleteComment(comment.id));
  };

  return (
    <>
      <Typography
        component="h1"
        sx={{ fontWeight: "bold", fontSize: { xs: "20px", sm: "24px" }, mb: 2 }}
      >
        Comments
      </Typography>

      {/* Sticky under the fixed header, like the other two consoles.
          `background.default` and not `transparent`: Admin.tsx's own wrapper is
          transparent, so the page colour comes from the body and has to be
          named here or rows would show through while scrolling. */}
      <Stack
        direction="row"
        sx={{
          gap: 2,
          flexWrap: "wrap",
          position: "sticky",
          top: HEADER_HEIGHT,
          zIndex: 1,
          bgcolor: "background.default",
          mx: { xs: -2, sm: -3 },
          px: { xs: 2, sm: 3 },
          py: 1.5,
          mb: 2,
        }}
      >
        <TextField
          size="small"
          label="Search"
          placeholder="Comment or name"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 200 }}
        />

        {/* Both selects default to a value that means "everything", and
            `displayEmpty` is what makes "" show as "All statuses" rather than
            an empty box; the label is pinned shrunk to match. */}
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(event) => changeFilter(setStatus, event.target.value)}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value={ALL}>All statuses</MenuItem>
          {COMMENT_STATUSES.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Sort"
          value={ordering}
          onChange={(event) => changeFilter(setOrdering, event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        >
          {COMMENT_SORTS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <AdminCommentList
        comments={list.comments}
        phase={list.phase}
        error={list.error}
        busyId={busyId}
        page={page}
        totalPages={list.totalPages}
        onPageChange={setPage}
        onRetry={list.reload}
        onToggleStatus={handleToggleStatus}
        onDelete={setPendingDelete}
      />

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete this comment?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {/* Hiding is the reversible half, and it is one click away in the
                same row -- worth saying here, since Delete is not. */}
            The comment by “{pendingDelete?.author_name}” will be removed for
            good. There is no undo. Hiding it instead keeps it out of sight
            without throwing it away.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setPendingDelete(null)}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default AdminCommentConsole;
