import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import type { Post, PostCategory } from "../services/posts";
import { usePosts } from "../services/usePosts";
import Centered from "./Centered";
import { toPlainText } from "./markdownText";
import Typewriter from "./Typewriter";

function formatDate(post: Post): string {
  // published_at is null only on drafts, which the public API never returns;
  // created_at keeps this honest if an authenticated caller ever sees one.
  const stamp = post.published_at ?? post.created_at;
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Exported for reuse by Home's "Latest Updates" feed, which mixes posts from
 *  every category and so needs to build each card's `to` itself. */
export function PostCard({ post, to }: { post: Post; to: string }) {
  // Excerpt is the summary when there is one; otherwise the body stands in, so
  // a post written without an excerpt is not a bare title. The body is
  // Markdown, so it is flattened first -- a card is no place for `## Heading`.
  const text = post.excerpt || toPlainText(post.body);

  return (
    <Box
      component={Link}
      to={to}
      sx={{
        display: "flex",
        // A cover image leads the card on a wide screen and sits on top of it
        // on a phone, where 120px of thumbnail would leave the title no room.
        flexDirection: { xs: "column", sm: "row" },
        gap: { xs: 1.5, sm: 2 },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: { xs: 2, sm: 2.5 },
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 0.15s ease, background-color 0.15s ease",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: "action.hover",
        },
      }}
    >
      {post.cover_image_url && (
        <Box
          component="img"
          src={post.cover_image_url}
          // Empty alt, not the title: the card's own heading already says what
          // this links to, so announcing it twice is noise. A cover with real
          // alt text still contributes it.
          alt={post.cover_image_alt}
          loading="lazy"
          sx={{
            width: { xs: "100%", sm: 120 },
            height: { xs: 160, sm: 120 },
            flexShrink: 0,
            objectFit: "cover",
            borderRadius: 1,
            bgcolor: "background.paper",
          }}
        />
      )}

      <Box sx={{ minWidth: 0, flex: 1 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "baseline" },
          gap: { xs: 0.5, sm: 2 },
        }}
      >
        <Typography
          component="h2"
          sx={{
            fontWeight: "bold",
            fontSize: { xs: "16px", sm: "18px" },
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
          {formatDate(post)}
        </Typography>
      </Stack>

      {text && (
        <Typography
          sx={{
            fontSize: { xs: "14px", sm: "16px" },
            color: "text.primary",
            mt: 1,
            // Newlines typed in the admin should survive; a justified phone line
            // of ~35 characters opens rivers of whitespace, hence sm and up only.
            whiteSpace: "pre-line",
            textAlign: { xs: "left", sm: "justify" },
            // A card is a teaser. Bodies are Markdown documents now, so an
            // unclamped fallback preview can run to the length of the whole
            // post; three lines keeps every card the same rough size.
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 3,
            overflow: "hidden",
          }}
        >
          {text}
        </Typography>
      )}
      </Box>
    </Box>
  );
}

/**
 * Fetches and renders one category's posts.
 *
 * Needs an unbroken `flex: 1` chain from <main> to grow into, which is why the
 * pages using it make their Container a flex column. `basePath` is the
 * section's own route (e.g. "/books") -- a category's route isn't always
 * derivable from the category value itself, so this is where each card links,
 * appending the post's slug.
 */
function PostList({
  category,
  basePath,
}: {
  category: PostCategory;
  basePath: string;
}) {
  const { posts, next, phase, error, loadingMore, loadMore, retry } =
    usePosts(category);

  if (phase === "loading") {
    return (
      <Centered>
        <CircularProgress aria-label="Loading posts" />
      </Centered>
    );
  }

  if (phase === "error") {
    return (
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
    );
  }

  if (posts.length === 0) {
    // The placeholder this page shipped with, kept for the case it was written
    // for: there is genuinely nothing here yet.
    return (
      <Centered>
        <Typewriter text="Coming soon..." />
      </Centered>
    );
  }

  return (
    <Stack sx={{ gap: 2, width: "100%" }}>
      {posts.map((post) => (
        <PostCard
          key={post.slug}
          post={post}
          to={`${basePath}/${encodeURIComponent(post.slug)}`}
        />
      ))}

      {/* An error raised by load-more, with the rows already fetched still shown. */}
      {error && (
        <Alert severity="error">
          {error}
        </Alert>
      )}

      {next && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          <Button
            onClick={loadMore}
            disabled={loadingMore}
            sx={{ color: "primary.main" }}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </Box>
      )}
    </Stack>
  );
}

export default PostList;
