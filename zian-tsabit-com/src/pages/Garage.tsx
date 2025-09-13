import { useState } from 'react'
import { Box, Typography } from '@mui/material';
;

function Garage() {
    return (
        <Box
            sx={{
            width: "100%",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            bgcolor: "#0000",
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <Typography gutterBottom variant="h5" component="div" sx={{ fontFamily: "'Ubuntu', sans-serif" }}>
                Coming soon...
            </Typography>
        </Box>
    );
}

export default Garage