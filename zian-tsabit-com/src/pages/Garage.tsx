import { Box, Container } from '@mui/material';
import Typewriter from "../components/Typewriter";
import { PAGE_MIN_HEIGHT } from "../constants/layout";

function Garage() {
  return (
    <Box
      sx={{
        width: "100%",
        minHeight: PAGE_MIN_HEIGHT,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
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