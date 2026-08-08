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
  // a post written without an excerpt is not a bare title.
  const text = post.excerpt || post.body;

  return (
    <Box
      component={Link}
      to={to}
      sx={{
        display: "block",
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
            fontFamily: "'Ubuntu', sans-serif",
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
            fontFamily: "'Ubuntu', sans-serif",
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
            fontFamily: "'Ubuntu', sans-serif",
            fontSize: { xs: "14px", sm: "16px" },
            color: "text.primary",
            mt: 1,
            // Newlines typed in the admin should survive; a justified phone line
            // of ~35 characters opens rivers of whitespace, hence sm and up only.
            whiteSpace: "pre-line",
            textAlign: { xs: "left", sm: "justify" },
          }}
        >
          {text}
        </Typography>
      )}
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
          sx={{ fontFamily: "'Ubuntu', sans-serif" }}
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
        <Alert severity="error" sx={{ fontFamily: "'Ubuntu', sans-serif" }}>
          {error}
        </Alert>
      )}

      {next && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          <Button
            onClick={loadMore}
            disabled={loadingMore}
            sx={{ fontFamily: "'Ubuntu', sans-serif", color: "primary.main" }}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </Box>
      )}
    </Stack>
  );
}

export default PostList;
