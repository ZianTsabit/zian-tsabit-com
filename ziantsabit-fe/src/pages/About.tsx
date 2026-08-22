import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";

import Centered from "../components/Centered";
import FlipPhoto from "../components/FlipPhoto";
import Markdown from "../components/Markdown";
import SectionHeading from "../components/SectionHeading";
import type { AboutContent } from "../services/pages";
import { usePageContent } from "../services/usePageContent";

/** The page's own type scale, a shade larger and looser than a post body's.
 *  Applied to the paragraphs `Markdown` renders rather than to a `Typography`,
 *  since the prose is Markdown now and comes back as its own elements. */
const bodyStyle = {
  "& p": {
    fontSize: { xs: "14px", sm: "16px", md: "17px" },
    color: "text.primary",
    lineHeight: 1.8,
    letterSpacing: "0.3px",
    textAlign: { xs: "left", sm: "justify" },
  },
};

const PHOTO_SIZE = { xs: 140, sm: 170 };

function AboutBody({ about }: { about: AboutContent }) {
  return (
    <>
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
        {about.photo_front &&
          // With no second image there is nothing on the other side, so it
          // renders as a plain portrait rather than a card that flips to a
          // broken image.
          (about.photo_back ? (
            <FlipPhoto
              alt={about.photo_alt}
              frontSrc={about.photo_front}
              backSrc={about.photo_back}
              size={PHOTO_SIZE}
            />
          ) : (
            <Box
              component="img"
              src={about.photo_front}
              alt={about.photo_alt}
              sx={{
                width: PHOTO_SIZE,
                height: PHOTO_SIZE,
                flexShrink: 0,
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid",
                borderColor: "divider",
              }}
            />
          ))}
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
              fontWeight: 700,
              fontSize: { xs: "22px", sm: "28px" },
              color: "text.primary",
              m: 0,
            }}
          >
            {about.name}
          </Typography>
          <Typography
            component="div"
            sx={{
              fontSize: { xs: "14px", sm: "16px" },
              color: "text.primary",
            }}
          >
            {about.headline}
          </Typography>
          <Typography
            component="div"
            sx={{
              fontSize: { xs: "12px", sm: "14px" },
              color: "text.secondary",
            }}
          >
            {about.location}
          </Typography>
        </Stack>
      </Stack>

      {about.sections.map((section, index) => (
        <Box key={`${section.heading}-${index}`} sx={{ mb: 4 }}>
          {section.heading && <SectionHeading>{section.heading}</SectionHeading>}
          <Box sx={bodyStyle}>
            <Markdown>{section.body}</Markdown>
          </Box>
        </Box>
      ))}
    </>
  );
}

/**
 * The About page, rendered from `/api/pages/about/`.
 *
 * Its prose was JSX with `<Box component="a">` links written into it; it is
 * Markdown in `PageContent` now, edited at `/admin/about`, and carried across
 * by `myapp/migrations/0014`.
 *
 * **The sections are a list, not two fixed slots.** They are all the same shape
 * -- a heading and some prose -- so a third one is an entry in the editor rather
 * than a change here. That is the opposite of the CV, whose five sections each
 * render differently and so have to be named in code.
 */
function About() {
  const { data, phase, error, retry } = usePageContent("about");

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
        {phase === "loading" && (
          <Centered>
            <CircularProgress aria-label="Loading About" />
          </Centered>
        )}

        {phase === "error" && (
          <Centered>
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={retry}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          </Centered>
        )}

        {phase === "ready" && data && <AboutBody about={data} />}
      </Container>
    </Box>
  );
}

export default About;
