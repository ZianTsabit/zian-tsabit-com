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
import Typewriter from "./Typewriter";

/** Wrapper for the three states that have nothing to list yet, so each one is
 *  centred in the space the page left over rather than clinging to the top. */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        py: 4,
      }}
    >
      {children}
    </Box>
  );
}

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

function PostCard({ post }: { post: Post }) {
  // Excerpt is the summary when there is one; otherwise the body stands in, so
  // a post written without an excerpt is not a bare title.
  const text = post.excerpt || post.body;

  return (
    <Box
      component="article"
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: { xs: 2, sm: 2.5 },
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
 * pages using it make their Container a flex column.
 */
function PostList({ category }: { category: PostCategory }) {
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
        <PostCard key={post.slug} post={post} />
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
