import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { AdminOutletContext } from "./AdminOutletContext";
import AdminPostList from "./AdminPostList";
import { HEADER_HEIGHT } from "../../constants/layout";
import { ApiError } from "../../services/api";
import {
  CATEGORIES,
  SORTS,
  STATUSES,
  deletePost,
  setPostStatus,
} from "../../services/adminPosts";
import type { Post, PostCategory } from "../../services/posts";
import { useAdminPosts } from "../../services/useAdminPosts";

const ALL = "";

/**
 * The signed-in half of the admin page: the post list plus its filters.
 *
 * Rendered as `/admin`'s index route via `<Outlet>`, so `useAdminPosts` is only
 * ever mounted behind a valid session -- a hook cannot be called conditionally,
 * and fetching the list while the login form is still on screen would just be
 * a request thrown away.
 */
function AdminConsole() {
  const { username, onSignOut, onSessionSuspect } =
    useOutletContext<AdminOutletContext>();
  const navigate = useNavigate();

  const [category, setCategory] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  // "" is the API's default ordering, newest first; "views" is most-read first.
  const [ordering, setOrdering] = useState<string>("");
  // Inclusive YYYY-MM-DD bounds; "" leaves that end of the range open.
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");
  const [page, setPage] = useState(1);
  const list = useAdminPosts(category, status, ordering, page, after, before);
  // Stable across renders, unlike `list` itself, so the callbacks below are too.
  const { reload } = list;

  const [pendingDelete, setPendingDelete] = useState<Post | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Every filter change goes back to page 1: page 3 of an unfiltered list is
   *  usually past the end of a filtered one, and landing on an empty page
   *  looks like the filter matched nothing. Same rule as the Posts page. */
  const changeFilter = (set: (value: string) => void, value: string) => {
    set(value);
    setPage(1);
  };

  // A mutation can empty the page being shown -- delete the only row on page 3
  // and page 3 stops existing, leaving "No posts match this filter" over a list
  // that is not in fact empty. Stepping back re-fetches, and repeats if that
  // page has gone too.
  useEffect(() => {
    if (list.phase === "ready" && list.posts.length === 0 && page > 1) {
      setPage((current) => current - 1);
    }
  }, [list.phase, list.posts.length, page]);

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

  const runOnPost = useCallback(
    async (post: Post, action: () => Promise<unknown>) => {
      setBusySlug(post.slug);
      setActionError(null);
      try {
        await action();
        reload();
      } catch (failure: unknown) {
        handleFailure(failure);
      } finally {
        setBusySlug(null);
      }
    },
    [handleFailure, reload],
  );

  const openEditor = (post: Post) => {
    // The post is already in memory from the list just rendered, so it rides
    // along as router state -- AdminEditPost opens with it instantly instead
    // of re-fetching what's already on screen.
    navigate(`/admin/edit/${encodeURIComponent(post.slug)}`, { state: { post } });
  };

  const handleNewPost = () => {
    // A post created while looking at a filtered list lands back in that same
    // section, unless the filter is "all".
    navigate("/admin/new", {
      state: { category: (category as PostCategory) || undefined },
    });
  };

  const handleToggleStatus = (post: Post) =>
    runOnPost(post, () =>
      setPostStatus(post.slug, post.status === "published" ? "draft" : "published"),
    );

  const confirmDelete = () => {
    const post = pendingDelete;
    setPendingDelete(null);
    if (post) void runOnPost(post, () => deletePost(post.slug));
  };

  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          gap: 1,
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{ fontWeight: "bold", fontSize: { xs: "20px", sm: "24px" } }}
          >
            Posts
          </Typography>
          <Typography sx={{ fontSize: "13px", color: "text.secondary" }}>
            Signed in as {username ?? "unknown"}
          </Typography>
        </Box>

        <Stack direction="row" sx={{ gap: 1, flexShrink: 0 }}>
          <Button variant="contained" onClick={handleNewPost}>
            New post
          </Button>
          <Button color="inherit" onClick={onSignOut}>
            Sign out
          </Button>
        </Stack>
      </Stack>

      {/* Sticky for the same reason as the Posts page's filters -- see the
          comment there for why `top` is HEADER_HEIGHT and why the background
          and the negative margins are load-bearing. `background.default` and
          not `transparent`: Admin.tsx's own wrapper is transparent, so the
          page colour comes from the body and has to be named here. */}
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
        {/* All three selects default to "", and `displayEmpty` is what makes
            that show as "All categories" / "All statuses" / "Newest first"
            rather than an empty box; the label is pinned shrunk to match. */}
        <TextField
          select
          size="small"
          label="Category"
          value={category}
          onChange={(event) => changeFilter(setCategory, event.target.value)}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value={ALL}>All categories</MenuItem>
          {CATEGORIES.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

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
          {STATUSES.map((option) => (
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
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        >
          {SORTS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Native date inputs, as on the public Posts page: they hand back a
            YYYY-MM-DD string, which is what the API takes. `shrink` is forced
            because the browser paints its own placeholder in an empty field,
            which a floating label would otherwise sit on top of. */}
        <TextField
          type="date"
          size="small"
          label="From"
          value={after}
          onChange={(event) => changeFilter(setAfter, event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          type="date"
          size="small"
          label="To"
          value={before}
          onChange={(event) => changeFilter(setBefore, event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
      </Stack>

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <AdminPostList
        posts={list.posts}
        phase={list.phase}
        error={list.error}
        busySlug={busySlug}
        page={page}
        totalPages={list.totalPages}
        onPageChange={setPage}
        onRetry={list.reload}
        onEdit={openEditor}
        onToggleStatus={handleToggleStatus}
        onDelete={setPendingDelete}
      />

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete this post?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            “{pendingDelete?.title}” will be removed for good. There is no undo.
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

export default AdminConsole;
