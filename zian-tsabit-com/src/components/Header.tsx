import { useState } from 'react'
import { Link } from "react-router-dom";
import Typography from '@mui/material/Typography';
import List from '@mui/joy/List';
import Stack from '@mui/material/Stack';
import ListItem from '@mui/joy/ListItem';
import '../css/Header.css'

function Header() {
    return (
        <header 
            className='header'   
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
                    <Typography variant="h5" component="div" sx={{ fontFamily: "'Ubuntu', sans-serif", color:"white"}}>
                        Zian Tsabit
                    </Typography>
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
                            { to: "/", label: "Home" },
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