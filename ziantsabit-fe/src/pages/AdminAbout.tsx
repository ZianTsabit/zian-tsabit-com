import { Divider, Stack, TextField, Typography } from "@mui/material";

import PageEditorShell from "../components/admin/pages/PageEditorShell";
import RepeatableList from "../components/admin/pages/RepeatableList";
import type { AboutContent, AboutSection } from "../services/pages";
import { useAdminPage } from "../services/useAdminPage";

function SectionLabel({ children }: { children: string }) {
  return (
    <Typography
      component="h2"
      sx={{ fontWeight: 700, fontSize: "17px", color: "text.primary" }}
    >
      {children}
    </Typography>
  );
}

/**
 * The About page's content, at `/admin/about`.
 *
 * **Its sections are a free list**, where the CV's are fixed: every section
 * here is the same shape -- a heading and some prose -- and a third one ("📚
 * What I'm reading") is a reasonable thing to want without a deploy. The CV's
 * five sections each render differently on the public page, which is why they
 * cannot be a list.
 *
 * The photos are URL fields rather than an upload control. `/api/uploads/`
 * exists and `CoverImageField` wraps it, but both photos here are files in the
 * SPA's `public/` directory (`/pp-github.png`), served by the same host as the
 * page — so the field has to accept a plain path as well as a bucket URL, and
 * the upload button would be one more way to do a thing that is already done.
 */
function AdminAbout() {
  const { draft, phase, loadError, retry, update, save, saving, saveError, autosave } =
    useAdminPage("about");

  const about = draft as AboutContent | null;

  const set = <K extends keyof AboutContent>(key: K, value: AboutContent[K]) =>
    update((current) => ({ ...current, [key]: value }));

  return (
    <PageEditorShell
      title="Edit About"
      viewPath="/about"
      phase={phase}
      loadError={loadError}
      onRetry={retry}
      saveError={saveError}
      autosave={autosave}
      saving={saving}
      onSave={() => void save()}
    >
      {about && (
        <Stack sx={{ gap: 4 }}>
          <Stack sx={{ gap: 2 }}>
            <SectionLabel>Identity</SectionLabel>
            <TextField
              value={about.name}
              onChange={(event) => set("name", event.target.value)}
              label="Name"
              size="small"
              fullWidth
              helperText="The page's heading."
            />
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2 }}>
              <TextField
                value={about.headline}
                onChange={(event) => set("headline", event.target.value)}
                label="Headline"
                size="small"
                fullWidth
                helperText="The line under the name, e.g. a job title."
              />
              <TextField
                value={about.location}
                onChange={(event) => set("location", event.target.value)}
                label="Location"
                size="small"
                fullWidth
              />
            </Stack>
          </Stack>

          <Divider />

          <Stack sx={{ gap: 2 }}>
            <SectionLabel>Portrait</SectionLabel>
            <TextField
              value={about.photo_front}
              onChange={(event) => set("photo_front", event.target.value)}
              label="Photo"
              size="small"
              fullWidth
              helperText="A path in the site's public folder (/pp-github.png) or a full URL."
            />
            <TextField
              value={about.photo_back}
              onChange={(event) => set("photo_back", event.target.value)}
              label="Photo on the back"
              size="small"
              fullWidth
              // The portrait is a FlipPhoto: with no second image there is
              // nothing on the other side, so it simply does not flip.
              helperText="Optional. Shown when the portrait is flipped; leave blank and it will not flip."
            />
            <TextField
              value={about.photo_alt}
              onChange={(event) => set("photo_alt", event.target.value)}
              label="Photo description"
              size="small"
              fullWidth
              helperText="Read aloud in place of the image."
            />
          </Stack>

          <Divider />

          <RepeatableList<AboutSection>
            label="Sections"
            items={about.sections}
            onChange={(sections) => set("sections", sections)}
            create={() => ({ heading: "", body: "" })}
            addLabel="Add section"
            titleOf={(section) => section.heading}
            emptyText="No sections yet."
          >
            {(section, replace) => (
              <Stack sx={{ gap: 2 }}>
                <TextField
                  value={section.heading}
                  onChange={(event) =>
                    replace({ ...section, heading: event.target.value })
                  }
                  label="Heading"
                  size="small"
                  fullWidth
                  helperText="Shown above the text. Emoji are part of it, e.g. 👋 About Me."
                />
                <TextField
                  value={section.body}
                  onChange={(event) => replace({ ...section, body: event.target.value })}
                  label="Text"
                  multiline
                  minRows={6}
                  fullWidth
                  size="small"
                  helperText="Markdown works here — [text](https://example.com) for a link, *emphasis* for italics."
                />
              </Stack>
            )}
          </RepeatableList>
        </Stack>
      )}
    </PageEditorShell>
  );
}

export default AdminAbout;
