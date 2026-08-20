import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";

import ActionButton from "../components/admin/ActionButton";
import type { AdminOutletContext } from "../components/admin/AdminOutletContext";
import AutosaveStatus from "../components/admin/AutosaveStatus";
import BookFormFields from "../components/admin/BookFormFields";
import { ApiError, type FieldErrors } from "../services/api";
import {
  draftFrom,
  fetchAdminBook,
  updateBook,
  type BookDraft,
  type BookStatus,
  type WriteOptions,
} from "../services/adminBooks";
import type { Book } from "../services/books";
import { isAbort } from "../services/posts";
import { useAutosave } from "../services/useAutosave";
import { useGenres } from "../services/useBooks";
import { useWriteQueue } from "../services/useWriteQueue";

type Phase = "loading" | "ready" | "error";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Could not load this book.";
}

/**
 * Dedicated page for editing a catalogue entry, reached from "Edit" on
 * `/admin/books`. Mirrors `AdminEditPost`, including why the entry is always
 * re-fetched even when the list handed one over.
 */
function AdminEditBook() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { onSessionSuspect } = useOutletContext<AdminOutletContext>();

  // The console already has the book in memory from the list it just rendered
  // and passes it through router state, so clicking "Edit" opens instantly
  // instead of re-fetching what is already on screen. A direct visit or a
  // reload has no such state, so this falls back to fetching it by slug.
  const stateBook = (location.state as { book?: Book } | null)?.book;
  const initialDraft = stateBook && stateBook.slug === slug ? draftFrom(stateBook) : null;

  const [draft, setDraft] = useState<BookDraft | null>(initialDraft);
  const [phase, setPhase] = useState<Phase>(initialDraft ? "ready" : "loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  // The entry's status, which the form deliberately has no control for: it is
  // carried here so autosave can write back the status the book already has.
  const [status, setStatus] = useState<BookStatus>(stateBook?.status ?? "draft");

  // Whether the API has confirmed what is in the form, as opposed to the
  // list's in-memory copy of it. That copy can be a moment out of date, since
  // leaving the new-book page flushes a pending autosave: the list's GET and
  // the flush's PATCH are in flight at the same time, and the list can be
  // answered first. Opening the editor on the losing side of that race and
  // typing would autosave the stale review back over the flushed one -- silent
  // loss, from the feature meant to prevent it. So the book is always fetched;
  // router state only decides whether a spinner is shown while it arrives.
  const [confirmed, setConfirmed] = useState(false);
  const openedWithBook = useRef(initialDraft !== null);
  // Set by the first edit. The fetch above is a background confirmation, not a
  // reset button, so anything already typed outranks it.
  const touched = useRef(false);

  const [saving, setSaving] = useState<BookStatus | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // The address the entry currently answers on, which a save that renames it
  // moves. A ref because a queued write reads it when it runs, not when it was
  // asked for -- and because the same component instance is reused when the
  // route's slug changes.
  const address = useRef(slug);
  useEffect(() => {
    address.current = slug;
  }, [slug]);

  const genres = useGenres();
  const enqueue = useWriteQueue();

  const persist = async (
    source: BookDraft,
    nextStatus: BookStatus,
    keepSlug: boolean,
    // Autosave's, when it has any: on the way out of the page it asks for a
    // write that outlives the document. A button never passes one.
    options: WriteOptions = {},
  ): Promise<Book> => {
    const book = await updateBook(
      address.current,
      {
        ...source,
        // Autosave never renames. A slug half-typed into the field would
        // otherwise be written three seconds later, breaking every link to the
        // entry -- and then again on the next keystroke. A blank one is omitted
        // from the request, which the API reads as "keep the current URL", so
        // renaming stays something a button does.
        slug: keepSlug ? "" : source.slug,
      },
      nextStatus,
      options,
    );
    address.current = book.slug;
    setStatus(book.status);
    return book;
  };

  useEffect(() => {
    // "error" waits for Retry, which puts the phase back to "loading".
    if (confirmed || phase === "error") return;
    const controller = new AbortController();

    fetchAdminBook(slug, controller.signal)
      .then((book) => {
        if (!touched.current) setDraft(draftFrom(book));
        setStatus(book.status);
        setConfirmed(true);
        setPhase("ready");
      })
      .catch((failure: unknown) => {
        if (isAbort(failure)) return;
        if (failure instanceof ApiError && failure.status === 403) onSessionSuspect();
        // With a copy already on screen there is something to edit, so a failed
        // refresh is not worth replacing it with an error page -- a save will
        // report the same problem, in the place that can act on it.
        if (openedWithBook.current) {
          setConfirmed(true);
          return;
        }
        setLoadError(message(failure));
        setPhase("error");
      });

    return () => controller.abort();
  }, [slug, confirmed, phase, onSessionSuspect]);

  const set = <K extends keyof BookDraft>(key: K, value: BookDraft[K]) => {
    touched.current = true;
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  // Status comes from the button, not from a field. On an already-published
  // entry that means "Save as draft" unpublishes it -- the same thing the
  // list's per-row toggle does, reached from the editor.
  const save = async (next: BookStatus) => {
    if (!draft) return;
    setSaving(next);
    setSaveError(null);
    setFieldErrors({});
    try {
      // The entry's current address, not draft.slug -- the draft's may have
      // just been edited, but that is the *new* value; the request still
      // targets where the book lives now.
      await enqueue(() => persist(draft, next, false));
      navigate("/admin/books");
    } catch (failure: unknown) {
      if (failure instanceof ApiError) {
        setSaveError(failure.message);
        setFieldErrors(failure.fieldErrors);
        if (failure.status === 403) onSessionSuspect();
      } else {
        setSaveError(failure instanceof Error ? failure.message : "Could not save.");
      }
      setSaving(null);
    }
  };

  // Autosave keeps the status the entry already has -- the tracked `status`,
  // never a literal -- so it can neither publish a draft nor unpublish a live
  // entry. Both stay a decision someone makes with a button.
  const autosave = useAutosave({
    value: draft,
    // `confirmed` as well as `ready`: until the API has answered, the form may
    // be holding a stale copy, and autosaving that is how the refresh would
    // turn into an overwrite. Waiting also means the baseline autosave takes
    // when it switches on is the server's own copy. Title and author, because
    // the API requires both and a write missing either is a 400 rather than a
    // draft.
    enabled:
      phase === "ready" &&
      confirmed &&
      saving === null &&
      Boolean(draft?.title.trim()) &&
      Boolean(draft?.author.trim()),
    save: (snapshot, options) =>
      snapshot
        ? enqueue(() => persist(snapshot, status, true, options))
        : Promise.resolve(),
    onError: (failure) => {
      if (failure instanceof ApiError && failure.status === 403) onSessionSuspect();
    },
  });

  // Neither button is type="submit" -- each has to name its own status -- so
  // with this many fields the browser will not submit implicitly either. This
  // is the guard for the case where it does: it keeps whatever status the
  // entry already has, so an implicit submit can neither publish a draft nor
  // unpublish a live entry.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (draft) void save(status);
  };

  return (
    <Box sx={{ maxWidth: 640, width: "100%", mx: "auto" }}>
      <Typography
        component="h1"
        sx={{ fontWeight: "bold", fontSize: { xs: "20px", sm: "24px" }, mb: 3 }}
      >
        Edit book
      </Typography>

      {phase === "loading" && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress aria-label="Loading book" />
        </Box>
      )}

      {phase === "error" && (
        <Stack sx={{ gap: 2, alignItems: "flex-start" }}>
          <Alert
            severity="error"
            sx={{ width: "100%" }}
            action={
              <Button color="inherit" size="small" onClick={() => setPhase("loading")}>
                Retry
              </Button>
            }
          >
            {loadError}
          </Alert>
          {/* A dead link (entry deleted, typo'd URL) otherwise leaves nothing
              but Retry, which just fails the same way again. */}
          <Button color="inherit" onClick={() => navigate("/admin/books")}>
            Back to books
          </Button>
        </Stack>
      )}

      {phase === "ready" && draft && (
        <form onSubmit={handleSubmit}>
          <Stack sx={{ gap: 2 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}

            {/* There is no shadow copy of a published entry to autosave into --
                a save is a save -- so say plainly that edits reach the public
                catalogue as they are written, rather than letting it be a
                surprise. */}
            {status === "published" && (
              <Alert severity="info">
                This book is published, so autosaved changes go live as you
                write them.
              </Alert>
            )}

            <BookFormFields
              draft={draft}
              fieldErrors={fieldErrors}
              onChange={set}
              slugHelperText="The entry's URL. Changing it breaks any existing link."
              genreOptions={genres.map((genre) => genre.name)}
              // The copy below is covered while the review is full screen, and
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
                flexWrap: "wrap",
                pt: 1,
                pb: { xs: 3, sm: 4 },
              }}
            >
              <Box sx={{ mr: "auto", minWidth: 0 }}>
                <AutosaveStatus state={autosave} />
              </Box>
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
      )}
    </Box>
  );
}

export default AdminEditBook;
