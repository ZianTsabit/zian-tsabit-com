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
              Hi, I’m Ghazian Tsabit Alkamil, living in Jakarta, Indonesia.<br />
              I work as a Software Engineer on the Data Platform team at Cermati Fintech Group.<br />
              I studied Computer Science at the School of Electrical Engineering and Informatics, Bandung Institute of Technology.<br />
              Outside of work, I love spending time with books—especially Indonesian novels, with Eka Kurniawan as my favorite author—watching movies, and swimming, which I usually do about four times a week. <br />
              Music is also a big part of my life, and I’m a huge fan of The Beatles and Bob Dylan. <br />
              I enjoy learning new things, and recently I’ve started learning to play the guitar, inspired by the anime Bocchi the Rock!
          </Typography>
        </Stack>

      </Stack>
    </Box>
  );
}

export default About;