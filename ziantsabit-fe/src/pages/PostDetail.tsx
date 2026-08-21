import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import Centered from "../components/Centered";
import CommentSection from "../components/CommentSection";
import Markdown from "../components/Markdown";
import ReactionBar from "../components/ReactionBar";
import { TagChipRow } from "../components/TagChip";
import Typewriter from "../components/Typewriter";
import { usePost } from "../services/usePost";
import { useRecordView } from "../services/useRecordView";

function formatDate(stamp: string): string {
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatViews(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "view" : "views"}`;
}

/**
 * One post's full content, reached from the feed.
 *
 * `backTo`/`backLabel` are still props rather than hardcoded even though every
 * route now passes the same pair: they are what the "back" link says, and a
 * post reached from somewhere new should be able to point back at it.
 */
function PostDetail({ backTo, backLabel }: { backTo: string; backLabel: string }) {
  const { slug = "" } = useParams<{ slug: string }>();
  const { post, phase, error, retry } = usePost(slug);
  // Counts this read once per session, and hands back the total to show --
  // including the one just recorded, which the post itself is one behind on.
  const views = useRecordView(post);

  // A closed thread with nothing in it has nothing to say, so the section goes
  // rather than rendering a heading over one line of apology. `comment_count`
  // is the post's own figure and is exactly what is needed here: whether the
  // thread would have anything to show. The section then fetches the thread
  // itself, which is the number it displays.
  const showComments = Boolean(
    post && (post.comments_enabled || post.comment_count > 0),
  );

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
      <Container
        maxWidth="md"
        sx={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        <Box
          component={Link}
          to={backTo}
          sx={{
            alignSelf: "flex-start",
            mb: 2,
            fontSize: { xs: "13px", sm: "14px" },
            color: "primary.main",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          ← Back to {backLabel}
        </Box>

        {phase === "loading" && (
          <Centered>
            <CircularProgress aria-label="Loading post" />
          </Centered>
        )}

        {phase === "error" && (
          <Centered>
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={retry}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          </Centered>
        )}

        {phase === "not-found" && (
          <Centered>
            <Typewriter text="Post not found..." />
          </Centered>
        )}

        {phase === "ready" && post && (
          <Stack sx={{ gap: 2, pb: 4 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", sm: "baseline" },
                gap: { xs: 1, sm: 2 },
              }}
            >
              <Typography
                component="h1"
                sx={{
                  fontWeight: "bold",
                  fontSize: { xs: "22px", sm: "28px" },
                  color: "text.primary",
                }}
              >
                {post.title}
              </Typography>
              <Typography
                component="time"
                dateTime={post.published_at ?? post.created_at}
                sx={{
                  fontSize: { xs: "12px", sm: "14px" },
                  color: "text.secondary",
                  whiteSpace: "nowrap",
                }}
              >
                {formatDate(post.published_at ?? post.created_at)}
              </Typography>
            </Stack>

            {views !== null && (
              <Typography
                sx={{
                  alignSelf: "flex-start",
                  fontSize: { xs: "12px", sm: "13px" },
                  color: "text.secondary",
                }}
              >
                {formatViews(views)}
              </Typography>
            )}

            {/* Their own row rather than sharing one with the view count: a
                post with several tags would push the count off the end of the
                line on a phone. The category badges that used to lead this row
                are gone -- the tags were always the more specific of the two,
                and showing both meant showing "Posts" on nearly every post. */}
            {post.tags.length > 0 && <TagChipRow labels={post.tags} />}

            {post.cover_image_url && (
              <Box
                component="img"
                src={post.cover_image_url}
                // Blank alt marks it decorative, which is the honest default:
                // the title above already carries the meaning. An author who
                // filled the alt field in gets what they wrote.
                alt={post.cover_image_alt}
                sx={{
                  width: "100%",
                  maxHeight: { xs: 240, sm: 380 },
                  objectFit: "cover",
                  borderRadius: 1,
                  bgcolor: "background.paper",
                }}
              />
            )}

            {/* The body is Markdown; `Markdown` owns its own typography, so
                there is no wrapping Typography to fight with it. */}
            <Markdown>{post.body}</Markdown>

            {/* Everything a visitor can leave sits below the post, in the
                order the effort rises: one tap first, then a paragraph. Both
                are handed `post.slug` rather than the route's `slug` param --
                a post reached by an old URL is served under its current slug,
                and the two writes have to land on the row the page is
                actually showing.

                Either can be switched off per post in the editor, and the two
                switches do different things because the two features do. A
                post with reactions off shows no bar at all: a row of counts
                nobody may change is furniture. A post with comments closed
                still shows the thread it already has, because those comments
                are part of the post -- only the form goes away. The section
                disappears entirely just once, when a closed post has no
                comments to show, since a heading over "Comments are closed" is
                a whole section saying nothing. */}
            {(post.reactions_enabled || showComments) && <Divider sx={{ mt: 2 }} />}

            {post.reactions_enabled && <ReactionBar slug={post.slug} />}

            {post.reactions_enabled && showComments && <Divider />}

            {showComments && (
              <CommentSection
                slug={post.slug}
                enabled={post.comments_enabled}
              />
            )}
          </Stack>
        )}
      </Container>
    </Box>
  );
}

export default PostDetail;
