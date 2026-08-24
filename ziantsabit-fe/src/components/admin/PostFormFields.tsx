import type { ReactNode } from "react";
import {
  Autocomplete,
  FormControlLabel,
  FormHelperText,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import CoverImageField from "./CoverImageField";
import MarkdownEditor from "./MarkdownEditor";
import type { FieldErrors } from "../../services/api";
import { POST_THEMES, type PostDraft } from "../../services/adminPosts";

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
  /** Off when creating. A new post has no date to correct: "Publish" stamps
   *  `published_at` server-side in `Post.save()`, and "Save as draft" leaves it
   *  null on purpose. Editing is where backdating an entry is worth a field. */
  showPublishedAt?: boolean;
  /** Passed straight to the body editor, which shows it while full screen --
   *  the one place the caller's own copy of it is behind the overlay. */
  fullscreenStatus?: ReactNode;
  /** The tags already in use, offered as suggestions. Free text either way:
   *  this only keeps a second spelling of an existing tag from being typed by
   *  accident, now that tags are what the site browses by. */
  tagOptions: string[];
}

/**
 * The post form's fields, with no opinion on where they're mounted -- a
 * `Dialog` (editing an existing post) and a full page (creating a new one)
 * both render the same inputs, so this is what they share instead of two
 * copies drifting apart.
 */
function PostFormFields({
  draft,
  fieldErrors,
  onChange,
  slugHelperText,
  showPublishedAt = true,
  fullscreenStatus,
  tagOptions,
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
        helperText={fieldErrors.excerpt ?? "The summary shown on the feed."}
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
            "Size an image with a title: ![alt](url \"=400\"), or \"=400x300\", or \"=50%\". " +
            "LaTeX with $x^2$ inline and $$…$$ as a block — write \\$ for a literal dollar sign. " +
            "Stands in for the excerpt if it is blank."
        }
        // Both callers are full pages now, so the body gets room to write in
        // rather than the 5 rows that suited a dialog.
        minRows={12}
        fullscreenStatus={fullscreenStatus}
      />

      {/* Tagging and publishing come after the writing: the fields above are
          what the post *is*, these are what happens to it.

          There is no Status field here. Status is chosen by which button ends
          the form -- "Save as draft" or "Publish" -- so a dropdown would be a
          second control for the same thing, and the two could disagree. The
          admin list still flips it per row without opening the editor.

          There is no Categories field either, any more: the enum it edited was
          dropped in the backend's `0009`, and the tags box below now does that
          job as well as its own.

          freeSolo, because tags are typed rather than chosen: there is no
          canonical list of them on the backend either, just an array of
          strings per post. The options are the tags already in use, so the
          common case is picking one rather than re-typing it slightly
          differently -- which matters more now that a tag is how the feed is
          browsed, and two spellings are two entries in the filter. Same
          arrangement as the book form's genres.

          `autoSelect` commits whatever is in the box when it loses focus, so a
          tag typed but not confirmed with Enter is not silently dropped on the
          way to Save. */}
      <Autocomplete
        multiple
        freeSolo
        autoSelect
        options={tagOptions}
        value={draft.tags}
        onChange={(_event, next) =>
          // The API trims and dedupes too; this only keeps an empty chip from
          // being created by an Enter on a blank box.
          onChange("tags", next.map((tag) => tag.trim()).filter(Boolean))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Tags"
            error={Boolean(fieldErrors.tags)}
            helperText={
              fieldErrors.tags ??
              "Press Enter after each. Tags are how the blog is browsed — " +
                "pick an existing one where it fits. 50 characters max."
            }
          />
        )}
      />

      {/* What visitors may leave, per post rather than site-wide: a piece on
          something contentious can have its thread closed without turning
          comments off everywhere, and a short note nobody is meant to argue
          with can go up with neither.

          Switches rather than checkboxes because each is a thing that is on or
          off right now, not a choice being submitted -- and both default on, so
          saying no is the deliberate act. Grouped under a heading because they
          are one subject; a stray "Comments" toggle between Tags and Published
          at would read as another field of the post rather than a setting for
          it. */}
      <Stack sx={{ gap: 0.5 }}>
        <Typography
          component="h2"
          sx={{ fontSize: "13px", fontWeight: 600, color: "text.secondary" }}
        >
          What visitors can leave
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={draft.comments_enabled}
              onChange={(event) =>
                onChange("comments_enabled", event.target.checked)
              }
            />
          }
          label="Comments"
        />
        {/* Says what closing does *not* do, which is the half nobody expects:
            the thread stays readable and only the form goes away. */}
        <FormHelperText sx={{ mt: -0.5, ml: 1.75 }}>
          {fieldErrors.comments_enabled ??
            "Off closes the thread. Comments already left stay readable — hide those one by one under Comments."}
        </FormHelperText>

        <FormControlLabel
          control={
            <Switch
              checked={draft.reactions_enabled}
              onChange={(event) =>
                onChange("reactions_enabled", event.target.checked)
              }
            />
          }
          label="Reactions"
          sx={{ mt: 1 }}
        />
        <FormHelperText sx={{ mt: -0.5, ml: 1.75 }}>
          {fieldErrors.reactions_enabled ??
            "Off hides the emoji bar. Reactions already left are kept, and come back if you turn it on again."}
        </FormHelperText>
      </Stack>

      {/* The scheme the post is *read* in, which is why it sits here rather
          than beside the cover image: like the two switches above it, it is a
          setting for the post rather than a piece of its content.

          A select rather than three radios or a row of swatches -- it has four
          options, one of them the default, which is exactly the shape a select
          is for. The default reads "Reader's choice" rather than "None",
          because leaving it alone is a decision about the reader and "None"
          would suggest the post simply has no look. */}
      <TextField
        select
        label="Theme"
        value={draft.theme}
        onChange={(event) =>
          onChange("theme", event.target.value as PostDraft["theme"])
        }
        error={Boolean(fieldErrors.theme)}
        // Says what it overrides *and* that it can be escaped: the header's
        // picker keeps working while the post is open, which matters to
        // anybody who needs a particular scheme to read at all.
        helperText={
          fieldErrors.theme ??
          "Switches the whole site to this scheme while the post is open, whatever the reader picked. Their theme comes back when they leave, and the header's picker still overrides it."
        }
        fullWidth
      >
        {POST_THEMES.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      {showPublishedAt && (
        <TextField
          label="Published at"
          type="datetime-local"
          value={toLocalInput(draft.published_at)}
          onChange={(event) =>
            onChange("published_at", fromLocalInput(event.target.value))
          }
          error={Boolean(fieldErrors.published_at)}
          helperText={
            fieldErrors.published_at ??
            "Sets the position in the feed. Left empty, publishing stamps it now."
          }
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
        />
      )}
    </Stack>
  );
}

export default PostFormFields;
