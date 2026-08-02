import { Box, Container, Typography } from '@mui/material';
import { PAGE_MIN_HEIGHT } from "../constants/layout";

function Books() {
  return (
    <Box
      sx={{
        width: "100%",
        minHeight: PAGE_MIN_HEIGHT,
        display: "flex",
        flexDirection: "column",
        bgcolor: "transparent",
        alignItems: "center",
        pt: { xs: 2, sm: 3 },
      }}
    >
      <Container
        maxWidth="md"
        sx={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Typography
          variant="h5"
          component="div"
          sx={{
            textAlign: "justify",
            marginBottom: "20px",
            fontStyle: "italic",
            color: "text.primary",
            fontSize: { xs: "12px", sm: "14px", md: "16px", lg: "22px" },
          }}
        >
          It is foolish to think that you have to read all the books you buy,
          as it is foolish to criticize those who buy more books than they
          will ever be able to read ...
        </Typography>

        <Typography
          variant="h5"
          component="div"
          sx={{
            textAlign: "right",
            fontStyle: "italic",
            color: "text.primary",
            fontSize: { xs: "12px", sm: "14px", md: "16px", lg: "22px" },
          }}
        >
          - Umberto Eco
        </Typography>
      </Container>
    </Box>
  );
}

export default Books;