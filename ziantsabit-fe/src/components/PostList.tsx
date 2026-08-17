import { useState } from "react";
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

import type { Post, PostCategory } from "../services/posts";
import { usePaginatedPosts } from "../services/usePaginatedPosts";
import Centered from "./Centered";
import { TagChipRow } from "./TagChip";
import { toPlainText } from "./markdownText";
import Typewriter from "./Typewriter";

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

/** Exported for reuse by the Posts page's all-categories view, which mixes
 *  categories and so needs to build each card's `to` itself.
 *
 *  Deliberately not a card: no border, no surface, no hover state. The entries
 *  are separated by the space between them, so a list of them reads as one
 *  column of writing rather than a stack of boxes.
 *
 *  **The entry is not a link.** Only "Read full post" navigates. A whole block
 *  wrapped in an anchor cannot hold anything else selectable -- dragging to
 *  copy a line of the excerpt starts a drag of the link instead -- and it gives
 *  a screen reader one enormous link whose name is every word in the entry. */
export function PostCard({ post, to }: { post: Post; to: string }) {
  // Excerpt is the summary when there is one; otherwise the body stands in, so
  // a post written without an excerpt is not a bare title. The body is
  // Markdown, so it is flattened first -- a card is no place for `## Heading`.
  const text = post.excerpt || toPlainText(post.body);

  return (
    <Box
      component="article"
      sx={{
        display: "flex",
        // The thumbnail leads the entry on a wide screen and sits on top of it
        // on a phone, where 120px of it would leave the title no room.
        flexDirection: { xs: "column", sm: "row" },
        gap: { xs: 1.5, sm: 2.5 },
      }}
    >
      {post.cover_image_url && (
        <Box
          component="img"
          src={post.cover_image_url}
          // Empty alt marks it decorative, which is the honest default: the
          // title beside it already carries the meaning. An author who filled
          // the alt field in gets what they wrote.
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

      {/* minWidth: 0 so a long unbroken word in the excerpt shrinks this column
          instead of pushing the entry wider than the page. */}
      <Box sx={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography
          component="h2"
          sx={{
            fontWeight: "bold",
            // Kept below the heading of whichever list this sits in -- a
            // section heading is 20/22/24px.
            fontSize: { xs: "16px", sm: "18px" },
            color: "text.primary",
          }}
        >
          {post.title}
        </Typography>

        <Typography
          sx={{ fontSize: { xs: "12px", sm: "13px" }, color: "text.secondary" }}
        >
          <Box component="time" dateTime={post.updated_at}>
            Updated {formatDate(post.updated_at)}
          </Box>
          {" | "}
          {/* The count as it was when this page was fetched. The detail page
              adds the read it is itself recording; a list records nothing. */}
          {formatViews(post.view_count)}
        </Typography>

        {text && (
          <Typography
            sx={{
              fontSize: { xs: "14px", sm: "16px" },
              color: "text.primary",
              // Newlines typed in the admin should survive; a justified phone
              // line of ~35 characters opens rivers of whitespace, hence sm up.
              whiteSpace: "pre-line",
              textAlign: { xs: "left", sm: "justify" },
              // An entry is a teaser. Bodies are Markdown documents, so an
              // unclamped fallback preview can run to the length of the whole
              // post; three lines keeps every entry the same rough size.
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 3,
              overflow: "hidden",
            }}
          >
            {text}
          </Typography>
        )}

        {post.tags.length > 0 && <TagChipRow labels={post.tags} />}

        <Box
          component={Link}
          to={to}
          // "Read full post" on its own is the same name on every entry of the
          // page, which is no help to anyone listing a page's links; the title
          // makes each one say where it actually goes.
          aria-label={`Read full post: ${post.title}`}
          sx={{
            alignSelf: "flex-start",
            mt: 0.5,
            fontSize: { xs: "13px", sm: "14px" },
            color: "primary.main",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {/* A literal glyph, matching PostDetail's "← Back to ..." link. */}
          Read full post →
        </Box>
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
  const [page, setPage] = useState(1);
  const { posts, phase, error, totalPages, retry } = usePaginatedPosts(category, page);

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
    <Stack sx={{ gap: { xs: 4, sm: 5 }, width: "100%" }}>
      {/* Its own Stack so the rule falls only between entries, not above the
          pagination. The gap is per side -- a divider is a flex child, so it
          gets the gap above and below it. */}
      <Stack divider={<Divider />} sx={{ gap: { xs: 2.5, sm: 3 } }}>
        {posts.map((post) => (
          <PostCard
            key={post.slug}
            post={post}
            to={`${basePath}/${encodeURIComponent(post.slug)}`}
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
    </Stack>
  );
}

export default PostList;
