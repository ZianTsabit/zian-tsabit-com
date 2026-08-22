import { Stack, TextField } from "@mui/material";

import BulletListField from "./BulletListField";
import type { PageEntry } from "../../../services/pages";

interface Props {
  entry: PageEntry;
  onChange: (entry: PageEntry) => void;
  /** What this section calls the second line. A job has a company, a
   *  qualification has an institution, and a personal project has neither --
   *  the field is the same, so only its label changes. */
  subtitleLabel: string;
  /** Off for projects, which have no employer to link and no office to sit in. */
  showLocation?: boolean;
}

/**
 * One timeline entry's fields -- a job, a project or a qualification.
 *
 * All three render through `TimelineItem` on the public page, so all three are
 * edited by the same form here. Three near-identical copies differing only in
 * the word "Company" was the alternative, and they would have drifted the first
 * time a field was added to one of them.
 */
function EntryFields({ entry, onChange, subtitleLabel, showLocation = true }: Props) {
  const set = <K extends keyof PageEntry>(key: K, value: PageEntry[K]) =>
    onChange({ ...entry, [key]: value });

  return (
    <Stack sx={{ gap: 2 }}>
      <TextField
        value={entry.title}
        onChange={(event) => set("title", event.target.value)}
        label="Title"
        fullWidth
        size="small"
        // The API drops an entry with no title -- it is what an unused Add
        // button leaves behind -- so say that here rather than letting the
        // entry quietly disappear on the next save.
        helperText="Required. An entry with no title is dropped when the page saves."
      />

      <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2 }}>
        <TextField
          value={entry.subtitle}
          onChange={(event) => set("subtitle", event.target.value)}
          label={subtitleLabel}
          fullWidth
          size="small"
        />
        <TextField
          value={entry.duration}
          onChange={(event) => set("duration", event.target.value)}
          label="Dates"
          fullWidth
          size="small"
          // Free text, not a date pair: "Present" is half of most of these, and
          // a picker has no way to express it.
          helperText="Free text, e.g. June 2025 - Present"
        />
      </Stack>

      <TextField
        value={entry.subtitle_link}
        onChange={(event) => set("subtitle_link", event.target.value)}
        label={`${subtitleLabel} link`}
        fullWidth
        size="small"
        placeholder="https://"
        helperText={`Optional. Turns the ${subtitleLabel.toLowerCase()} into a link.`}
      />

      {showLocation && (
        <TextField
          value={entry.location}
          onChange={(event) => set("location", event.target.value)}
          label="Location"
          fullWidth
          size="small"
        />
      )}

      <TextField
        value={entry.blurb}
        onChange={(event) => set("blurb", event.target.value)}
        label="Blurb"
        multiline
        minRows={2}
        fullWidth
        size="small"
        helperText="Optional italic line under the title — what the company or project is."
      />

      <BulletListField
        label="Bullets"
        points={entry.points}
        onChange={(points) => set("points", points)}
        helperText="Markdown works here — [text](https://example.com) for a link, *emphasis* for italics."
      />
    </Stack>
  );
}

export default EntryFields;
