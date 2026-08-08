import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import { ApiError, type FieldErrors } from "../../services/api";
import {
  CATEGORIES,
  STATUSES,
  createPost,
  draftFrom,
  emptyDraft,
  updatePost,
  type PostDraft,
} from "../../services/adminPosts";
import type { Post, PostCategory } from "../../services/posts";

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
  open: boolean;
  /** The post being edited, or null to create a new one. */
  post: Post | null;
  /** Pre-selected category for a new post, so a filtered list creates in place. */
  defaultCategory?: PostCategory;
  onClose: () => void;
  onSaved: () => void;
}

function PostEditor({ open, post, defaultCategory, onClose, onSaved }: Props) {
  const theme = useTheme();
  // A dialog on a phone is better off owning the screen than floating in it.
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [draft, setDraft] = useState<PostDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Reset on open rather than on mount: the dialog is kept around between edits,
  // so without this the second post opened would show the first one's values.
  useEffect(() => {
    if (!open) return;
    setDraft(post ? draftFrom(post) : emptyDraft(defaultCategory));
    setSaving(false);
    setError(null);
    setFieldErrors({});
  }, [open, post, defaultCategory]);

  const set = <K extends keyof PostDraft>(key: K, value: PostDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      if (post) {
        await updatePost(post.slug, draft);
      } else {
        await createPost(draft);
      }
      onSaved();
    } catch (failure: unknown) {
      if (failure instanceof ApiError) {
        setError(failure.message);
        setFieldErrors(failure.fieldErrors);
      } else {
        setError(failure instanceof Error ? failure.message : "Could not save.");
      }
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>{post ? "Edit post" : "New post"}</DialogTitle>

        <DialogContent dividers>
          <Stack sx={{ gap: 2, pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Title"
              value={draft.title}
              onChange={(event) => set("title", event.target.value)}
              error={Boolean(fieldErrors.title)}
              helperText={fieldErrors.title}
              required
              autoFocus
              fullWidth
            />

            <TextField
              label="Slug"
              value={draft.slug}
              onChange={(event) => set("slug", event.target.value)}
              error={Boolean(fieldErrors.slug)}
              helperText={
                fieldErrors.slug ??
                (post
                  ? "The post's URL. Changing it breaks any existing link."
                  : "Leave blank to generate it from the title.")
              }
              fullWidth
            />

            <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2 }}>
              <TextField
                select
                label="Category"
                value={draft.category}
                onChange={(event) =>
                  set("category", event.target.value as PostCategory)
                }
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
                select
                label="Status"
                value={draft.status}
                onChange={(event) =>
                  set("status", event.target.value as PostDraft["status"])
                }
                error={Boolean(fieldErrors.status)}
                helperText={fieldErrors.status}
                fullWidth
              >
                {STATUSES.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <TextField
              label="Published at"
              type="datetime-local"
              value={toLocalInput(draft.published_at)}
              onChange={(event) =>
                set("published_at", fromLocalInput(event.target.value))
              }
              error={Boolean(fieldErrors.published_at)}
              helperText={
                fieldErrors.published_at ??
                "Sets the position in the feed. Left empty, publishing stamps it now."
              }
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />

            <TextField
              label="Excerpt"
              value={draft.excerpt}
              onChange={(event) => set("excerpt", event.target.value)}
              error={Boolean(fieldErrors.excerpt)}
              helperText={
                fieldErrors.excerpt ?? "The summary shown on the section page."
              }
              multiline
              minRows={2}
              fullWidth
            />

            <TextField
              label="Body"
              value={draft.body}
              onChange={(event) => set("body", event.target.value)}
              error={Boolean(fieldErrors.body)}
              helperText={fieldErrors.body ?? "Stands in for the excerpt if it is blank."}
              multiline
              minRows={5}
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={saving} color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default PostEditor;
