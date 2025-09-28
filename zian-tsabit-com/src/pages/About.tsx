import {
  Box,
  Typography,
  Stack
} from "@mui/material";


function About() {

  return (
    <Box
      sx={{
        width: "75vh",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        bgcolor: "black"
      }}>

      <Stack
        direction="row"
        spacing={2}
        sx={{ 
          width: "100%",
          display: "flex", 
          flexDirection: "row",
          alignItems: "center"
        }}  >
        <Stack 
          sx={{ 
            display: "flex", 
            flexDirection: "column",
            bgcolor: "grey.900",
            padding: "12px",
            borderRadius: "8px",
            minHeight: "100%",
            width: "100%",
            textAlign: "justify",
            border: "1px solid white"
          }}>
          <Typography 
            variant="h5" 
            component="div" 
            sx={{ 
              fontFamily: "'Ubuntu', sans-serif",
              fontWeight: "700",
              color: "white",
              textAlign: "left",
              fontSize: "24px"
            }}>
              About Me
          </Typography>
          <Typography
            variant="body1"
            component="div"
            sx={{
              fontSize: "18px",
              color: "white",
              lineHeight: "2",
              letterSpacing: "1px",
              textAlign: "justify"
            }}>
              Hi, I’m Ghazian Tsabit Alkamil, living in Jakarta, Indonesia.
              I work as a Software Engineer on the Data Platform team at Cermati Fintech Group.
              I studied Computer Science at the School of Electrical Engineering and Informatics, Bandung Institute of Technology.
              I have a strong passion for data, software, and infrastructure engineering, and I enjoy exploring how these areas connect and support each other. <br />
              Outside of work, I love spending time with books—especially Indonesian novels, with Eka Kurniawan as my favorite author—watching movies, and swimming, which I usually do about four times a week.
              Music is also a big part of my life, and I’m a huge fan of The Beatles and Bob Dylan.
              I enjoy learning new things, and recently I’ve started learning to play the guitar, inspired by the anime <em>Bocchi the Rock!</em> 
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

export default About;