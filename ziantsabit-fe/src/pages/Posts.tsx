import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  MenuItem,
  Pagination,
  Stack,
  TextField,
} from "@mui/material";

import Centered from "../components/Centered";
import { PostCard } from "../components/PostList";
import Typewriter from "../components/Typewriter";
import {
  CATEGORY_BASE_PATHS,
  CATEGORY_LABELS,
  VISIBLE_CATEGORIES,
  type PostCategory,
} from "../services/posts";
import { usePaginatedPosts } from "../services/usePaginatedPosts";

const ALL = "";

function Posts() {
  const [category, setCategory] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const { posts, phase, error, totalPages, retry } = usePaginatedPosts(
    category === ALL ? undefined : (category as PostCategory),
    page,
  );

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    // A filter change can easily land page 3 past the end of a smaller result
    // set, so it resets back to the first page rather than keeping it.
    setPage(1);
  };

  return (
    <Box
      sx={{
        width: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      <Container
        maxWidth="md"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          py: { xs: 4, md: 6 },
          gap: 3,
        }}
      >
        <TextField
          select
          size="small"
          label="Category"
          value={category}
          onChange={(event) => handleCategoryChange(event.target.value)}
          sx={{ minWidth: 180, alignSelf: "flex-start" }}
        >
          <MenuItem value={ALL}>All categories</MenuItem>
          {VISIBLE_CATEGORIES.map((value) => (
            <MenuItem key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </MenuItem>
          ))}
        </TextField>

        {phase === "loading" && (
          <Centered>
            <CircularProgress aria-label="Loading posts" />
          </Centered>
        )}

        {phase === "error" && (
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
        )}

        {phase === "ready" && posts.length === 0 && (
          // The placeholder this page shipped with, kept for the case it was
          // written for: there is genuinely nothing published in this filter.
          <Centered>
            <Typewriter text="Coming soon..." />
          </Centered>
        )}

        {phase === "ready" && posts.length > 0 && (
          <>
            <Stack sx={{ gap: 2, width: "100%" }}>
              {posts.map((post) => (
                <PostCard
                  key={post.slug}
                  post={post}
                  to={`${CATEGORY_BASE_PATHS[post.category]}/${encodeURIComponent(post.slug)}`}
                />
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
          </>
        )}
      </Container>
    </Box>
  );
}

export default Posts;
