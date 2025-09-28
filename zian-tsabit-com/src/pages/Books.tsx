import { Box, Typography } from '@mui/material';

function Books() {
  return (
    <Box
      sx={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        bgcolor: "#0000",
        alignItems: "center",
        marginTop: "36px",
      }}
    >
      <Box
        sx={{
          maxWidth: "800px",
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
            color: "white",
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
            color: "white",
            fontSize: { xs: "12px", sm: "14px", md: "16px", lg: "22px" },
          }}
        >
          - Umberto Eco
        </Typography>
      </Box>
    </Box>
  );
}

export default Books;