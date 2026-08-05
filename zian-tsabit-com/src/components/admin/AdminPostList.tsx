import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import TagChip from "../TagChip";
import { CATEGORIES } from "../../services/adminPosts";
import type { Post } from "../../services/posts";

/** Rows rather than a table: a five-column table is unusable on a phone. */
const CATEGORY_LABELS = new Map(CATEGORIES.map((c) => [c.value, c.label]));

function formatDate(post: Post): string {
  // A draft has no published_at, so its created date is what there is to show.
  const stamp = post.published_at ?? post.created_at;
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface RowProps {
  post: Post;
  busy: boolean;
  onEdit: (post: Post) => void;
  onToggleStatus: (post: Post) => void;
  onDelete: (post: Post) => void;
}

function PostRow({ post, busy, onEdit, onToggleStatus, onDelete }: RowProps) {
  const published = post.status === "published";

  return (
    <Box
      component="article"
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: { xs: 1.5, sm: 2 },
        // Dimmed while its own request is in flight, so a slow publish is
        // visibly doing something rather than looking ignored.
        opacity: busy ? 0.5 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{
          gap: { xs: 1, md: 2 },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "center" },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h2"
            sx={{
              fontWeight: "bold",
              fontSize: { xs: "15px", sm: "17px" },
              color: "text.primary",
            }}
          >
            {post.title}
          </Typography>
          <Typography
            sx={{
              fontFamily: "monospace",
              fontSize: "12px",
              color: "text.secondary",
              // A long slug should not be able to widen the page.
              overflowWrap: "anywhere",
            }}
          >
            /{post.slug}
          </Typography>
          <Stack
            direction="row"
            sx={{ gap: 1, mt: 1, alignItems: "center", flexWrap: "wrap" }}
          >
            <TagChip label={CATEGORY_LABELS.get(post.category) ?? post.category} />
            <TagChip label={published ? "Published" : "Draft"} emphasis={published} />
            <Typography sx={{ fontSize: "12px", color: "text.secondary" }}>
              {formatDate(post)}
            </Typography>
          </Stack>
        </Box>

        <Stack
          direction="row"
          sx={{ gap: 1, flexShrink: 0, justifyContent: { xs: "flex-end", md: "initial" } }}
        >
          <Button size="small" onClick={() => onEdit(post)} disabled={busy}>
            Edit
          </Button>
          <Button
            size="small"
            color="inherit"
            onClick={() => onToggleStatus(post)}
            disabled={busy}
          >
            {published ? "Unpublish" : "Publish"}
          </Button>
          <Button
            size="small"
            color="error"
            onClick={() => onDelete(post)}
            disabled={busy}
          >
            Delete
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

interface Props extends Omit<RowProps, "post" | "busy"> {
  posts: Post[];
  next: string | null;
  phase: "loading" | "ready" | "error";
  error: string | null;
  loadingMore: boolean;
  /** Slug of the post whose own request is in flight, if any. */
  busySlug: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
}

/** Renders the four states the list can be in: loading, error, empty, populated. */
function AdminPostList({
  posts,
  next,
  phase,
  error,
  loadingMore,
  busySlug,
  onLoadMore,
  onRetry,
  onEdit,
  onToggleStatus,
  onDelete,
}: Props) {
  if (phase === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress aria-label="Loading posts" />
      </Box>
    );
  }

  if (phase === "error") {
    return (
      <Alert
        severity="error"
        sx={{ my: 2 }}
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (posts.length === 0) {
    return (
      <Typography sx={{ color: "text.secondary", py: 6, textAlign: "center" }}>
        No posts match this filter.
      </Typography>
    );
  }

  return (
    <Stack sx={{ gap: 1.5, width: "100%" }}>
      {posts.map((post) => (
        <PostRow
          key={post.slug}
          post={post}
          busy={busySlug === post.slug}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
        />
      ))}

      {/* Raised by a load-more, with the rows already fetched left in place. */}
      {error && <Alert severity="error">{error}</Alert>}

      {next && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          <Button onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </Box>
      )}
    </Stack>
  );
}

export default AdminPostList;
