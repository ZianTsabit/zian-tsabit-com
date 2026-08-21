import { Link } from "react-router-dom";
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
import type { Comment } from "../../services/comments";

function formatWhen(stamp: string): string {
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
  comment: Comment;
  busy: boolean;
  onToggleStatus: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
}

function CommentRow({ comment, busy, onToggleStatus, onDelete }: RowProps) {
  const published = comment.status === "published";

  return (
    <Box
      component="article"
      sx={{
        // Dimmed while its own request is in flight, matching the post and
        // book lists: a slow hide is visibly doing something.
        opacity: busy ? 0.5 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{
          gap: { xs: 1, md: 2 },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "flex-start" },
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            sx={{ gap: 1, alignItems: "baseline", flexWrap: "wrap" }}
          >
            <Typography
              component="h2"
              sx={{
                fontWeight: "bold",
                fontSize: { xs: "14px", sm: "15px" },
                color: "text.primary",
              }}
            >
              {comment.author_name}
            </Typography>
            <Typography
              component="time"
              dateTime={comment.created_at}
              sx={{ fontSize: "12px", color: "text.secondary" }}
            >
              {formatWhen(comment.created_at)}
            </Typography>
          </Stack>

          {/* A link to the public page, not to an editor: there is no editor
              for a comment, and what the owner actually wants from a row is to
              see it where it sits. */}
          <Box
            component={Link}
            to={`/posts/${encodeURIComponent(comment.post)}`}
            sx={{
              display: "inline-block",
              fontSize: "12px",
              color: "primary.main",
              textDecoration: "none",
              overflowWrap: "anywhere",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            on {comment.post_title}
          </Box>

          <Typography
            sx={{
              fontSize: { xs: "13px", sm: "14px" },
              color: "text.primary",
              mt: 0.5,
              // The commenter's paragraphs, and nothing else interpreted --
              // the same rendering the public thread gives it, so the owner is
              // moderating what a visitor actually sees.
              whiteSpace: "pre-line",
              overflowWrap: "anywhere",
            }}
          >
            {comment.body}
          </Typography>

          <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: "wrap" }}>
            <TagChip
              label={published ? "Published" : "Hidden"}
              emphasis={published}
            />
          </Stack>
        </Box>

        <Stack
          direction="row"
          sx={{
            gap: 1,
            flexShrink: 0,
            justifyContent: { xs: "flex-end", md: "initial" },
          }}
        >
          {/* One button, two actions, so the tone follows the label -- exactly
              as Unpublish/Publish does on the post and book lists. */}
          <ActionButton
            tone={published ? "neutral" : "primary"}
            onClick={() => onToggleStatus(comment)}
            disabled={busy}
          >
            {published ? "Hide" : "Show"}
          </ActionButton>
          <ActionButton
            tone="danger"
            onClick={() => onDelete(comment)}
            disabled={busy}
          >
            Delete
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}

interface Props extends Omit<RowProps, "comment" | "busy"> {
  comments: Comment[];
  phase: "loading" | "ready" | "error";
  error: string | null;
  /** Id of the comment whose own request is in flight, if any. */
  busyId: number | null;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

/** Renders the four states the list can be in: loading, error, empty, populated. */
function AdminCommentList({
  comments,
  phase,
  error,
  busyId,
  page,
  totalPages,
  onPageChange,
  onRetry,
  onToggleStatus,
  onDelete,
}: Props) {
  if (phase === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress aria-label="Loading comments" />
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

  if (comments.length === 0) {
    return (
      <Typography sx={{ color: "text.secondary", py: 6, textAlign: "center" }}>
        No comments match this filter.
      </Typography>
    );
  }

  return (
    <Stack sx={{ gap: 3, width: "100%" }}>
      <Stack divider={<Divider />} sx={{ gap: { xs: 2, sm: 2.5 } }}>
        {comments.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            busy={busyId === comment.id}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
          />
        ))}
      </Stack>

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

export default AdminCommentList;
