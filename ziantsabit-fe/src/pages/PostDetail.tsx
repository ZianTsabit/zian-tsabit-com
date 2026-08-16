import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from "@mui/material";

import Centered from "../components/Centered";
import Markdown from "../components/Markdown";
import TagChip, { TagChipRow } from "../components/TagChip";
import Typewriter from "../components/Typewriter";
import { usePost } from "../services/usePost";
import { useRecordView } from "../services/useRecordView";
import { CATEGORY_LABELS } from "../services/posts";

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
 * One post's full content, reached by clicking its card in a section's list.
 * `backTo`/`backLabel` point back at that section, since a slug alone doesn't
 * say which of the three it came from.
 */
function PostDetail({ backTo, backLabel }: { backTo: string; backLabel: string }) {
  const { slug = "" } = useParams<{ slug: string }>();
  const { post, phase, error, retry } = usePost(slug);
  // Counts this read once per session, and hands back the total to show --
  // including the one just recorded, which the post itself is one behind on.
  const views = useRecordView(post);

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

            <Stack
              direction="row"
              sx={{
                alignSelf: "flex-start",
                gap: 1.5,
                alignItems: "center",
                // A post can be in several sections, and on a phone three
                // badges plus the view count overrun the line.
                flexWrap: "wrap",
              }}
            >
              {/* Already in CATEGORY_ORDER: the API sorts them, so the badges
                  read the same way round on every post. */}
              {post.categories.map((category) => (
                <TagChip key={category} label={CATEGORY_LABELS[category]} />
              ))}
              {views !== null && (
                <Typography
                  sx={{
                    fontSize: { xs: "12px", sm: "13px" },
                    color: "text.secondary",
                  }}
                >
                  {formatViews(views)}
                </Typography>
              )}
            </Stack>

            {/* Their own row rather than alongside the category chip: a post
                with several tags would otherwise push the view count off the
                end of the line on a phone. */}
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
          </Stack>
        )}
      </Container>
    </Box>
  );
}

export default PostDetail;
