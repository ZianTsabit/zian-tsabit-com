import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import MonthlyBars from "../components/admin/MonthlyBars";
import StatTile from "../components/admin/StatTile";
import { fillMonths, monthLabel } from "../services/adminStats";
import { useAdminStats } from "../services/useAdminStats";

/** 1204 -> "1,204", in the viewer's locale. */
function count(value: number): string {
  return value.toLocaleString();
}

function SectionHeading({ children }: { children: string }) {
  return (
    <Typography
      component="h2"
      sx={{ fontSize: "16px", fontWeight: 600, mb: 1.5 }}
    >
      {children}
    </Typography>
  );
}

/**
 * Statistics for every post on the site.
 *
 * Read-only, and deliberately so: everything here links back to the post list
 * or an editor rather than acting in place, so there is one page that changes
 * posts and one that describes them.
 */
function AdminStats() {
  const { stats, phase, error, reload } = useAdminStats();

  const months = stats ? fillMonths(stats.published_by_month) : [];

  return (
    <Box sx={{ pb: { xs: 3, sm: 4 } }}>
      <Typography
        component="h1"
        sx={{ fontWeight: "bold", fontSize: { xs: "20px", sm: "24px" }, mb: 2 }}
      >
        Statistics
      </Typography>

      {phase === "loading" && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress aria-label="Loading statistics" />
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
              value={count(stats.total)}
              hint={`${count(stats.drafts)} ${
                stats.drafts === 1 ? "draft" : "drafts"
              }`}
            />
            <StatTile label="Published" value={count(stats.published)} />
            <StatTile label="Views" value={count(stats.total_views)} />
            <StatTile
              label="Average views"
              value={stats.average_views.toLocaleString()}
              hint="per published post"
            />
          </Stack>

          <Box>
            <SectionHeading>Published per month</SectionHeading>
            {months.length === 0 ? (
              <Typography sx={{ fontSize: "14px", color: "text.secondary" }}>
                Nothing published yet.
              </Typography>
            ) : (
              <>
                <MonthlyBars months={months} />
                {/* The chart's table twin. Every value the bars encode is
                    readable here too, so nothing depends on seeing colour or
                    landing a hover -- and months with none are named rather
                    than being a gap you have to count. */}
                <Box component="details" sx={{ mt: 1.5 }}>
                  <Box
                    component="summary"
                    sx={{
                      fontSize: "13px",
                      color: "text.secondary",
                      cursor: "pointer",
                    }}
                  >
                    Show as a table
                  </Box>
                  <Table size="small" sx={{ mt: 1, maxWidth: 320 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Month</TableCell>
                        <TableCell align="right">Posts</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {months.map((row) => (
                        <TableRow key={row.month}>
                          <TableCell>{monthLabel(row.month)}</TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {row.count}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </>
            )}
          </Box>

          <Box>
            <SectionHeading>Most read</SectionHeading>
            {stats.most_read.length === 0 ? (
              <Typography sx={{ fontSize: "14px", color: "text.secondary" }}>
                No post has been read yet.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Post</TableCell>
                    <TableCell align="right">Views</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.most_read.map((post) => (
                    <TableRow key={post.slug}>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/admin/edit/${encodeURIComponent(post.slug)}`}
                        >
                          {post.title}
                        </Link>
                        {/* Only worth saying when it is the surprising case:
                            a draft with reads is one the owner opened, or one
                            that was published and pulled back. */}
                        {post.status === "draft" && (
                          <Typography
                            component="span"
                            sx={{
                              ml: 1,
                              fontSize: "12px",
                              color: "text.secondary",
                            }}
                          >
                            draft
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell
                        align="right"
                        // A column of numbers, so they line up.
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {count(post.view_count)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        </Stack>
      )}
    </Box>
  );
}

export default AdminStats;
