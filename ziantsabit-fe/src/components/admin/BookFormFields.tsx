import type { ReactNode } from "react";
import { Autocomplete, Stack, TextField } from "@mui/material";

import CoverImageField from "./CoverImageField";
import MarkdownEditor from "./MarkdownEditor";
import type { FieldErrors } from "../../services/api";
import type { BookDraft } from "../../services/adminBooks";

interface Props {
  draft: BookDraft;
  fieldErrors: FieldErrors;
  onChange: <K extends keyof BookDraft>(key: K, value: BookDraft[K]) => void;
  /** Differs by caller: an entry already published breaks a link if its slug
   *  moves; one that has not been created yet has nothing to break. */
  slugHelperText: string;
  /** Passed straight to the review editor, which shows it while full screen --
   *  the one place the caller's own copy of it is behind the overlay. */
  fullscreenStatus?: ReactNode;
  /** The genres already in use, offered as suggestions. Free text either way:
   *  this only keeps a second spelling of an existing genre from being typed
   *  by accident. */
  genreOptions: string[];
}

/**
 * The book form's fields, with no opinion on where they are mounted -- the new
 * and edit pages render the same inputs, so this is what they share instead of
 * two copies drifting apart. `PostFormFields` is the same idea for posts.
 *
 * There is no Status field here, for the same reason there is none there:
 * status is chosen by which button ends the form, so a dropdown would be a
 * second control for the same thing and the two could disagree.
 */
function BookFormFields({
  draft,
  fieldErrors,
  onChange,
  slugHelperText,
  fullscreenStatus,
  genreOptions,
}: Props) {
  return (
    <Stack sx={{ gap: 2 }}>
      <TextField
        label="Title"
        value={draft.title}
        onChange={(event) => onChange("title", event.target.value)}
        error={Boolean(fieldErrors.title)}
        helperText={fieldErrors.title}
        required
        autoFocus
        fullWidth
      />

      <TextField
        label="Author"
        value={draft.author}
        onChange={(event) => onChange("author", event.target.value)}
        error={Boolean(fieldErrors.author)}
        helperText={
          fieldErrors.author ??
          "As it reads on the cover. Several authors go in as one line."
        }
        required
        fullWidth
      />

      <TextField
        label="Slug"
        value={draft.slug}
        onChange={(event) => onChange("slug", event.target.value)}
        error={Boolean(fieldErrors.slug)}
        helperText={fieldErrors.slug ?? slugHelperText}
        fullWidth
      />

      <CoverImageField
        url={draft.cover_image_url}
        alt={draft.cover_image_alt}
        fieldErrors={fieldErrors}
        onChange={(next) => {
          if (next.url !== undefined) onChange("cover_image_url", next.url);
          if (next.alt !== undefined) onChange("cover_image_alt", next.alt);
        }}
      />

      <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2 }}>
        <TextField
          label="Release year"
          // `type="number"` rather than a date picker: what a catalogue records
          // is the year off the copyright page, and a picker would demand a day
          // and a month that no book prints. `inputMode` gets a phone keyboard
          // with digits on it.
          type="number"
          value={draft.release_year}
          onChange={(event) => onChange("release_year", event.target.value)}
          error={Boolean(fieldErrors.release_year)}
          helperText={fieldErrors.release_year ?? "Leave blank if the edition has none."}
          slotProps={{ htmlInput: { inputMode: "numeric" } }}
          sx={{ flex: 1 }}
        />

        <TextField
          label="ISBN"
          value={draft.isbn}
          onChange={(event) => onChange("isbn", event.target.value)}
          error={Boolean(fieldErrors.isbn)}
          helperText={
            fieldErrors.isbn ?? "10 or 13 digits. Hyphens are fine — they are stripped."
          }
          sx={{ flex: 1 }}
        />
      </Stack>

      {/* freeSolo, because genres are typed rather than chosen -- there is no
          canonical list on the backend either, just an array of strings per
          book. The options are the genres already in the catalogue, so the
          common case is picking one rather than re-typing it slightly
          differently. `autoSelect` commits whatever is in the box when it
          loses focus, so a genre typed but not confirmed with Enter is not
          silently dropped on the way to Save. */}
      <Autocomplete
        multiple
        freeSolo
        autoSelect
        options={genreOptions}
        value={draft.genres}
        onChange={(_event, next) =>
          // The API trims and dedupes too; this only keeps an empty chip from
          // being created by an Enter on a blank box.
          onChange("genres", next.map((genre) => genre.trim()).filter(Boolean))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Genres"
            error={Boolean(fieldErrors.genres)}
            helperText={
              fieldErrors.genres ??
              "Press Enter after each. Pick an existing one where it fits."
            }
          />
        )}
      />

      <MarkdownEditor
        value={draft.review}
        onChange={(review) => onChange("review", review)}
        error={Boolean(fieldErrors.review)}
        helperText={
          fieldErrors.review ??
          "Markdown, and optional — an entry with no notes is still a catalogue entry. " +
            "Tab indents — press Esc first if you want Tab to leave the field."
        }
        minRows={10}
        fullscreenStatus={fullscreenStatus}
      />
    </Stack>
  );
}

export default BookFormFields;
