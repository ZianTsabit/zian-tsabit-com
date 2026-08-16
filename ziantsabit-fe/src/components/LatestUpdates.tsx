import { Alert, Box, Button, CircularProgress, Stack } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { CATEGORY_BASE_PATHS } from "../services/posts";
import { useLatestPosts } from "../services/useLatestPosts";
import Centered from "./Centered";
import { PostCard } from "./PostList";
import Typewriter from "./Typewriter";

/**
 * Home's "Latest Updates" feed: the most recently edited posts across every
 * section, each card linking back into whichever section it actually belongs
 * to, and dated by that same last edit rather than by publication.
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
    // flex: 1 so the list fills the space Home's feed wrapper hands it, which is
    // what gives the mt: "auto" below something to push against.
    <Stack sx={{ gap: 2, width: "100%", flex: 1 }}>
      {posts.map((post) => (
        <PostCard
          key={post.slug}
          post={post}
          to={`${CATEGORY_BASE_PATHS[post.category]}/${encodeURIComponent(post.slug)}`}
          // The date this feed is ordered by, so the cards agree with the
          // order they are in. Only here: the section lists are still by
          // publication date, and so are their cards.
          dated="updated"
        />
      ))}

      {/* Only under a populated list: with nothing published, /posts would just
          show the same "Coming soon..." this section is already showing. */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          pt: 1,
          // Breathing room above the footer's top border. `mt: "auto"` parks
          // this link at the very bottom of the page on a short list, which
          // otherwise leaves it sitting right on that line.
          pb: { xs: 3, sm: 4 },
          // Soaks up whatever vertical space the cards leave, so the link sits
          // at the bottom of the page on a short list and directly under the
          // last card once the list is long enough to fill it.
          mt: "auto",
        }}
      >
        <Button
          component={RouterLink}
          to="/posts"
          sx={{ color: "primary.main" }}
        >
          {/* A literal glyph, matching PostDetail's "← Back to ..." link, so the
              two navigation affordances read as a pair. */}
          See all posts →
        </Button>
      </Box>
    </Stack>
  );
}

export default LatestUpdates;
