import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Stack from "@mui/material/Stack";
import { Box, Drawer, IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import ColorModeToggle from "./ColorModeToggle";
import { HEADER_HEIGHT } from "../constants/layout";

const navItems = [
  { to: "/about", label: "About" },
  { to: "/curriculum-vitae", label: "CV" },
  { to: "/posts", label: "Posts" },
  { to: "/books", label: "Books" },
  { to: "/projects", label: "Projects" },
];

function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const linkStyle = {
    color: "text.primary",
    textDecoration: "none",
  };

  return (
    <Box
      component="header"
      sx={{
        width: "100%",
        height: HEADER_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 1000,
        px: { xs: 1.5, sm: 2, md: 3 },
        // Transparent at the top of the page, then a translucent wash of
        // whatever the current scheme's background is.
        bgcolor: (theme) =>
          isScrolled
            ? (theme.vars ?? theme).palette.headerScrolled
            : "transparent",
        backdropFilter: isScrolled ? "blur(6px)" : "none",
        transition: "background-color 0.3s ease",
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          maxWidth: "1200px",
          // A flat gap of 8 (64px) pushed the logo and hamburger apart hard
          // enough to overflow narrow phones.
          gap: { xs: 1, sm: 2, md: 4 },
          minWidth: 0,
        }}
      >
        {/* Logo / Name */}
        <Box
          component={Link}
          to="/"
          sx={{
            ...linkStyle,
            fontFamily: "'Ubuntu', sans-serif",
            // A plain 2vw preferred value only clears the 16px floor above an
            // 800px viewport, so the logo was pinned at its minimum on every
            // phone. The rem term makes it scale across the whole range.
            fontSize: "clamp(20px, 1.25rem + 0.7vw, 28px)",
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          Zian Tsabit
        </Box>

        <Stack direction="row" sx={{ alignItems: "center", gap: { xs: 0.5, md: 2 } }}>
          {/* Desktop Navigation */}
          <Box
            component="ul"
            role="menubar"
            sx={{
              display: { xs: "none", md: "flex" },
              flexDirection: "row",
              fontFamily: "'Ubuntu', sans-serif",
              gap: { xs: 2, sm: 3, md: 4 },
              listStyle: "none",
              m: 0,
              p: 0,
            }}
          >
            {navItems.map((item) => (
              <Box component="li" key={item.to} role="none">
                <Box
                  component={Link}
                  to={item.to}
                  role="menuitem"
                  sx={{ ...linkStyle, fontSize: "clamp(12px, 1.2vw, 16px)" }}
                >
                  {item.label}
                </Box>
              </Box>
            ))}
          </Box>

          <ColorModeToggle />

          {/* Mobile Hamburger */}
          <IconButton
            onClick={handleDrawerToggle}
            aria-label="Open navigation menu"
            sx={{
              display: { xs: "inline-flex", md: "none" },
              color: "text.primary",
              // A 24px margin on a 56px bar overflowed the header entirely.
              p: 1,
            }}
          >
            <MenuIcon />
          </IconButton>
        </Stack>
      </Stack>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "background.default",
              color: "text.primary",
              backgroundImage: "none",
              // Fixed 240px was a large share of a small phone; cap it by viewport.
              width: { xs: "70vw", sm: "240px" },
              maxWidth: "280px",
              p: 2,
            },
          },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <IconButton onClick={handleDrawerToggle} sx={{ color: "text.primary" }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box
          component="ul"
          role="menu"
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            mt: 2,
            fontFamily: "'Ubuntu', sans-serif",
            listStyle: "none",
            m: 0,
            p: 0,
          }}
        >
          {navItems.map((item) => (
            <Box
              component="li"
              key={item.to}
              role="none"
              onClick={handleDrawerToggle}
            >
              <Box
                component={Link}
                to={item.to}
                role="menuitem"
                sx={{ ...linkStyle, fontSize: "16px" }}
              >
                {item.label}
              </Box>
            </Box>
          ))}
        </Box>
      </Drawer>
    </Box>
  );
}

export default Header;
