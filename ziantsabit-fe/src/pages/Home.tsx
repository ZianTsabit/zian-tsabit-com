import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import FlipPhoto from "../components/FlipPhoto";
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
        {/* Profile Section */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ 
            justifyContent: "center", 
            alignItems: "center",
            gap: 2,
            mb: "18px",
            mt: "18px",
            textAlign: { xs: "center", sm: "left" }
          }}
        >
          <FlipPhoto
            alt="Zian Tsabit"
            frontSrc="/pp-github.png"
            backSrc="/professional-photo.jpeg"
            size={{ xs: 100, sm: 120 }}
            sx={{ mx: { xs: "auto", sm: "8px" } }}
          />
          <Stack
            direction="column"
            sx={{ 
              justifyContent: "flex-start", 
              alignItems: { xs: "center", sm: "center" },
              gap: 1,
              px: { xs: 1, sm: 0 },
            }}
          >
            <Typography 
              variant="h5"
              component="div" 
              color="text.primary"
              sx={{ fontFamily: "'Ubuntu', sans-serif" }}
            >
              Hello, I'm Ghazian Tsabit Alkamil 👋
            </Typography>
            <Typography 
              variant="body1" 
              component="div" 
              color="text.primary"
              sx={{
                fontFamily: "'Ubuntu', sans-serif",
                // Justifying a ~35-character line opens up rivers of whitespace.
                textAlign: { xs: "left", sm: "justify" },
                mx: { xs: 0, sm: "4px" },
              }}
            >
              I'm a Software Engineer based in Indonesia, currently working at{" "}
              <Box
                component="a"
                href="https://cermati.group/"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "primary.main", textDecoration: "underline" }}
              >
                Cermati Fintech Group
              </Box>{" "}
              as a Software Engineer - Data Platform. Here I want to put myself on the internet, share my projects, and write about things that I find interesting.
            </Typography>
          </Stack>
        </Stack>

        {/* Divider */}
        <Divider
          sx={{
            bgcolor: "divider",
            my: "8px",
          }}
        />

        {/* Latest Updates */}
        <Box sx={{ mt: "18px" }}>
          <Typography
            variant="body1"
            component="div"
            color="text.primary"
            sx={{
              fontFamily: "'Ubuntu', sans-serif",
              textAlign: "left",
              mb: "12px",
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

        {/* Latest Updates feed */}
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