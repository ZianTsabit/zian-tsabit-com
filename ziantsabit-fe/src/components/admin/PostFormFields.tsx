import { MenuItem, Stack, TextField } from "@mui/material";

import CoverImageField from "./CoverImageField";
import MarkdownEditor from "./MarkdownEditor";
import type { FieldErrors } from "../../services/api";
import { CATEGORIES, type PostDraft } from "../../services/adminPosts";
import type { PostCategory } from "../../services/posts";

/**
 * ISO timestamp -> the `YYYY-MM-DDTHH:mm` a `datetime-local` input wants.
 *
 * The input has no notion of a zone, so it shows the browser's local wall-clock
 * reading of the instant the API stored.
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * ...and back. A `datetime-local` value carries no offset, so `Date` reads it in
 * the browser's zone and `toISOString` hands the API the matching UTC instant.
 */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface Props {
  draft: PostDraft;
  fieldErrors: FieldErrors;
  onChange: <K extends keyof PostDraft>(key: K, value: PostDraft[K]) => void;
  /** Differs by caller: a post already live breaks a link if its slug moves;
   *  one that hasn't been created yet has nothing to break. */
  slugHelperText: string;
}

/**
 * The post form's fields, with no opinion on where they're mounted -- a
 * `Dialog` (editing an existing post) and a full page (creating a new one)
 * both render the same inputs, so this is what they share instead of two
 * copies drifting apart.
 */
function PostFormFields({ draft, fieldErrors, onChange, slugHelperText }: Props) {
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

      <TextField
        label="Excerpt"
        value={draft.excerpt}
        onChange={(event) => onChange("excerpt", event.target.value)}
        error={Boolean(fieldErrors.excerpt)}
        helperText={fieldErrors.excerpt ?? "The summary shown on the section page."}
        multiline
        minRows={2}
        fullWidth
      />

      <MarkdownEditor
        value={draft.body}
        onChange={(body) => onChange("body", body)}
        error={Boolean(fieldErrors.body)}
        helperText={
          fieldErrors.body ??
          "Markdown. Tab indents — press Esc first if you want Tab to leave the field. " +
            "Stands in for the excerpt if it is blank."
        }
        // Both callers are full pages now, so the body gets room to write in
        // rather than the 5 rows that suited a dialog.
        minRows={12}
      />

      {/* Filing and publishing come after the writing: the fields above are
          what the post *is*, these are what happens to it.

          There is no Status field here. Status is chosen by which button ends
          the form -- "Save as draft" or "Publish" -- so a dropdown would be a
          second control for the same thing, and the two could disagree. The
          admin list still flips it per row without opening the editor. */}
      <TextField
        select
        label="Category"
        value={draft.category}
        onChange={(event) => onChange("category", event.target.value as PostCategory)}
        error={Boolean(fieldErrors.category)}
        helperText={fieldErrors.category}
        fullWidth
      >
        {CATEGORIES.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label="Published at"
        type="datetime-local"
        value={toLocalInput(draft.published_at)}
        onChange={(event) => onChange("published_at", fromLocalInput(event.target.value))}
        error={Boolean(fieldErrors.published_at)}
        helperText={
          fieldErrors.published_at ??
          "Sets the position in the feed. Left empty, publishing stamps it now."
        }
        slotProps={{ inputLabel: { shrink: true } }}
        fullWidth
      />
    </Stack>
  );
}

export default PostFormFields;
