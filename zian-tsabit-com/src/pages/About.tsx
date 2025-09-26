import {
  Box,
  Typography
} from "@mui/material";


function About() {
  
  return (
    <Box
      sx={{
        width: "75vh",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        bgcolor: "#0000",
        alignItems: "center",
        marginTop: "36px",
    }}>
      <Typography gutterBottom variant="h5" component="div" sx={{ fontFamily: "'Ubuntu', sans-serif" }}>
        Coming soon...
      </Typography>
    </Box>
  );
}

export default About;