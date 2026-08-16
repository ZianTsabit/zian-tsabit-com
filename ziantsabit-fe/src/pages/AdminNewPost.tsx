import { useRef, useState, type FormEvent } from "react";
import { Link as RouterLink, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { Alert, Box, Button, Link, Stack, Typography } from "@mui/material";

import type { AdminOutletContext } from "../components/admin/AdminOutletContext";
import AutosaveStatus from "../components/admin/AutosaveStatus";
import PostFormFields from "../components/admin/PostFormFields";
import { ApiError, type FieldErrors } from "../services/api";
import {
  createPost,
  deriveSlug,
  emptyDraft,
  updatePost,
  type PostDraft,
  type PostStatus,
  type WriteOptions,
} from "../services/adminPosts";
import { useAutosave } from "../services/useAutosave";
import { useWriteQueue } from "../services/useWriteQueue";
import type { Post, PostCategory } from "../services/posts";

/**
 * The slug an autosave should send for a post that already exists, or "" to
 * leave the URL alone -- which is how `payload()` reads a blank one.
 *
 * A slug is generated once, by `Post.save()`, and never regenerated, so a post
 * created by autosave from a half-typed title would keep the half-typed URL
 * forever. Re-deriving it from the title on each save is what lets the URL
 * catch up, until the author pins one by hand.
 */
function slugToSend(source: PostDraft, currentSlug: string): string {
  const typed = source.slug.trim();
  if (typed) return typed;

  const base = deriveSlug(source.title);
  if (!base) return "";

  // `Post.save()` appends -2, -3... when the derived slug is taken, so a post
  // sitting at "notes-2" whose title derives "notes" is already as close to its
  // title as it can get. Asking for "notes" again would just be refused by the
  // serializer's unique check, every three seconds. (`base` is only ever
  // [a-z0-9_-], so it carries no regex metacharacters into this.)
  const inSync = new RegExp(`^${base}(-\\d+)?$`).test(currentSlug);
  return inSync ? "" : base;
}

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

  // Where the post lives once anything -- autosave or a button -- has written
  // it. A ref because `persist` reads it inside a queued task, long after the
  // render that would have handed it a state value; a second copy in state
  // only exists so the page can say the draft is now in the posts list.
  const savedSlug = useRef<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const enqueue = useWriteQueue();

  const set = <K extends keyof PostDraft>(key: K, value: PostDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  /** Update the post, letting its URL keep following the title. */
  const update = async (
    target: string,
    source: PostDraft,
    status: PostStatus,
    options: WriteOptions,
  ): Promise<Post> => {
    const wanted = slugToSend(source, target);
    try {
      return await updatePost(target, { ...source, slug: wanted, status }, options);
    } catch (failure: unknown) {
      // A slug we derived ourselves can collide with another post's, and the
      // serializer refuses it outright -- Post.save()'s -2 dedupe never gets a
      // say. Keep the URL the server already chose rather than losing the
      // writing over a URL nobody has seen yet. A slug the author typed is
      // theirs, so that error stays theirs to see.
      const derived = wanted !== "" && source.slug.trim() === "";
      if (
        derived &&
        failure instanceof ApiError &&
        Boolean(failure.fieldErrors.slug)
      ) {
        return await updatePost(target, { ...source, slug: "", status }, options);
      }
      throw failure;
    }
  };

  /**
   * Create the post the first time, update it every time after.
   *
   * Autosave means the post usually already exists by the time a button is
   * pressed, so "save" here is not a synonym for "create" any more -- without
   * this, pressing Publish after an autosave would create a second copy.
   */
  const persist = async (
    source: PostDraft,
    status: PostStatus,
    // Autosave's, when it has any: on the way out of the page it asks for a
    // write that outlives the document. A button never passes one -- it is
    // followed by a navigation this page controls.
    options: WriteOptions = {},
  ): Promise<Post> => {
    const target = savedSlug.current;
    const post = target
      ? await update(target, source, status, options)
      : await createPost({ ...source, status }, options);

    savedSlug.current = post.slug;
    setCreatedSlug(post.slug);
    return post;
  };

  // Status comes from the button, not from a field: the form has no status
  // control any more, so "Save as draft" and "Publish" are the same save with
  // a different value for it.
  const save = async (status: PostStatus) => {
    setSaving(status);
    setError(null);
    setFieldErrors({});
    try {
      await enqueue(() => persist(draft, status));
      navigate("/admin/posts");
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

  // Autosave always writes a draft, never a published post: publishing is a
  // decision, and it is the one thing on this page that must stay deliberate.
  // Off until there is a title, because a post without one is a 400 rather
  // than a draft, and off during a manual save so the two do not both write.
  const autosave = useAutosave({
    value: draft,
    enabled: saving === null && draft.title.trim() !== "",
    save: (snapshot, options) => enqueue(() => persist(snapshot, "draft", options)),
    onError: (failure) => {
      if (failure instanceof ApiError && failure.status === 403) onSessionSuspect();
    },
  });

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

          {/* Autosave creates a real post, so say so once it has: leaving this
              page is no longer the same as discarding what is on it, and the
              draft it left behind is now sitting in the posts list. */}
          {createdSlug && (
            <Alert severity="info">
              Saved as a draft in{" "}
              <Link component={RouterLink} to="/admin/posts" color="inherit">
                your posts
              </Link>
              . Leaving this page keeps it; delete it there if you change your mind.
            </Alert>
          )}

          <PostFormFields
            draft={draft}
            fieldErrors={fieldErrors}
            onChange={set}
            slugHelperText="Leave blank to generate it from the title."
            showPublishedAt={false}
            // The copy below is covered while the body is full screen, and
            // Ctrl+S works in there.
            fullscreenStatus={
              <AutosaveStatus state={autosave} savedLabel="Draft saved" duplicate />
            }
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
              <AutosaveStatus state={autosave} savedLabel="Draft saved" />
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
    </Box>
  );
}

export default AdminNewPost;
