import { Box, Container } from '@mui/material';
import PostList from "../components/PostList";

function Garage() {
  return (
    <Box
      sx={{
        width: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      {/* Flex column with flex: 1 so PostList can centre its loading and empty
          states in the leftover space. */}
      <Container
        maxWidth="md"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          py: { xs: 4, md: 6 },
        }}
      >
        <PostList category="garage_sale" />
      </Container>
    </Box>
  );
}

export default Garage;
