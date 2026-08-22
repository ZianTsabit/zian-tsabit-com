import { Alert, Box, Button, CircularProgress, Container, Divider, Stack, Typography } from "@mui/material";

import Centered from "../components/Centered";
import Markdown from "../components/Markdown";
import SectionHeading from "../components/SectionHeading";
import TimelineItem from "../components/TimelineItem";
import { TagChipRow } from "../components/TagChip";
import type { CvContent, PageEntry } from "../services/pages";
import { usePageContent } from "../services/usePageContent";

const socialLinkStyle = {
  color: "primary.main",
  textDecoration: "underline",
  fontSize: { xs: "14px", sm: "16px" },
  display: "flex",
  alignItems: "center",
  gap: "4px",
};

/**
 * One timeline section, rendered only when it has entries.
 *
 * An empty section used to be impossible -- the content was a hardcoded array
 * -- but a heading with nothing under it is what an owner who has not filled in
 * Projects yet would otherwise get.
 */
function TimelineSection({
  heading,
  entries,
}: {
  heading: string;
  entries: PageEntry[];
}) {
  if (entries.length === 0) return null;
  return (
    <Box sx={{ mb: 4 }}>
      <SectionHeading>{heading}</SectionHeading>
      {entries.map((entry, index) => (
        <TimelineItem
          key={`${entry.title}-${entry.subtitle}-${index}`}
          title={entry.title}
          subtitle={entry.subtitle || undefined}
          subtitleLink={entry.subtitle_link || undefined}
          location={entry.location || undefined}
          duration={entry.duration}
          // Markdown, inline: a blurb and a bullet are lines inside a layout
          // TimelineItem has already styled, and a `<p>` with its own margins
          // would push the rail out of step with the text beside it.
          blurb={entry.blurb ? <Markdown inline>{entry.blurb}</Markdown> : undefined}
          points={entry.points.map((point, position) => (
            <Markdown inline key={position}>
              {point}
            </Markdown>
          ))}
          last={index === entries.length - 1}
        />
      ))}
    </Box>
  );
}

function CvBody({ cv }: { cv: CvContent }) {
  return (
    <>
      {/* Header */}
      <Stack
        direction="column"
        sx={{
          justifyContent: "center",
          alignItems: "center",
          mb: "18px",
          mt: "18px",
          textAlign: "center",
        }}
      >
        <Typography
          gutterBottom
          component="div"
          sx={{
            mt: "24px",
            fontWeight: "bold",
            fontSize: { xs: "22px", sm: "28px" },
            color: "text.primary",
          }}
        >
          {cv.name}
        </Typography>

        <Typography
          component="div"
          sx={{
            color: "text.secondary",
            fontSize: { xs: "13px", sm: "15px" },
            mb: 1,
          }}
        >
          {cv.location}
        </Typography>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 1, sm: 2 }}
          sx={{
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
            mt: 1,
          }}
        >
          {cv.links.map((link) => {
            // Only http(s) opens in a new tab; `mailto:` handing off to a mail
            // client has no tab to open, and `noopener` on it means nothing.
            const external = /^https?:\/\//.test(link.url);
            return (
              <Box
                key={link.url}
                component="a"
                href={link.url}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                sx={socialLinkStyle}
              >
                {link.icon_url && (
                  <Box
                    component="img"
                    src={link.icon_url}
                    // Decorative: the label beside it already says where this
                    // goes, so a screen reader repeating "GitHub GitHub" would
                    // be the only effect of naming it.
                    alt=""
                    sx={{ width: "20px", height: "20px" }}
                  />
                )}
                {link.label}
              </Box>
            );
          })}
        </Stack>
      </Stack>

      <Divider sx={{ bgcolor: "divider", my: 2 }} />

      {cv.summary.body && (
        <Box sx={{ mb: 4 }}>
          <SectionHeading>{cv.summary.heading}</SectionHeading>
          {/* The summary's own type scale, which is a step smaller than a post
              body's -- overridden here rather than in `Markdown`, whose sizes
              are the ones a post is read at. */}
          <Box
            sx={{
              "& p": {
                textAlign: { xs: "left", sm: "justify" },
                color: "text.primary",
                fontSize: { xs: "12px", sm: "14px", md: "16px" },
                lineHeight: 1.7,
              },
            }}
          >
            <Markdown>{cv.summary.body}</Markdown>
          </Box>
        </Box>
      )}

      <TimelineSection
        heading={cv.experience.heading}
        entries={cv.experience.entries}
      />
      <TimelineSection heading={cv.projects.heading} entries={cv.projects.entries} />

      {cv.skills.groups.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <SectionHeading>{cv.skills.heading}</SectionHeading>
          <Stack direction="column" spacing={2}>
            {cv.skills.groups.map((group) => (
              <Box key={group.label}>
                <Typography
                  component="div"
                  sx={{
                    fontWeight: 700,
                    color: "text.secondary",
                    fontSize: { xs: "12px", sm: "13px", md: "14px" },
                    mb: 1,
                  }}
                >
                  {group.label}
                </Typography>
                <TagChipRow labels={group.items} />
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      <TimelineSection
        heading={cv.education.heading}
        entries={cv.education.entries}
      />
    </>
  );
}

/**
 * The CV, rendered from `/api/pages/cv/`.
 *
 * **The content used to be five arrays declared above this component**, which
 * meant keeping a CV current was a code edit and a redeploy. It lives in
 * `PageContent` now and is edited at `/admin/cv`; `myapp/migrations/0014`
 * carries what was here across, so nothing was lost in the move.
 *
 * The one thing that changed shape: a bullet's inline link was a JSX
 * `<ExternalLink>` component and is now Markdown, rendered inline by
 * `Markdown`. That is why `ExternalLink` no longer exists here -- there is
 * nowhere left to write JSX into a bullet.
 */
function CV() {
  const { data, phase, error, retry } = usePageContent("cv");

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
      {/* A flex column, so `Centered` has leftover space to centre the spinner
          and the error state in rather than pinning them to the top. */}
      <Container
        maxWidth="md"
        sx={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        {phase === "loading" && (
          <Centered>
            <CircularProgress aria-label="Loading CV" />
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

        {phase === "ready" && data && <CvBody cv={data} />}
      </Container>
    </Box>
  );
}

export default CV;
