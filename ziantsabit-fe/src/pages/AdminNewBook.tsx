import { useRef, useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate, useOutletContext } from "react-router-dom";
import { Alert, Box, Link, Stack, Typography } from "@mui/material";

import ActionButton from "../components/admin/ActionButton";
import type { AdminOutletContext } from "../components/admin/AdminOutletContext";
import AutosaveStatus from "../components/admin/AutosaveStatus";
import BookFormFields from "../components/admin/BookFormFields";
import { ApiError, type FieldErrors } from "../services/api";
import {
  createBook,
  deriveSlug,
  emptyDraft,
  updateBook,
  type BookDraft,
  type BookStatus,
  type WriteOptions,
} from "../services/adminBooks";
import type { Book } from "../services/books";
import { useAutosave } from "../services/useAutosave";
import { useGenres } from "../services/useBooks";
import { useWriteQueue } from "../services/useWriteQueue";

/**
 * The slug an autosave should send for a book that already exists, or "" to
 * leave the URL alone -- which is how `payload()` reads a blank one.
 *
 * A slug is generated once, by `Book.save()`, and never regenerated, so an
 * entry created by autosave from a half-typed title would keep the half-typed
 * URL forever. Re-deriving it from the title on each save is what lets the URL
 * catch up, until the author pins one by hand.
 */
function slugToSend(source: BookDraft, currentSlug: string): string {
  const typed = source.slug.trim();
  if (typed) return typed;

  const base = deriveSlug(source.title);
  if (!base) return "";

  // `Book.save()` disambiguates a taken title with the author, then with -2,
  // -3..., so an entry sitting at "ulysses-james-joyce" whose title derives
  // "ulysses" is already as close to its title as it can get. Asking for
  // "ulysses" again would just be refused by the serializer's unique check,
  // every three seconds. (`base` is only ever [a-z0-9_-], so it carries no
  // regex metacharacters into this.)
  const inSync = new RegExp(`^${base}(-.+)?$`).test(currentSlug);
  return inSync ? "" : base;
}

/**
 * Dedicated page for adding a book, reached from "New book" on `/admin/books`.
 *
 * Mirrors `AdminNewPost` down to the autosave rules, deliberately: the two
 * editors are the same problem, and a books form that saved differently would
 * be a second set of the same bugs to find.
 */
function AdminNewBook() {
  const navigate = useNavigate();
  const { onSessionSuspect } = useOutletContext<AdminOutletContext>();

  const [draft, setDraft] = useState<BookDraft>(emptyDraft);
  // Which button is in flight, or null. A plain boolean would not say which of
  // the two to relabel while the request runs.
  const [saving, setSaving] = useState<BookStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Where the entry lives once anything -- autosave or a button -- has written
  // it. A ref because `persist` reads it inside a queued task, long after the
  // render that would have handed it a state value; a second copy in state
  // only exists so the page can say the draft is now in the catalogue.
  const savedSlug = useRef<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const genres = useGenres();
  const enqueue = useWriteQueue();

  const set = <K extends keyof BookDraft>(key: K, value: BookDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  /** Update the entry, letting its URL keep following the title. */
  const update = async (
    target: string,
    source: BookDraft,
    status: BookStatus,
    options: WriteOptions,
  ): Promise<Book> => {
    const wanted = slugToSend(source, target);
    try {
      return await updateBook(target, { ...source, slug: wanted }, status, options);
    } catch (failure: unknown) {
      // A slug we derived ourselves can collide with another entry's, and the
      // serializer refuses it outright -- Book.save()'s own disambiguation
      // never gets a say. Keep the URL the server already chose rather than
      // losing the writing over a URL nobody has seen yet. A slug the author
      // typed is theirs, so that error stays theirs to see.
      const derived = wanted !== "" && source.slug.trim() === "";
      if (derived && failure instanceof ApiError && Boolean(failure.fieldErrors.slug)) {
        return await updateBook(target, { ...source, slug: "" }, status, options);
      }
      throw failure;
    }
  };

  /**
   * Create the entry the first time, update it every time after.
   *
   * Autosave means the book usually already exists by the time a button is
   * pressed, so "save" here is not a synonym for "create" -- without this,
   * pressing Publish after an autosave would create a second copy.
   */
  const persist = async (
    source: BookDraft,
    status: BookStatus,
    // Autosave's, when it has any: on the way out of the page it asks for a
    // write that outlives the document. A button never passes one -- it is
    // followed by a navigation this page controls.
    options: WriteOptions = {},
  ): Promise<Book> => {
    const target = savedSlug.current;
    const book = target
      ? await update(target, source, status, options)
      : await createBook(source, status, options);

    savedSlug.current = book.slug;
    setCreatedSlug(book.slug);
    return book;
  };

  // Status comes from the button, not from a field: the form has no status
  // control, so "Save as draft" and "Publish" are the same save with a
  // different value for it.
  const save = async (status: BookStatus) => {
    setSaving(status);
    setError(null);
    setFieldErrors({});
    try {
      await enqueue(() => persist(draft, status));
      navigate("/admin/books");
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

  // Autosave always writes a draft, never a published entry: publishing is a
  // decision, and it is the one thing on this page that must stay deliberate.
  //
  // Off until there is both a title and an author, because the API requires
  // both -- a book with only a title is a 400 rather than a draft, and
  // retrying that every three seconds would be an error banner for a form
  // that is merely half-filled.
  const autosave = useAutosave({
    value: draft,
    enabled:
      saving === null && draft.title.trim() !== "" && draft.author.trim() !== "",
    save: (snapshot, options) => enqueue(() => persist(snapshot, "draft", options)),
    onError: (failure) => {
      if (failure instanceof ApiError && failure.status === 403) onSessionSuspect();
    },
  });

  // Neither button is type="submit" -- each has to name its own status -- so
  // with this many fields the browser will not submit implicitly either. This
  // is the guard for the case where it does: it saves the safer of the two (a
  // new entry is a draft until its author says otherwise) and, more to the
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
        New book
      </Typography>

      <form onSubmit={handleSubmit}>
        <Stack sx={{ gap: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Autosave creates a real entry, so say so once it has: leaving this
              page is no longer the same as discarding what is on it. */}
          {createdSlug && (
            <Alert severity="info">
              Saved as a draft in{" "}
              <Link component={RouterLink} to="/admin/books" color="inherit">
                your catalogue
              </Link>
              . Leaving this page keeps it; delete it there if you change your mind.
            </Alert>
          )}

          <BookFormFields
            draft={draft}
            fieldErrors={fieldErrors}
            onChange={set}
            slugHelperText="Leave blank to generate it from the title."
            genreOptions={genres.map((genre) => genre.name)}
            // The copy below is covered while the review is full screen, and
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
            {/* Publish sits last because it is the page's primary action, and
                position is the only emphasis these carry. */}
            <ActionButton
              tone="neutral"
              disabled={saving !== null}
              onClick={() => void save("draft")}
            >
              {saving === "draft" ? "Saving..." : "Save as draft"}
            </ActionButton>
            <ActionButton
              disabled={saving !== null}
              onClick={() => void save("published")}
            >
              {saving === "published" ? "Publishing..." : "Publish"}
            </ActionButton>
          </Stack>
        </Stack>
      </form>
    </Box>
  );
}

export default AdminNewBook;
