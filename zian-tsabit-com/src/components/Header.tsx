import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import Stack from "@mui/material/Stack";
import { Box, Drawer, IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import "../css/Header.css";

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

  const navItems = [
    { to: "/about", label: "About" },
    { to: "/curriculum-vitae", label: "CV" },
    { to: "/books", label: "Books" },
    { to: "/projects", label: "Projects" },
    { to: "/garage", label: "Garage Sale" },
  ];

  return (
    <Box
      component="header"
      className={`header ${isScrolled ? "scrolled" : ""}`}
      sx={{
        width: "100%",
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 1000,
        bgcolor: "transparent",
        px: 2,
        
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          alignContent: "center",
          justifyContent: "space-between",
          width: "100%",
          maxWidth: "1200px",
          gap: 8,
        }}
      >
        {/* Logo / Name */}
        <Link
          to="/"
          style={{
            color: "white",
            textDecoration: "none",
            fontFamily: "'Ubuntu', sans-serif",
            fontSize: "clamp(18px, 2vw, 28px)",
            fontWeight: "bold",
          }}
        >
          Zian Tsabit
        </Link>

        {/* Desktop Navigation */}
        <List
          role="menubar"
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "row",
            fontFamily: "'Ubuntu', sans-serif",
            gap: { xs: 2, sm: 3, md: 4 },
            p: 0,
          }}
        >
          {navItems.map((item) => (
            <ListItem key={item.to} role="none" sx={{ width: "auto", p: 0 }}>
              <Link
                to={item.to}
                style={{
                  color: "white",
                  textDecoration: "none",
                  fontSize: "clamp(12px, 1.2vw, 16px)",
                }}
              >
                {item.label}
              </Link>
            </ListItem>
          ))}
        </List>

        {/* Mobile Hamburger */}
        <IconButton
          onClick={handleDrawerToggle}
          sx={{ 
            display: { xs: "block", md: "none" }, 
            color: "white",
            margin: "24px"
        }}
        >
          <MenuIcon />
        </IconButton>
      </Stack>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        PaperProps={{
          sx: { 
            bgcolor: "black",
            color: "white", 
            width: "240px", 
            p: 2 
        },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <IconButton onClick={handleDrawerToggle} sx={{ color: "white" }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <List
          role="menu"
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            mt: 2,
            fontFamily: "'Ubuntu', sans-serif",
          }}
        >
          {navItems.map((item) => (
            <ListItem
              key={item.to}
              role="none"
              sx={{ width: "auto", p: 0 }}
              onClick={handleDrawerToggle}
            >
              <Link
                to={item.to}
                style={{
                  color: "white",
                  textDecoration: "none",
                  fontSize: "16px",
                }}
              >
                {item.label}
              </Link>
            </ListItem>
          ))}
        </List>
      </Drawer>
    </Box>
  );
}

export default Header;
