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

import CommentForm from "./CommentForm";
import { useComments } from "../services/useComments";
import type { Comment } from "../services/comments";

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

/**
 * One comment.
 *
 * The body is rendered as **text**, never through `Markdown`. That component
 * is for the owner's own writing; running a stranger's input through a
 * renderer is how a comment box becomes an injection surface, and the backend
 * agrees -- it stores a comment as plain text and says so on the model.
 * `whiteSpace: pre-line` is what keeps the commenter's paragraphs, which is
 * the only formatting a comment needs.
 */
function CommentRow({ comment }: { comment: Comment }) {
  return (
    <Box component="article">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          gap: { xs: 0, sm: 1.5 },
          alignItems: { xs: "flex-start", sm: "baseline" },
        }}
      >
        <Typography
          sx={{
            fontWeight: 600,
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

      <Typography
        sx={{
          mt: 0.5,
          fontSize: { xs: "14px", sm: "15px" },
          color: "text.primary",
          // The commenter's own line breaks, and nothing else interpreted.
          whiteSpace: "pre-line",
          // A pasted URL is one unbroken word and would otherwise widen the
          // page -- see "nothing may widen the page" in CLAUDE.md.
          overflowWrap: "anywhere",
        }}
      >
        {comment.body}
      </Typography>
    </Box>
  );
}

/**
 * The thread under a post, and the box to add to it.
 *
 * **The thread is above the form**, which is the order the page is used in:
 * you read what is there and then reply to it. It also puts the newest comment
 * -- oldest-first ordering, so the last one -- directly above the box that
 * just posted it, which is what the form's confirmation line points at.
 *
 * `count` in the heading comes from the thread's own response rather than the
 * post's `comment_count`: the two agree, but only one of them updates when a
 * comment is posted without the page being reloaded.
 *
 * **`enabled` takes the form away and leaves the thread.** Closing a thread is
 * about what may be *added*: the comments already on the post are part of it
 * and go on being readable, which is also what the backend does — see
 * `CommentSerializer.validate_post`. `PostDetail` is what decides not to render
 * this section at all, in the one case where there is nothing left to show.
 */
function CommentSection({
  slug,
  enabled,
}: {
  slug: string;
  enabled: boolean;
}) {
  const {
    comments,
    count,
    phase,
    error,
    page,
    totalPages,
    setPage,
    reload,
    submit,
    submitting,
    submitError,
    dismissSubmitError,
  } = useComments(slug);

  return (
    <Box component="section" aria-labelledby="comments-heading" sx={{ mt: 2 }}>
      <Typography
        id="comments-heading"
        component="h2"
        sx={{
          fontWeight: "bold",
          fontSize: { xs: "17px", sm: "20px" },
          color: "text.primary",
          mb: 1.5,
        }}
      >
        {/* Nothing yet is "Comments" rather than "Comments (0)": a zero beside
            a heading reads as a score. */}
        {count > 0 ? `Comments (${count.toLocaleString()})` : "Comments"}
      </Typography>

      {phase === "loading" && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} aria-label="Loading comments" />
        </Box>
      )}

      {phase === "error" && (
        // Unlike the reaction bar, this one *is* reported: a visitor about to
        // write a reply has to know the thread failed to load rather than
        // being empty, or they will answer a conversation they cannot see.
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={reload}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {phase === "ready" && comments.length === 0 && (
        <Typography sx={{ fontSize: "14px", color: "text.secondary" }}>
          {/* An open post invites; a closed one would be inviting a comment it
              is about to refuse. PostDetail does not render this section at
              all when a closed post has no comments either, so this line is
              only reached in the moment between the two. */}
          {enabled
            ? "No comments yet. Yours would be the first."
            : "Comments are closed on this post."}
        </Typography>
      )}

      {phase === "ready" && comments.length > 0 && (
        <Stack sx={{ gap: 2 }}>
          {/* Its own Stack so the rule falls only between comments, not above
              the pagination -- the same arrangement the admin lists use. */}
          <Stack divider={<Divider />} sx={{ gap: 2 }}>
            {comments.map((comment) => (
              <CommentRow key={comment.id} comment={comment} />
            ))}
          </Stack>

          {totalPages > 1 && (
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_event, value) => setPage(value)}
              sx={{ alignSelf: "center" }}
            />
          )}
        </Stack>
      )}

      <Divider sx={{ my: 2.5 }} />

      {enabled ? (
        <CommentForm
          slug={slug}
          submitting={submitting}
          error={submitError}
          onDismissError={dismissSubmitError}
          onSubmit={submit}
        />
      ) : (
        // Said plainly rather than by the form simply being absent: a reader
        // who scrolled down to reply needs to know the box is missing on
        // purpose, not that the page failed to finish loading.
        <Typography sx={{ fontSize: "14px", color: "text.secondary" }}>
          Comments are closed on this post.
        </Typography>
      )}
    </Box>
  );
}

export default CommentSection;
