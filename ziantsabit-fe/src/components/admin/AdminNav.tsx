import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import { NavLink } from "react-router-dom";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";

/** The admin's sections, in the order they appear. One array feeds the column
 *  and the phone row alike, so a new page is one entry rather than two. */
const items = [
  { to: "/admin", label: "Overview", icon: <DashboardOutlinedIcon fontSize="small" /> },
  // "Blog" names the section, matching the public nav. The *items* in it are
  // still posts, which is why "New post" further in stays as it is.
  { to: "/admin/posts", label: "Blog", icon: <ArticleOutlinedIcon fontSize="small" /> },
  { to: "/admin/books", label: "Books", icon: <MenuBookOutlinedIcon fontSize="small" /> },
  // Sits after the two things the owner writes and before the numbers, which
  // is roughly the order of the work: publish, then read what came back.
  { to: "/admin/comments", label: "Comments", icon: <ForumOutlinedIcon fontSize="small" /> },
  { to: "/admin/stats", label: "Statistics", icon: <InsightsOutlinedIcon fontSize="small" /> },
];

interface Props {
  username: string | null;
  onSignOut: () => void;
}

/**
 * Section nav for the admin, and the home of the sign-out control.
 *
 * A left column from `md` up and a scrolling row of the same links below it --
 * a 180px column on a phone would leave the post list about forty characters
 * wide. Deliberately not a `Drawer`: there are a handful of destinations, and
 * hiding them behind a button costs a tap to answer "where am I".
 *
 * Signing out lives here rather than on the post list, where it used to sit:
 * it is chrome for the whole admin, and leaving it on one page would mean
 * either repeating it on every other one or having it vanish when you
 * navigate.
 */
function AdminNav({ username, onSignOut }: Props) {
  return (
    <Box
      component="nav"
      aria-label="Admin sections"
      sx={{
        flexShrink: 0,
        width: { xs: "100%", md: 180 },
        // Follows the list past the fold on a tall page. `top` clears the site
        // header, which is fixed and out of flow.
        position: { md: "sticky" },
        top: { md: (theme) => `calc(${theme.spacing(3)} + 64px)` },
        alignSelf: { md: "flex-start" },
        mb: { xs: 2, md: 0 },
      }}
    >
      <Stack
        direction={{ xs: "row", md: "column" }}
        sx={{
          gap: 0.5,
          // On a phone the links scroll sideways inside their own box
          // rather than widening the document -- see "nothing may widen the
          // page" in CLAUDE.md.
          overflowX: { xs: "auto", md: "visible" },
          pb: { xs: 1, md: 0 },
        }}
      >
        {items.map((item) => (
          <Button
            key={item.to}
            component={NavLink}
            to={item.to}
            // Without `end`, "/admin" would stay highlighted on every child
            // route, since NavLink matches by prefix.
            end={item.to === "/admin"}
            startIcon={item.icon}
            color="inherit"
            sx={{
              flexShrink: 0,
              justifyContent: "flex-start",
              textTransform: "none",
              fontSize: "14px",
              px: 1.5,
              color: "text.secondary",
              // NavLink sets .active itself; styling through it keeps the
              // current section marked without a second source of truth.
              "&.active": {
                color: "primary.main",
                bgcolor: "background.paper",
                fontWeight: 600,
              },
            }}
          >
            {item.label}
          </Button>
        ))}
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      {/* One block for both layouts rather than a phone copy and a desktop
          copy: two of them drifted immediately, the phone one ending up as a
          shouty "SIGN OUT (ZIANTSABIT)" because it had nowhere to put the
          caption. Only the direction changes. */}
      <Stack
        direction={{ xs: "row", md: "column" }}
        sx={{
          alignItems: { xs: "center", md: "flex-start" },
          gap: { xs: 1.5, md: 0.5 },
          px: 1.5,
        }}
      >
        <Typography sx={{ fontSize: "12px", color: "text.secondary" }}>
          Signed in as {username ?? "unknown"}
        </Typography>
        <Button
          color="inherit"
          size="small"
          onClick={onSignOut}
          sx={{ px: 0, minWidth: 0, flexShrink: 0 }}
        >
          Sign out
        </Button>
      </Stack>
    </Box>
  );
}

export default AdminNav;
