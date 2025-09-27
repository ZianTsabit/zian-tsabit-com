import { Box } from '@mui/material';
import Typewriter from "../components/Typewriter";

function Projects() {
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
            <Typewriter 
                text="Coming soon..." 
            />
        </Box>
    );
}

export default Projects