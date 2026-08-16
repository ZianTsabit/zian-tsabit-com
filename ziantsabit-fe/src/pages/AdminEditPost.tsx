import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";

import type { AdminOutletContext } from "../components/admin/AdminOutletContext";
import AutosaveStatus from "../components/admin/AutosaveStatus";
import PostFormFields from "../components/admin/PostFormFields";
import { ApiError, type FieldErrors } from "../services/api";
import {
  draftFrom,
  fetchAdminPost,
  updatePost,
  type PostDraft,
  type PostStatus,
  type WriteOptions,
} from "../services/adminPosts";
import { useAutosave } from "../services/useAutosave";
import { useWriteQueue } from "../services/useWriteQueue";
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

  // Whether the API has confirmed what is in the form, as opposed to the list's
  // in-memory copy of it. That copy can be a moment out of date now that
  // leaving the new-post page flushes a pending autosave: the list's GET and
  // the flush's PATCH are in flight at the same time, and the list can be
  // answered first. Opening the editor on the losing side of that race and
  // typing would autosave the stale body back over the flushed one -- silent
  // loss, from the feature meant to prevent it. So the post is always fetched;
  // router state only decides whether a spinner is shown while it arrives.
  const [confirmed, setConfirmed] = useState(false);
  const openedWithPost = useRef(initialDraft !== null);
  // Set by the first edit. The fetch above is a background confirmation, not a
  // reset button, so anything already typed outranks it.
  const touched = useRef(false);

  // Which button is in flight, or null. A plain boolean would not say which of
  // the two to relabel while the request runs.
  const [saving, setSaving] = useState<PostStatus | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // The address the post currently answers on, which a save that renames it
  // moves. A ref because a queued write reads it when it runs, not when it was
  // asked for -- and because the same component instance is reused when the
  // route's slug changes.
  const address = useRef(slug);
  useEffect(() => {
    address.current = slug;
  }, [slug]);

  const enqueue = useWriteQueue();

  const persist = async (
    source: PostDraft,
    status: PostStatus,
    keepSlug: boolean,
    // Autosave's, when it has any: on the way out of the page it asks for a
    // write that outlives the document. A button never passes one -- it is
    // followed by a navigation this page controls.
    options: WriteOptions = {},
  ): Promise<Post> => {
    const post = await updatePost(
      address.current,
      {
        ...source,
        // Autosave never renames. A slug half-typed into the field would
        // otherwise be written three seconds later, breaking every link to the
        // post -- and then again on the next keystroke. A blank one is omitted
        // from the request, which the API reads as "keep the current URL", so
        // renaming stays something a button does.
        slug: keepSlug ? "" : source.slug,
        status,
      },
      options,
    );
    address.current = post.slug;
    return post;
  };

  useEffect(() => {
    // "error" waits for Retry, which puts the phase back to "loading".
    if (confirmed || phase === "error") return;
    const controller = new AbortController();

    fetchAdminPost(slug, controller.signal)
      .then((post) => {
        if (!touched.current) setDraft(draftFrom(post));
        setConfirmed(true);
        setPhase("ready");
      })
      .catch((failure: unknown) => {
        if (isAbort(failure)) return;
        if (failure instanceof ApiError && failure.status === 403) onSessionSuspect();
        // With a copy already on screen there is something to edit, so a failed
        // refresh is not worth replacing it with an error page -- a save will
        // report the same problem, in the place that can act on it.
        if (openedWithPost.current) {
          setConfirmed(true);
          return;
        }
        setLoadError(message(failure));
        setPhase("error");
      });

    return () => controller.abort();
  }, [slug, confirmed, phase, onSessionSuspect]);

  const set = <K extends keyof PostDraft>(key: K, value: PostDraft[K]) => {
    touched.current = true;
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  // Status comes from the button, not from a field: the form has no status
  // control any more. On an already-published post that means "Save as draft"
  // unpublishes it -- the same thing the list's per-row toggle does, reached
  // from the editor.
  const save = async (status: PostStatus) => {
    if (!draft) return;
    setSaving(status);
    setSaveError(null);
    setFieldErrors({});
    try {
      // The post's current address, not draft.slug -- the draft's may have
      // just been edited, but that's the *new* value; the request still
      // targets the post where it lives now.
      await enqueue(() => persist(draft, status, false));
      navigate("/admin/posts");
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
      setSaving(null);
    }
  };

  // Autosave keeps the status the post already has -- `snapshot.status`, not a
  // literal -- so it can neither publish a draft nor unpublish a live post.
  // Both of those stay a decision someone makes with a button.
  const autosave = useAutosave({
    value: draft,
    // `confirmed` as well as `ready`: until the API has answered, the form may
    // be holding a stale copy, and autosaving that is how the refresh would
    // turn into an overwrite. Waiting also means the baseline autosave takes
    // when it switches on is the server's own copy.
    enabled:
      phase === "ready" &&
      confirmed &&
      saving === null &&
      Boolean(draft?.title.trim()),
    save: (snapshot, options) =>
      snapshot
        ? enqueue(() => persist(snapshot, snapshot.status, true, options))
        : Promise.resolve(),
    onError: (failure) => {
      if (failure instanceof ApiError && failure.status === 403) onSessionSuspect();
    },
  });

  // Neither button is type="submit" -- each has to name its own status -- so
  // with this many fields the browser will not submit implicitly either. This
  // is the guard for the case where it does: it keeps whatever status the post
  // already has, so an implicit submit can neither publish a draft nor
  // unpublish a live post, and it stops a default submission from reloading
  // the page over unsaved edits.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (draft) void save(draft.status);
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
          <Button color="inherit" onClick={() => navigate("/admin/posts")}>
            Back to posts
          </Button>
        </Stack>
      )}

      {phase === "ready" && draft && (
        <form onSubmit={handleSubmit}>
          <Stack sx={{ gap: 2 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}

            {/* There is no shadow copy of a published post to autosave into --
                a save is a save -- so say plainly that edits reach the public
                page as they are written, rather than letting it be a surprise. */}
            {draft.status === "published" && (
              <Alert severity="info">
                This post is published, so autosaved changes go live as you
                write them.
              </Alert>
            )}

            <PostFormFields
              draft={draft}
              fieldErrors={fieldErrors}
              onChange={set}
              slugHelperText="The post's URL. Changing it breaks any existing link."
              // The copy below is covered while the body is full screen, and
              // Ctrl+S works in there.
              fullscreenStatus={<AutosaveStatus state={autosave} duplicate />}
            />

            {/* The page has no bottom padding of its own, so without this the
                buttons sit flush against the footer's top border. */}
            <Stack
              direction="row"
              sx={{
                gap: 1,
                alignItems: "center",
                justifyContent: "flex-end",
                // A failed autosave carries the API's message with it, which is
                // wider than a phone; let it take its own line rather than
                // squeezing the buttons off the side.
                flexWrap: "wrap",
                pt: 1,
                pb: { xs: 3, sm: 4 },
              }}
            >
              {/* `mr: auto` rather than a spacer element, so the wrap above has
                  one less thing to place. */}
              <Box sx={{ mr: "auto", minWidth: 0 }}>
                <AutosaveStatus state={autosave} />
              </Box>
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
      )}
    </Box>
  );
}

export default AdminEditPost;
