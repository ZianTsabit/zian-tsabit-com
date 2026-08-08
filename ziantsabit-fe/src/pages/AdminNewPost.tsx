import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

import type { AdminOutletContext } from "../components/admin/AdminOutletContext";
import PostFormFields from "../components/admin/PostFormFields";
import { ApiError, type FieldErrors } from "../services/api";
import { createPost, emptyDraft, type PostDraft } from "../services/adminPosts";
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const set = <K extends keyof PostDraft>(key: K, value: PostDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      await createPost(draft);
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
      setSaving(false);
    }
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
          />

          <Stack direction="row" sx={{ gap: 1, justifyContent: "flex-end" }}>
            <Button color="inherit" disabled={saving} onClick={() => navigate("/admin")}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Box>
  );
}

export default AdminNewPost;
