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
  // YYYY-MM-DD, or "" for "no bound on this end". Both ends are inclusive.
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");
  const [page, setPage] = useState(1);

  const { posts, phase, error, totalPages, retry } = usePaginatedPosts(
    category === ALL ? undefined : (category as PostCategory),
    page,
    after,
    before,
  );

  // A filter change can easily land page 3 past the end of a smaller result
  // set, so every one of them resets back to the first page.
  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setPage(1);
  };

  const handleAfterChange = (value: string) => {
    setAfter(value);
    setPage(1);
  };

  const handleBeforeChange = (value: string) => {
    setBefore(value);
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
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ gap: 2, flexWrap: "wrap", alignSelf: "stretch" }}
        >
          {/* `displayEmpty` is what makes the "All categories" row show as the
              current value: without it a Select whose value is "" renders as an
              empty box, and the label has to be pinned shrunk to match. */}
          <TextField
            select
            size="small"
            label="Category"
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value)}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value={ALL}>All categories</MenuItem>
            {VISIBLE_CATEGORIES.map((value) => (
              <MenuItem key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </MenuItem>
            ))}
          </TextField>

          {/* Native date inputs: they bring their own calendar and their own
              locale formatting, and always hand back a YYYY-MM-DD string --
              which is exactly what the API takes. `shrink` is forced because
              the browser paints a placeholder even when the field is empty,
              which would otherwise collide with a floating label. */}
          <TextField
            type="date"
            size="small"
            label="From"
            value={after}
            onChange={(event) => handleAfterChange(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            type="date"
            size="small"
            label="To"
            value={before}
            onChange={(event) => handleBeforeChange(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 160 }}
          />
        </Stack>

        {phase === "loading" && (
          <Centered>
            <CircularProgress aria-label="Loading posts" />
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
