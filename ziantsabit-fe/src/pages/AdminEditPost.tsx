import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";

import type { AdminOutletContext } from "../components/admin/AdminOutletContext";
import PostFormFields from "../components/admin/PostFormFields";
import { ApiError, type FieldErrors } from "../services/api";
import {
  draftFrom,
  fetchAdminPost,
  updatePost,
  type PostDraft,
} from "../services/adminPosts";
import { isAbort, type Post } from "../services/posts";

type Phase = "loading" | "ready" | "error";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Could not load this post.";
}

/**
 * Dedicated page for editing an existing post, reached from the "Edit" button
 * on `/admin`. Deliberately a page and not a dialog, matching `AdminNewPost`.
 */
function AdminEditPost() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { onSessionSuspect } = useOutletContext<AdminOutletContext>();

  // AdminConsole already has the post in memory from the list it just
  // rendered, and passes it through router state -- so the common path
  // (clicking "Edit") opens instantly instead of re-fetching what's already
  // on screen. A direct visit or a reload has no such state, so this falls
  // back to fetching it by slug.
  const statePost = (location.state as { post?: Post } | null)?.post;
  const initialDraft =
    statePost && statePost.slug === slug ? draftFrom(statePost) : null;

  const [draft, setDraft] = useState<PostDraft | null>(initialDraft);
  const [phase, setPhase] = useState<Phase>(initialDraft ? "ready" : "loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (phase !== "loading") return;
    const controller = new AbortController();

    fetchAdminPost(slug, controller.signal)
      .then((post) => {
        setDraft(draftFrom(post));
        setPhase("ready");
      })
      .catch((failure: unknown) => {
        if (isAbort(failure)) return;
        setLoadError(message(failure));
        setPhase("error");
        if (failure instanceof ApiError && failure.status === 403) onSessionSuspect();
      });

    return () => controller.abort();
  }, [slug, phase, onSessionSuspect]);

  const set = <K extends keyof PostDraft>(key: K, value: PostDraft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      // The URL's slug, not draft.slug -- the draft's may have just been
      // edited, but that's the *new* value; the request still targets the
      // post at its current address.
      await updatePost(slug, draft);
      navigate("/admin");
    } catch (failure: unknown) {
      if (failure instanceof ApiError) {
        setSaveError(failure.message);
        setFieldErrors(failure.fieldErrors);
        // api.ts already retried a CSRF rejection, so a 403 that survives to
        // here means the session itself is gone.
        if (failure.status === 403) onSessionSuspect();
      } else {
        setSaveError(failure instanceof Error ? failure.message : "Could not save.");
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
        Edit post
      </Typography>

      {phase === "loading" && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress aria-label="Loading post" />
        </Box>
      )}

      {phase === "error" && (
        <Stack sx={{ gap: 2, alignItems: "flex-start" }}>
          <Alert
            severity="error"
            sx={{ width: "100%" }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => setPhase("loading")}
              >
                Retry
              </Button>
            }
          >
            {loadError}
          </Alert>
          {/* A dead link (post deleted, typo'd URL) otherwise leaves nothing
              but Retry, which just fails the same way again. */}
          <Button color="inherit" onClick={() => navigate("/admin")}>
            Back to posts
          </Button>
        </Stack>
      )}

      {phase === "ready" && draft && (
        <form onSubmit={handleSubmit}>
          <Stack sx={{ gap: 2 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}

            <PostFormFields
              draft={draft}
              fieldErrors={fieldErrors}
              onChange={set}
              slugHelperText="The post's URL. Changing it breaks any existing link."
            />

            {/* The page has no bottom padding of its own, so without this the
                Save button sits flush against the footer's top border. */}
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
                disabled={saving}
                onClick={() => navigate("/admin")}
              >
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </Stack>
          </Stack>
        </form>
      )}
    </Box>
  );
}

export default AdminEditPost;
