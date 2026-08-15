import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import LatestUpdates from "../components/LatestUpdates";
import { HEADER_HEIGHT } from "../constants/layout";

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

        {/* Divider */}
        <Divider
          sx={{
            bgcolor: "divider",
            my: "8px",
          }}
        />

        {/* Latest Updates: the heading sits above the feed on a phone and
            beside it from md, where it pins to the left and stays put while
            the cards scroll past. */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          sx={{ width: "100%", flex: 1, mt: "18px", gap: { xs: 0, md: 3 } }}
        >
          <Box
            sx={{
              flexShrink: 0,
              width: { md: "150px" },
              // A flex item is stretched to the row's full height by default,
              // which leaves `sticky` nothing to slide within: it would be
              // pinned to a box exactly as tall as the list it should outlive.
              alignSelf: "flex-start",
              position: { md: "sticky" },
              // Clear of the fixed header, or the heading pins underneath it.
              top: { md: `calc(${HEADER_HEIGHT.sm} + 16px)` },
            }}
          >
            <Typography
              variant="body1"
              component="div"
              color="text.primary"
              sx={{
                fontFamily: "'Ubuntu', sans-serif",
                textAlign: "left",
                mb: { xs: "12px", md: 0 },
                ml: "4px",
                fontWeight: "bold",
                // Same scale as SectionHeading, so section titles are one size
                // across Home, CV and About.
                fontSize: { xs: "16px", sm: "18px", md: "20px" },
              }}
            >
              Latest Updates
            </Typography>
          </Box>

          <Box
            sx={{
              // Absorbs the leftover space instead of adding a fixed 30vh, which
              // pushed the page just past the viewport on a phone. LatestUpdates
              // centres its own loading/error/empty states via Centered, so this
              // wrapper doesn't need alignItems/justifyContent itself -- doing
              // both would also centre the populated card list, which should
              // stay left-aligned and full width.
              flex: 1,
              // Without this a long unbroken title in a card can push the
              // column wider than its share of the row.
              minWidth: 0,
              minHeight: { xs: "20vh", sm: "30vh" },
              display: "flex",
              flexDirection: "column",
            }}
          >
            <LatestUpdates limit={5} />
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

export default Home;