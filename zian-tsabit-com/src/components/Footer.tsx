import { useState } from 'react'
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import '../css/Footer.css';

function Footer() {
    return (
        <footer className="footer">
            <Stack
                direction="row"
                sx={{ alignItems: 'center', justifyContent: "center", gap: 56 }}
                >
                    <Typography variant="h6" component="div" sx={{ fontFamily: "'Ubuntu', sans-serif", color:"white"}}>
                        github
                    </Typography>
                    <Typography variant="h6" component="div" sx={{ fontFamily: "'Ubuntu', sans-serif", color:"white"}}>
                        email
                    </Typography>
            </Stack>
        </footer>
    );
}

export default Footer