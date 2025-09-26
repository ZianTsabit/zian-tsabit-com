import {
  Box,
  Typography,
  Stack,
  Avatar,
  Divider
} from "@mui/material";


function About() {

  return (
    <Box
      sx={{
        width: "100vh",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#0000",
        padding: "18px",
        marginTop: "36px",
    }}>

      <Stack
        direction="row"
        spacing={2}
        sx={{ 
          marginBottom: "36px",
          width: "100%",
          display: "flex", 
          flexDirection: "row",
          alignItems: "center"
        }}  >

        <Stack 
          sx={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center",
            bgcolor: "black",
            padding: "12px",
            borderRadius: "8px",
            height: "100%",
            width: "25%"
          }}>
          
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
          
          <Divider 
            sx={{ 
              bgcolor: "white", 
              marginTop: "8px", 
              marginBottom: "8px", 
              width: "100%"
            }} 
          />
          
          <Typography
            variant="body1"
            component="div"
            color="white"
            sx={{ fontFamily: "'Ubuntu', sans-serif" }}
          >
            Ghazian Tsabit Alkamil
          </Typography>
        
        </Stack>

        <Stack 
          sx={{ 
            display: "flex", 
            flexDirection: "column",
            bgcolor: "grey",
            padding: "12px",
            borderRadius: "8px",
            minHeight: "100vh",
            width: "75%",
            textAlign: "justify",
          }}>
          <Typography 
            variant="body1"
            component="div"
            sx={{
              fontFamily: "'Ubuntu', sans-serif",
            }}>
            My name is 
          </Typography>
        </Stack>

      </Stack>
    </Box>
  );
}

export default About;