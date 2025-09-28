import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import List from '@mui/joy/List';
import Stack from '@mui/material/Stack';
import ListItem from '@mui/joy/ListItem';
import { Box } from "@mui/material";
import '../css/Header.css';

function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
        }}
        >
        <Stack
            direction="row"
            sx={{
            alignItems: "center",
            justifyContent: "center",
            gap: 56,
            }}
        >
            <Link
            to="/"
            style={{
                color: "white",
                textDecoration: "none",
                fontFamily: "'Ubuntu', sans-serif",
                fontSize: "25px",
            }}
            >
            Zian Tsabit
            </Link>

            <List
            role="menubar"
            sx={{
                display: "flex",
                flexDirection: "row",
                fontFamily: "'Ubuntu', sans-serif",
                gap: 4,
                p: 0,
            }}
            >
            {[
                { to: "/about", label: "About" },
                { to: "/curriculum-vitae", label: "CV" },
                { to: "/books", label: "Books" },
                { to: "/projects", label: "Projects" },
                { to: "/garage", label: "Garage Sale" },
            ].map((item) => (
                <ListItem key={item.to} role="none" sx={{ width: "auto", p: 0 }}>
                <Link
                    to={item.to}
                    style={{
                    color: "white",
                    textDecoration: "none",
                    }}
                >
                    {item.label}
                </Link>
                </ListItem>
            ))}
            </List>
        </Stack>
    </Box>
  );
}

export default Header;