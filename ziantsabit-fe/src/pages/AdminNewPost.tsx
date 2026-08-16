import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

import type { AdminOutletContext } from "../components/admin/AdminOutletContext";
import PostFormFields from "../components/admin/PostFormFields";
import { ApiError, type FieldErrors } from "../services/api";
import {
  createPost,
  emptyDraft,
  type PostDraft,
  type PostStatus,
} from "../services/adminPosts";
import type { PostCategory } from "../services/posts";

/**
 * Dedicated page for creating a post, reached from the "New post" button on
 * `/admin`. Deliberately a page and not a dialog -- a title, an excerpt and a
 * body are more to write than a fixed-height card comfortably holds.
 */
function AdminNewPost() {
  const navigate = useNavigate();
  const location = useLocation();
  const { onSessionSuspect } = useOutletContext<AdminOutletContext>();

  // Set by AdminConsole's "New post" button, so a post created while looking
  // at a filtered list lands back in that same section.
  const presetCategory = (location.state as { category?: PostCategory } | null)
    ?.category;

  const [draft, setDraft] = useState<PostDraft>(() => emptyDraft(presetCategory));
  // Which button is in flight, or null. A plain boolean would not say which of
  // the two to relabel while the request runs.
  const [saving, setSaving] = useState<PostStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const set = <K extends keyof PostDraft>(key: K, value: PostDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  // Status comes from the button, not from a field: the form has no status
  // control any more, so "Save as draft" and "Publish" are the same save with
  // a different value for it.
  const save = async (status: PostStatus) => {
    setSaving(status);
    setError(null);
    setFieldErrors({});
    try {
      await createPost({ ...draft, status });
      navigate("/admin");
    } catch (failure: unknown) {
      if (failure instanceof ApiError) {
        setError(failure.message);
        setFieldErrors(failure.fieldErrors);
        // api.ts already retried a CSRF rejection, so a 403 that survives to
        // here means the session itself is gone.
        if (failure.status === 403) onSessionSuspect();
      } else {
        setError(failure instanceof Error ? failure.message : "Could not save.");
      }
      setSaving(null);
    }
  };

  // Neither button is type="submit" -- each has to name its own status -- so
  // with this many fields the browser will not submit implicitly either. This
  // is the guard for the case where it does: it saves the safer of the two (a
  // new post is a draft until its author says otherwise) and, more to the
  // point, stops a default submission from reloading the page and taking an
  // unsaved draft with it.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save("draft");
  };

  return (
    <Box sx={{ maxWidth: 640, width: "100%", mx: "auto" }}>
      <Typography
        component="h1"
        sx={{ fontWeight: "bold", fontSize: { xs: "20px", sm: "24px" }, mb: 3 }}
      >
        New post
      </Typography>

      <form onSubmit={handleSubmit}>
        <Stack sx={{ gap: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <PostFormFields
            draft={draft}
            fieldErrors={fieldErrors}
            onChange={set}
            slugHelperText="Leave blank to generate it from the title."
            showPublishedAt={false}
          />

          {/* The page has no bottom padding of its own, so without this the
              buttons sit flush against the footer's top border. */}
          <Stack
            direction="row"
            sx={{
              gap: 1,
              justifyContent: "flex-end",
              pt: 1,
              pb: { xs: 3, sm: 4 },
            }}
          >
            <Button
              color="inherit"
              disabled={saving !== null}
              onClick={() => void save("draft")}
            >
              {saving === "draft" ? "Saving..." : "Save as draft"}
            </Button>
            <Button
              variant="contained"
              disabled={saving !== null}
              onClick={() => void save("published")}
            >
              {saving === "published" ? "Publishing..." : "Publish"}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Box>
  );
}

export default AdminNewPost;
