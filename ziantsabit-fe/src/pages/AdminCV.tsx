import { Autocomplete, Divider, Stack, TextField, Typography } from "@mui/material";

import EntryFields from "../components/admin/pages/EntryFields";
import PageEditorShell from "../components/admin/pages/PageEditorShell";
import RepeatableList from "../components/admin/pages/RepeatableList";
import {
  emptyEntry,
  type CvContent,
  type PageEntry,
  type PageLink,
  type SkillGroup,
} from "../services/pages";
import { useAdminPage } from "../services/useAdminPage";

/** A headed section of the CV, whose heading is itself editable.
 *
 * The headings carry emoji ("💼 Experience") and picking those was never worth
 * a deploy, so they are content like everything else -- which is why every
 * section here starts with the same small heading field. */
function SectionHeadingField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      value={value}
      onChange={(event) => onChange(event.target.value)}
      label="Section heading"
      size="small"
      fullWidth
      helperText="Shown above the section. Emoji are part of the text."
    />
  );
}

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
 * The CV page's content, at `/admin/cv`.
 *
 * The sections here are fixed -- summary, experience, projects, skills,
 * education -- because each renders differently on the public page: three are
 * timelines, one is prose, one is rows of chips. Only their *contents* and
 * headings are editable. About's sections are a free list by contrast, since
 * they are all the same shape (a heading and some prose) and a third one is a
 * reasonable thing to want.
 */
