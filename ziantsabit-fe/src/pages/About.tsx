import { Box, Container, Stack, Typography } from "@mui/material";
import SectionHeading from "../components/SectionHeading";
import { TagChipRow } from "../components/TagChip";

const interests = [
  "Indonesian novels",
  "Eka Kurniawan",
  "Films",
  "Swimming",
  "The Beatles",
  "Bob Dylan",
  "Guitar",
];

const bodyStyle = {
  fontFamily: "'Ubuntu', sans-serif",
  fontSize: { xs: "14px", sm: "16px", md: "17px" },
  color: "text.primary",
  lineHeight: 1.8,
  letterSpacing: "0.3px",
  textAlign: { xs: "left", sm: "justify" },
};

const linkStyle = { color: "primary.main", textDecoration: "underline" };

function About() {
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
      <Container maxWidth="md">
        {/* Portrait + identity */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 2, sm: 4 }}
          sx={{
            alignItems: "center",
            mt: { xs: 2, sm: 3 },
            mb: { xs: 3, sm: 4 },
          }}
        >
          <Box
            component="img"
            src="/professional-photo.jpeg"
            alt="Ghazian Tsabit Alkamil"
            sx={{
              width: { xs: 140, sm: 170 },
              height: { xs: 140, sm: 170 },
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid",
              borderColor: "divider",
              flexShrink: 0,
            }}
          />
          <Stack
            spacing={0.5}
            sx={{
              alignItems: { xs: "center", sm: "flex-start" },
              textAlign: { xs: "center", sm: "left" },
            }}
          >
            <Typography
              component="h1"
              sx={{
                fontFamily: "'Ubuntu', sans-serif",
                fontWeight: 700,
                fontSize: { xs: "22px", sm: "28px" },
                color: "text.primary",
                m: 0,
              }}
            >
              Ghazian Tsabit Alkamil
            </Typography>
            <Typography
              component="div"
              sx={{
                fontFamily: "'Ubuntu', sans-serif",
                fontSize: { xs: "14px", sm: "16px" },
                color: "text.primary",
              }}
            >
              Software Engineer &mdash; Data Platform
            </Typography>
            <Typography
              component="div"
              sx={{
                fontFamily: "'Ubuntu', sans-serif",
                fontSize: { xs: "12px", sm: "14px" },
                color: "text.secondary",
              }}
            >
              Jakarta, Indonesia
            </Typography>
          </Stack>
        </Stack>

        {/* Bio */}
        <Box sx={{ mb: 4 }}>
          <SectionHeading>👋 About Me</SectionHeading>
          <Typography component="div" sx={bodyStyle}>
            Hi, I’m Ghazian Tsabit Alkamil, living in Jakarta, Indonesia. I work
            as a Software Engineer on the Data Platform team at{" "}
            <Box
              component="a"
              href="https://www.cermati.group/"
              target="_blank"
              rel="noopener noreferrer"
              sx={linkStyle}
            >
              Cermati Fintech Group
            </Box>
            . I studied Computer Science at the{" "}
            <Box
              component="a"
              href="https://stei.itb.ac.id/"
              target="_blank"
              rel="noopener noreferrer"
              sx={linkStyle}
            >
              School of Electrical Engineering and Informatics
            </Box>
            , Bandung Institute of Technology. I have a strong passion for data,
            software, and infrastructure engineering, and I enjoy exploring how
            these areas connect and support each other.
          </Typography>
        </Box>

        {/* Outside of work */}
        <Box sx={{ mb: 4 }}>
          <SectionHeading>🎧 Outside of Work</SectionHeading>
          <Typography component="div" sx={{ ...bodyStyle, mb: 2 }}>
            I love spending time with books—especially Indonesian novels, with
            Eka Kurniawan as my favorite author—watching movies, and swimming,
            which I usually do about four times a week. Music is also a big part
            of my life, and I’m a huge fan of The Beatles and Bob Dylan. I enjoy
            learning new things, and recently I’ve started learning to play the
            guitar, inspired by the anime <em>Bocchi the Rock!</em>
          </Typography>
          <TagChipRow labels={interests} />
        </Box>
      </Container>
    </Box>
  );
}

export default About;
