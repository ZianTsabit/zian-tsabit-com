import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

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
              I'm a Software Engineer based in Indonesia, currently working at <a href="https://cermati.group/" target="_blank" rel="noopener noreferrer" style={{ color: "#6497b1", textDecoration: "underline" }}>Cermati Fintech Group</a> as a Software Engineer - Data Platform.
              Here I want to put myself on the internet, share my projects, and write about things that I find interesting.
            </Typography>
          </Stack>
        </Stack>
        
        <Divider sx={{ 
          bgcolor: "grey",
          marginTop: "8px",
          marginBottom: "8px"
          }} />

        <Box sx={{ marginTop: "18px", marginBottom: "36px" }}>
          <Typography 
            variant="body1" 
            component="div" 
            color="white" 
            sx={{ 
              fontFamily: "'Ubuntu', sans-serif",
              textAlign: "left",
              marginBottom: "12px",
              marginLeft: "4px",
              fontWeight: "bold",
              fontSize: "18px"
            }}>
              Latest Updates
          </Typography>
          {/* create card that the data taken from backend application */}
        </Box>
      </Container>
    </Box>
  );
}

export default Home