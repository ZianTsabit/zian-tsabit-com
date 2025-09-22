import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { Link } from "react-router-dom";

function Home() {
  return (
    <Box
      sx={{
        width: "75vh",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        bgcolor: "#0000",
        alignItems: 'center',
        marginTop: '36px'
      }}
    >
      <Container maxWidth="md">
        
        <Stack
          direction="row"
          sx={{ 
            justifyContent: "center", 
            alignItems: "center",
            gap: 2,
            marginBottom: "18px",
            marginTop: "18px"
          }}
        >
          <Avatar
            alt="Zian Tsabit"
            src="/pp-github.png"
            sx={{ 
                width: 120, 
                height: 120,
                marginRight: "8px",
                marginLeft: "8px"
            }}
          />
          <Stack
            direction="column"
            sx={{ 
              justifyContent: "left", 
              alignItems: "center", 
              gap: 1
            }}
          >
            <Typography 
              variant="h5" 
              component="div" 
              color="white" 
              sx={{ 
                fontFamily: "'Ubuntu', sans-serif"
              }}>
                Hello, I'm Ghazian Tsabit Alkamil 👋
            </Typography>
            <Typography 
              variant="body1" 
              component="div" 
              color="white"
              sx={{ 
                fontFamily: "'Ubuntu', sans-serif",
                justifyContent: "left",
                alignItems: "center",
                textAlign: "justify",
                marginLeft: "4px",
                marginRight: "4px",
              }}>
              I'm a Software Engineer based in Indonesia, currently working at <a href="https://cermati.group/" target="_blank" rel="noopener noreferrer" style={{ color: "#005b96", textDecoration: "underline" }}>Cermati Fintech Group</a> as a Software Engineer - Data Platform.
              Here i want to put myself on the internet, share my projects, and write about things that I find interesting.
            </Typography>
            <Stack
              direction="row"
              sx={{ 
                justifyContent: "center", 
                alignItems: "center", 
                gap: 1
              }}
              >
                <Link
                to="https://www.linkedin.com/in/ghaziantsabitalkamil/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "white",
                  textDecoration: "none",
                  fontFamily: "'Ubuntu', sans-serif",
                  fontSize: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                <img
                  src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linkedin/linkedin-original.svg"
                  alt="LinkedIn"
                  style={{ width: "20px", height: "20px" }}
                />
                linkedIn
                </Link>
              <Typography
                variant="body1"
                component="div"
                color="white"
                sx={{ fontFamily: "'Ubuntu', sans-serif" }}>
                |
              </Typography>
                <Link
                  to="https://github.com/ZianTsabit"
                  style={{
                  color: "white",
                  textDecoration: "none",
                  fontFamily: "'Ubuntu', sans-serif",
                  fontSize: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                  }}>
                    <img
                      src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg"
                      alt="GitHub"
                      style={{ width: "20px", height: "20px" }}
                    />
                    github
                  </Link>
              <Typography
                variant="body1"
                component="div"
                color="white"
                sx={{ fontFamily: "'Ubuntu', sans-serif" }}>
                |
              </Typography>
                <Link
                  to="mailto:tsabitghazian@gmail.com"
                  style={{
                  color: "white",
                  textDecoration: "none",
                  fontFamily: "'Ubuntu', sans-serif",
                  fontSize: "16px",
                  }}>
                  ✉️ email
                </Link>
            </Stack>
          </Stack>
        </Stack>
        
        <Divider sx={{ 
          bgcolor: "grey",
          marginLeft: "18px"
          }} />
        
      </Container>
    </Box>
  );
}

export default Home