function AdminCV() {
  const { draft, phase, loadError, retry, update, save, saving, saveError, autosave } =
    useAdminPage("cv");

  // Narrowed by the shell's `phase === "ready"` guard below, but TypeScript
  // cannot see through that, so each section reads from a local.
  const cv = draft as CvContent | null;

  const setSection = <K extends keyof CvContent>(key: K, value: CvContent[K]) =>
    update((current) => ({ ...current, [key]: value }));

  return (
    <PageEditorShell
      title="Edit CV"
      viewPath="/curriculum-vitae"
      phase={phase}
      loadError={loadError}
      onRetry={retry}
      saveError={saveError}
      autosave={autosave}
      saving={saving}
      onSave={() => void save()}
    >
      {cv && (
        <Stack sx={{ gap: 4 }}>
          {/* Header */}
          <Stack sx={{ gap: 2 }}>
            <SectionLabel>Header</SectionLabel>
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2 }}>
              <TextField
                value={cv.name}
                onChange={(event) => setSection("name", event.target.value)}
                label="Name"
                size="small"
                fullWidth
              />
              <TextField
                value={cv.location}
                onChange={(event) => setSection("location", event.target.value)}
                label="Location"
                size="small"
                fullWidth
              />
            </Stack>

            <RepeatableList<PageLink>
              label="Header links"
              items={cv.links}
              onChange={(links) => setSection("links", links)}
              create={() => ({ label: "", url: "", icon_url: "" })}
              addLabel="Add link"
              titleOf={(link) => link.label}
              emptyText="No links yet — LinkedIn, GitHub and email go here."
            >
              {(link, replace) => (
                <Stack sx={{ gap: 2 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2 }}>
                    <TextField
                      value={link.label}
                      onChange={(event) => replace({ ...link, label: event.target.value })}
                      label="Label"
                      size="small"
                      fullWidth
                    />
                    <TextField
                      value={link.url}
                      onChange={(event) => replace({ ...link, url: event.target.value })}
                      label="URL"
                      size="small"
                      fullWidth
                      placeholder="https:// or mailto:"
                    />
                  </Stack>
                  <TextField
                    value={link.icon_url}
                    onChange={(event) =>
                      replace({ ...link, icon_url: event.target.value })
                    }
                    label="Icon URL"
                    size="small"
                    fullWidth
                    helperText="Optional 20px image beside the label. Leave blank to use an emoji in the label instead."
                  />
                </Stack>
              )}
            </RepeatableList>
          </Stack>

          <Divider />

          {/* Summary */}
          <Stack sx={{ gap: 2 }}>
            <SectionLabel>Summary</SectionLabel>
            <SectionHeadingField
              value={cv.summary.heading}
              onChange={(heading) => setSection("summary", { ...cv.summary, heading })}
            />
            <TextField
              value={cv.summary.body}
              onChange={(event) =>
                setSection("summary", { ...cv.summary, body: event.target.value })
              }
              label="Summary"
              multiline
              minRows={5}
              fullWidth
              size="small"
              helperText="Markdown works here."
            />
          </Stack>

          <Divider />

          {/* The three timeline sections, all the same form. */}
          {(
            [
              { key: "experience", label: "Experience", subtitle: "Company", add: "Add job" },
              { key: "projects", label: "Projects", subtitle: "Subtitle", add: "Add project" },
              {
                key: "education",
                label: "Education & certifications",
                subtitle: "Institution",
                add: "Add entry",
              },
            ] as const
          ).map((section) => (
            <Stack key={section.key} sx={{ gap: 2 }}>
              <SectionLabel>{section.label}</SectionLabel>
              <SectionHeadingField
                value={cv[section.key].heading}
                onChange={(heading) =>
                  setSection(section.key, { ...cv[section.key], heading })
                }
              />
              <RepeatableList<PageEntry>
                label={section.label}
                items={cv[section.key].entries}
                onChange={(entries) =>
                  setSection(section.key, { ...cv[section.key], entries })
                }
                create={emptyEntry}
                addLabel={section.add}
                titleOf={(entry) => entry.title}
                emptyText="Nothing here yet."
              >
                {(entry, replace) => (
                  <EntryFields
                    entry={entry}
                    onChange={replace}
                    subtitleLabel={section.subtitle}
                    // A personal project has no office to sit in.
                    showLocation={section.key !== "projects"}
                  />
                )}
              </RepeatableList>
              <Divider sx={{ mt: 2 }} />
            </Stack>
          ))}

          {/* Skills */}
          <Stack sx={{ gap: 2 }}>
            <SectionLabel>Skills</SectionLabel>
            <SectionHeadingField
              value={cv.skills.heading}
              onChange={(heading) => setSection("skills", { ...cv.skills, heading })}
            />
            <RepeatableList<SkillGroup>
              label="Skill groups"
              items={cv.skills.groups}
              onChange={(groups) => setSection("skills", { ...cv.skills, groups })}
              create={() => ({ label: "", items: [] })}
              addLabel="Add group"
              titleOf={(group) => group.label}
              emptyText="No skill groups yet."
            >
              {(group, replace) => (
                <Stack sx={{ gap: 2 }}>
                  <TextField
                    value={group.label}
                    onChange={(event) => replace({ ...group, label: event.target.value })}
                    label="Group name"
                    size="small"
                    fullWidth
                    helperText="Required. A group with no name is dropped when the page saves."
                  />
                  {/* The same `freeSolo multiple` input the post editor uses
                      for tags, and for the same reason: these are free-text
                      labels with no vocabulary to choose from. A single
                      comma-separated text field was the alternative and it
                      fights the caret -- splitting and re-joining on every
                      keystroke rewrites the text the author is in the middle
                      of typing. */}
                  <Autocomplete
                    multiple
                    freeSolo
                    // Without it, a skill typed but not confirmed with Enter is
                    // silently dropped -- the same reason the tags box has it.
                    autoSelect
                    options={[]}
                    value={group.items}
                    onChange={(_event, next) =>
                      replace({
                        ...group,
                        items: next.map((item) => item.trim()).filter(Boolean),
                      })
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Skills"
                        size="small"
                        helperText="Type a skill and press Enter. Each becomes a chip on the page."
                      />
                    )}
                  />
                </Stack>
              )}
            </RepeatableList>
          </Stack>
        </Stack>
      )}
    </PageEditorShell>
  );
}

export default AdminCV;
