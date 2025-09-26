import { Box, Typography } from '@mui/material';

function Books() {
    return (
        <Box
            sx={{
            width: "100vh",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            bgcolor: "#0000",
            marginTop: "36px",
            }}>
            
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "20px",
                }}>
                <Typography
                    variant="h5"
                    component="div"
                    sx={{
                        textAlign: "justify",
                        marginBottom: "20px",
                        fontStyle: "italic"
                    }}>
                    It is foolish to think that you have to read all the books you buy, as it is foolish to criticize those who buy more books than they will ever be able to read ...
                </Typography>
                <Typography 
                    variant="h5" 
                    component="div" 
                    sx={{ 
                        textAlign: "right",
                        fontStyle: "italic"
                    }}>
                    - Umberto Eco
                </Typography>
            </Box>
        </Box>
    );
}

export default Books