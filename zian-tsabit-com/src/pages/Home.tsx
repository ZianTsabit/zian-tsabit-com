import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Typewriter from "../components/Typewriter";

function Home() {
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
        px: 2,
      }}
    >
      <Container maxWidth="md">
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
          <Avatar
            alt="Zian Tsabit"
            src="/pp-github.png"
            sx={{ 
              width: { xs: 100, sm: 120 },
              height: { xs: 100, sm: 120 },
              mx: { xs: "auto", sm: "8px" },
            }}
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
              color="white"
              sx={{ fontFamily: "'Ubuntu', sans-serif" }}
            >
              Hello, I'm Ghazian Tsabit Alkamil 👋
            </Typography>
            <Typography 
              variant="body1" 
              component="div" 
              color="white"
              sx={{ 
                fontFamily: "'Ubuntu', sans-serif",
                textAlign: { xs: "center", sm: "justify" },
                mx: { xs: 0, sm: "4px" },
              }}
            >
              I'm a Software Engineer based in Indonesia, currently working at{" "}
              <a
                href="https://cermati.group/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#6497b1", textDecoration: "underline" }}
              >
                Cermati Fintech Group
              </a>{" "}
              as a Software Engineer - Data Platform. Here I want to put myself on the internet, share my projects, and write about things that I find interesting.
            </Typography>
          </Stack>
        </Stack>

        {/* Divider */}
        <Divider
          sx={{
            bgcolor: "grey",
            my: "8px",
          }}
        />

        {/* Latest Updates */}
        <Box sx={{ mt: "18px", mb: "36px" }}>
          <Typography
            variant="body1"
            component="div"
            color="white"
            sx={{
              fontFamily: "'Ubuntu', sans-serif",
              textAlign: "left",
              mb: "12px",
              ml: "4px",
              fontWeight: "bold",
              fontSize: "18px",
            }}
          >
            Latest Updates
          </Typography>
        </Box>

        {/* Typewriter Section */}
        <Box
          sx={{
            width: "100%",
            minHeight: "30vh",
            display: "flex",
            flexDirection: "column",
            bgcolor: "#0000",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typewriter text="Coming soon..." />
        </Box>
      </Container>
    </Box>
  );
}

export default Home;