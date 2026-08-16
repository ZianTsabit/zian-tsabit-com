import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import LatestUpdates from "../components/LatestUpdates";

function Home() {
  return (
    <Box
      sx={{
        width: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "transparent",
        alignItems: "center",
        pt: { xs: 2, sm: 3 },
      }}
    >
      <Container
        maxWidth="md"
        sx={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        {/* The introduction that used to sit here lives on /about now; the page
            opens straight onto the feed. */}

        {/* Latest Updates: the heading sits on top of the rule, which then runs
            under it as its underline -- the same shape as `SectionHeading` on
            the CV and About pages. */}
        <Typography
          variant="body1"
          component="div"
          color="text.primary"
          sx={{
            textAlign: "left",
            mt: "18px",
            mb: "8px",
            ml: "4px",
            fontWeight: "bold",
            // Same scale as SectionHeading, so section titles are one size
            // across Home, CV and About.
            fontSize: { xs: "16px", sm: "18px", md: "20px" },
          }}
        >
          Latest Updates
        </Typography>

        <Divider sx={{ bgcolor: "divider", mb: "18px" }} />

        <Box
          sx={{
            width: "100%",
            // Absorbs the leftover space instead of adding a fixed 30vh, which
            // pushed the page just past the viewport on a phone. LatestUpdates
            // centres its own loading/error/empty states via Centered, so this
            // wrapper doesn't need alignItems/justifyContent itself -- doing
            // both would also centre the populated card list, which should
            // stay left-aligned and full width.
            flex: 1,
            minHeight: { xs: "20vh", sm: "30vh" },
            display: "flex",
            flexDirection: "column",
          }}
        >
          <LatestUpdates limit={5} />
        </Box>
      </Container>
    </Box>
  );
}

export default Home;