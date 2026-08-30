import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Pagination,
  Stack,
  Typography,
} from "@mui/material";

import ActionButton from "./ActionButton";
import TagChip from "../TagChip";
import { toPlainText } from "../markdownText";
import type { Post } from "../../services/posts";
import { MONO_FONT } from "../../theme";

/* Rows rather than a table: a five-column table is unusable on a phone. */

/** Matches the public entries: last edit, not publication. The time of day is
 *  kept, which they drop -- editing twice in an afternoon is exactly the case
 *  this list is for, and a bare date could not tell those two apart. */
function formatDate(post: Post): string {
  const date = new Date(post.updated_at);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatViews(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "view" : "views"}`;
}

interface RowProps {
  post: Post;
  busy: boolean;
  onEdit: (post: Post) => void;
  onToggleStatus: (post: Post) => void;
  onDelete: (post: Post) => void;
  onShare: (post: Post) => void;
}

function PostRow({ post, busy, onEdit, onToggleStatus, onDelete, onShare }: RowProps) {
  const published = post.status === "published";
  // Excerpt when there is one, the flattened body otherwise -- the same
  // fallback the public entries use, so a row previews what a visitor sees.
  const text = post.excerpt || toPlainText(post.body);

  return (
    <Box
      component="article"
      sx={{
        // No border, no surface -- the same divided list the public pages use
        // (see PostCard). The rule between rows comes from the Stack below.
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
        {/* Same running order as the public entries (see PostCard): title,
            then updated | views, then the excerpt, then the chips. The slug
            sits under the title because it identifies the row, and the two
            admin-only chips lead the chip row so the post's own tags do not
            get lost among them. */}
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
              fontFamily: MONO_FONT,
              fontSize: "12px",
              color: "text.secondary",
              // A long slug should not be able to widen the page.
              overflowWrap: "anywhere",
            }}
          >
            /{post.slug}
          </Typography>

          <Typography sx={{ fontSize: "12px", color: "text.secondary", mt: 0.5 }}>
            <Box component="time" dateTime={post.updated_at}>
              Updated {formatDate(post)}
            </Box>
            {" | "}
            {formatViews(post.view_count)}
          </Typography>

          {text && (
            <Typography
              sx={{
                fontSize: { xs: "13px", sm: "14px" },
                color: "text.primary",
                mt: 0.5,
                whiteSpace: "pre-line",
                // Two lines, not the public entries' three: this list runs 20
                // rows to a page and is read by scanning titles.
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
              }}
            >
              {text}
            </Typography>
          )}

          <Stack
            direction="row"
            sx={{ gap: 1, mt: 1, alignItems: "center", flexWrap: "wrap" }}
          >
            {/* Status leads, so the post's own tags do not get lost beside
                the admin-only labels. */}
            <TagChip label={published ? "Published" : "Draft"} emphasis={published} />
            {/* Only shown when switched *off*. Both default on, so a chip on
                every row saying "Comments on" would be a column of noise
                marking the ordinary case; what is worth spotting from the list
                is the post that behaves differently from the rest. */}
            {!post.comments_enabled && <TagChip label="Comments off" />}
            {!post.reactions_enabled && <TagChip label="Reactions off" />}
            {post.tags.map((tag) => (
              <TagChip key={tag} label={tag} />
            ))}
          </Stack>
        </Box>

        <Stack
          direction="row"
          sx={{ gap: 1, flexShrink: 0, justifyContent: { xs: "flex-end", md: "initial" } }}
        >
          {/* First in the row, so Delete stays last: the row's order is its
              emphasis (see ActionButton), and sharing is the lightest thing
              here. Offered on drafts too -- the card is worth preparing before
              publishing, and the dialog is where the dead link is called out,
              which a disabled button could not do. */}
          <ActionButton onClick={() => onShare(post)} disabled={busy}>
            Share
          </ActionButton>
          <ActionButton onClick={() => onEdit(post)} disabled={busy}>
            Edit
          </ActionButton>
          {/* One button, two actions, so the tone follows the label: taking a
              post down is the page's ink, putting one up is the same primary
              colour Publish carries in the editor. */}
          <ActionButton
            tone={published ? "neutral" : "primary"}
            onClick={() => onToggleStatus(post)}
            disabled={busy}
          >
            {published ? "Unpublish" : "Publish"}
          </ActionButton>
          <ActionButton tone="danger" onClick={() => onDelete(post)} disabled={busy}>
            Delete
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}

interface Props extends Omit<RowProps, "post" | "busy"> {
  posts: Post[];
  phase: "loading" | "ready" | "error";
  error: string | null;
  /** Slug of the post whose own request is in flight, if any. */
  busySlug: string | null;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

/** Renders the four states the list can be in: loading, error, empty, populated. */
function AdminPostList({
  posts,
  phase,
  error,
  busySlug,
  page,
  totalPages,
  onPageChange,
  onRetry,
  onEdit,
  onToggleStatus,
  onDelete,
  onShare,
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
    <Stack sx={{ gap: 3, width: "100%" }}>
      {/* Its own Stack so the rule falls only between rows, not above the
          error alert or the pagination. The gap is per side, since a
          divider is a flex child of its own -- tighter than the public lists'
          2.5/3 because these rows are denser and there are up to 20 of them. */}
      <Stack divider={<Divider />} sx={{ gap: { xs: 2, sm: 2.5 } }}>
        {posts.map((post) => (
          <PostRow
            key={post.slug}
            post={post}
            busy={busySlug === post.slug}
            onEdit={onEdit}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
            onShare={onShare}
          />
        ))}
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {totalPages > 1 && (
        <Pagination
          count={totalPages}
          page={page}
          onChange={(_event, value) => onPageChange(value)}
          sx={{ alignSelf: "center" }}
        />
      )}
    </Stack>
  );
}

export default AdminPostList;
