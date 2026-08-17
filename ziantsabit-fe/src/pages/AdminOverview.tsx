import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  Typography,
} from "@mui/material";

import NewPostButton from "../components/admin/NewPostButton";
import StatTile from "../components/admin/StatTile";
import { useAdminPosts } from "../services/useAdminPosts";
import { useAdminStats } from "../services/useAdminStats";

const RECENT_LIMIT = 5;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * The admin's landing page: how the site stands, and the way back into work.
 *
 * Deliberately thin against `/admin/stats`. This page answers "is there
 * anything to do" -- a few headline numbers and the posts last touched, each a
 * link into its editor. The breakdowns, the cadence chart and the full
 * most-read ranking live on the statistics page, and are not repeated here.
 */
function AdminOverview() {
  const navigate = useNavigate();
  const { stats, phase, error, reload } = useAdminStats();

  // Most recently edited, not most recently published: this is a "where was I"
  // list, and a post revised today is the one worth offering first.
  const recent = useAdminPosts("", "", "updated", 1);

  return (
    <Box sx={{ pb: { xs: 3, sm: 4 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          gap: 1,
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        {/* No "signed in as" line here: the nav carries it, beside the sign-out
            it belongs next to, and two copies on one screen is one too many. */}
        <Typography
          component="h1"
          sx={{ fontWeight: "bold", fontSize: { xs: "20px", sm: "24px" } }}
        >
          Overview
        </Typography>
        <NewPostButton onClick={() => navigate("/admin/new")} />
      </Stack>

      {phase === "loading" && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress aria-label="Loading overview" />
        </Box>
      )}

      {phase === "error" && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={reload}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {phase === "ready" && stats && (
        <Stack sx={{ gap: 4 }}>
          <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap" }}>
            <StatTile
              label="Posts"
              value={stats.total.toLocaleString()}
              hint={`${stats.published.toLocaleString()} published`}
            />
            <StatTile
              label="Drafts"
              value={stats.drafts.toLocaleString()}
              hint={stats.drafts > 0 ? "waiting to be finished" : "all caught up"}
            />
            <StatTile
              label="Views"
              value={stats.total_views.toLocaleString()}
              hint="across every post"
            />
          </Stack>

          <Box>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 1.5 }}
            >
              <Typography component="h2" sx={{ fontSize: "16px", fontWeight: 600 }}>
                Recently edited
              </Typography>
              <Link component={RouterLink} to="/admin/posts" sx={{ fontSize: "13px" }}>
                All posts
              </Link>
            </Stack>

            {recent.phase === "loading" && (
              <CircularProgress size={20} aria-label="Loading recent posts" />
            )}

            {recent.phase === "error" && (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={recent.reload}>
                    Retry
                  </Button>
                }
              >
                {recent.error}
              </Alert>
            )}

            {recent.phase === "ready" && recent.posts.length === 0 && (
              <Typography sx={{ fontSize: "14px", color: "text.secondary" }}>
                No posts yet. Start with "New post" above.
              </Typography>
            )}

            {recent.phase === "ready" && recent.posts.length > 0 && (
              <Stack sx={{ gap: 0 }}>
                {recent.posts.slice(0, RECENT_LIMIT).map((post) => (
                  <Stack
                    key={post.slug}
                    direction="row"
                    sx={{
                      gap: 2,
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      py: 1,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Link
                      component={RouterLink}
                      to={`/admin/edit/${encodeURIComponent(post.slug)}`}
                      sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                    >
                      {post.title}
                    </Link>
                    <Typography
                      sx={{
                        fontSize: "12px",
                        color: "text.secondary",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {post.status === "draft" ? "Draft" : "Published"} ·{" "}
                      {formatDate(post.updated_at)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      )}
    </Box>
  );
}

export default AdminOverview;
