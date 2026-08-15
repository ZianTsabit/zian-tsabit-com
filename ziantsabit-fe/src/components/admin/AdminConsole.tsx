import { useCallback, useState } from "react";
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
  const list = useAdminPosts(category, status, ordering);
  // Stable across renders, unlike `list` itself, so the callbacks below are too.
  const { reload } = list;

  const [pendingDelete, setPendingDelete] = useState<Post | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

      <Stack direction="row" sx={{ gap: 2, mb: 2, flexWrap: "wrap" }}>
        <TextField
          select
          size="small"
          label="Category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
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
          onChange={(event) => setStatus(event.target.value)}
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
          onChange={(event) => setOrdering(event.target.value)}
          sx={{ minWidth: 160 }}
        >
          {SORTS.map((option) => (
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

      <AdminPostList
        posts={list.posts}
        next={list.next}
        phase={list.phase}
        error={list.error}
        loadingMore={list.loadingMore}
        busySlug={busySlug}
        onLoadMore={list.loadMore}
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
