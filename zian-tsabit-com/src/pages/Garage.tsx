import { Box, Container } from '@mui/material';
import Typewriter from "../components/Typewriter";

function Garage() {
  return (
    <Box
      sx={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "black",
      }}
    >
      <Container
        maxWidth="md"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          py: { xs: 4, md: 6 },
        }}
      >
        <Typewriter text="Coming soon..." />
      </Container>
    </Box>
  );
}

export default Garage;