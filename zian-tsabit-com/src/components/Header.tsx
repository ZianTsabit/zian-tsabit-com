import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import List from '@mui/joy/List';
import Stack from '@mui/material/Stack';
import ListItem from '@mui/joy/ListItem';
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
        <header 
            className={`header ${isScrolled ? "scrolled" : ""}`}
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
            }}>
            <Stack
                direction="row"
                sx={{ alignItems: 'center', justifyContent: "center", gap: 56 }}
                >
                    <Link 
                        to="/"
                        style={{
                        color: "white",
                        textDecoration: "none",
                        fontFamily: "'Ubuntu', sans-serif",
                        fontSize: "25px",
                        }}>
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
                            { to: "/projects", label: "Projects" },
                            { to: "/books", label: "Books" },
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
        </header>
    );
}

export default Header