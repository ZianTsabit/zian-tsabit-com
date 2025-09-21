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
      <Container maxWidth="xl">
        <Stack
          direction="row"
          sx={{ 
            justifyContent: "left", 
            alignItems: "center", 
            gap: 32, 
            py: 2 
          }}
        >
          <Avatar
            alt="Zian Tsabit"
            src="/pp-github.png"
            sx={{ 
                width: 120, 
                height: 120,
                marginLeft: "40px"
            }}
          />
          <Typography 
            variant="h5" 
            component="div" 
            color="white" 
            sx={{ 
              fontFamily: "'Ubuntu', sans-serif" 
            }}>
            Hello, I'm Ghazian Tsabit Alkamil 👋
          </Typography>
        </Stack>
        <Divider sx={{ 
          bgcolor: "white",
          marginLeft: "18px"
          }} />
      </Container>
    </Box>
  );
}

export default Home