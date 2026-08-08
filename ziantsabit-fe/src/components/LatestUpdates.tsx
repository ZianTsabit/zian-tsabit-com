import { Alert, Button, CircularProgress, Stack } from "@mui/material";

import { CATEGORY_BASE_PATHS } from "../services/posts";
import { useLatestPosts } from "../services/useLatestPosts";
import Centered from "./Centered";
import { PostCard } from "./PostList";
import Typewriter from "./Typewriter";

/**
 * Home's "Latest Updates" feed: the newest posts across every section, each
 * card linking back into whichever section it actually belongs to.
 */
function LatestUpdates({ limit }: { limit: number }) {
  const { posts, phase, error, retry } = useLatestPosts(limit);

  if (phase === "loading") {
    return (
      <Centered>
        <CircularProgress aria-label="Loading latest updates" />
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
    // The placeholder this section shipped with, kept for the case it was
    // written for: there is genuinely nothing published yet.
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
          to={`${CATEGORY_BASE_PATHS[post.category]}/${encodeURIComponent(post.slug)}`}
        />
      ))}
    </Stack>
  );
}

export default LatestUpdates;
