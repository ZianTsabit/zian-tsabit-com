import { useState } from 'react'
import Box from '@mui/material/Box';
import GitHubIcon from '@mui/icons-material/GitHub';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import Stack from '@mui/material/Stack';
import { Link } from "react-router-dom";
import '../css/Footer.css';

function Footer() {
    return (
        <footer className="footer">
            <Stack
                direction="row"
                sx={{ alignItems: 'center', justifyContent: "center", gap: 56 }}
                >   
                    <Box>
                        <GitHubIcon />
                        <Link
                        to={"https://github.com/ZianTsabit"}
                        style={{
                        color: "white",
                        textDecoration: "none",
                        fontFamily: "'Ubuntu', sans-serif",
                        }}
                        >
                            github
                        </Link>
                    </Box>
                    
                    <Box>
                        <MailOutlinedIcon />
                        <Link
                        to={"tsabitg"}
                        style={{
                        color: "white",
                        textDecoration: "none",
                        fontFamily: "'Ubuntu', sans-serif",
                        }}
                        >
                            email
                        </Link>
                    </Box>

                    <Box>
                        <img
                            src="../assets/linkedin-logo.png"  
                            alt="LinkedIn Logo"
                            style={{
                                height: "24px",
                                width: "24px",
                                marginRight: "8px"
                            }}
                        />
                        <Link
                        to={"https://www.linkedin.com/in/ghaziantsabitalkamil/"}
                        style={{
                        color: "white",
                        textDecoration: "none",
                        fontFamily: "'Ubuntu', sans-serif",
                        }}
                        >
                            linkedin
                        </Link>
                    </Box>

            </Stack>
        </footer>
    );
}

export default Footer