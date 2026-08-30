import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";

import ActionButton from "./ActionButton";
import AdminBookList from "./AdminBookList";
import type { AdminOutletContext } from "./AdminOutletContext";
import ShareStoryDialog from "./ShareStoryDialog";
import { HEADER_HEIGHT } from "../../constants/layout";
import { ApiError } from "../../services/api";
import { BOOK_STATUSES, deleteBook, setBookStatus } from "../../services/adminBooks";
import { BOOK_SORTS, type Book } from "../../services/books";
import { bookStory } from "../../services/storyCard";
import { useAdminBooks } from "../../services/useAdminBooks";
import { useGenres } from "../../services/useBooks";

const ALL = "";

/** Matches the public catalogue's search box: long enough that typing a title
 *  is one request rather than one per letter. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The book catalogue's admin: the list plus its filters.
 *
 * Deliberately its own section rather than a filter on the post console -- a
 * book is a different resource with different columns, and the row here has to
 * show an author, a year and an ISBN that a post simply does not have.
 */
function AdminBookConsole() {
  const { onSessionSuspect } = useOutletContext<AdminOutletContext>();
  const navigate = useNavigate();

  const [genre, setGenre] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [ordering, setOrdering] = useState(ALL);
  const [page, setPage] = useState(1);

  // Two pieces of state for one box: what is being typed, and what has been
  // asked for. See the public catalogue for why.
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typed.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const genres = useGenres();
  const list = useAdminBooks(genre, search, status, ordering, page);
  // Stable across renders, unlike `list` itself, so the callbacks below are too.
  const { reload } = list;

  const [pendingDelete, setPendingDelete] = useState<Book | null>(null);
  // The entry whose story card is open. Memoised for the same reason the post
  // console memoises its own: the dialog redraws on the subject's identity.
  const [sharing, setSharing] = useState<Book | null>(null);
  const shareSubject = useMemo(() => (sharing ? bookStory(sharing) : null), [sharing]);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Every filter change goes back to page 1: page 3 of the whole catalogue is
   *  usually past the end of a filtered one. Same rule as the post console. */
  const changeFilter = (set: (value: string) => void, value: string) => {
    set(value);
    setPage(1);
  };

  // A mutation can empty the page being shown -- delete the only row on page 3
  // and page 3 stops existing, leaving "No books match this filter" over a list
  // that is not in fact empty. Stepping back re-fetches, and repeats if that
  // page has gone too.
  useEffect(() => {
    if (list.phase === "ready" && list.books.length === 0 && page > 1) {
      setPage((current) => current - 1);
    }
  }, [list.phase, list.books.length, page]);

  const handleFailure = useCallback(
    (failure: unknown) => {
      setActionError(
        failure instanceof Error ? failure.message : "The change did not go through.",
      );
      // api.ts already retried a CSRF rejection, so a 403 that survives to here
      // means the session itself is gone; re-checking swaps in the login form.
      if (failure instanceof ApiError && failure.status === 403) onSessionSuspect();
    },
    [onSessionSuspect],
  );

  const runOnBook = useCallback(
    async (book: Book, action: () => Promise<unknown>) => {
      setBusySlug(book.slug);
      setActionError(null);
      try {
        await action();
        reload();
      } catch (failure: unknown) {
        handleFailure(failure);
      } finally {
        setBusySlug(null);
      }
    },
    [handleFailure, reload],
  );

  const openEditor = (book: Book) => {
    // The book is already in memory from the list just rendered, so it rides
    // along as router state -- the editor opens with it instantly instead of
    // re-fetching what is already on screen.
    navigate(`/admin/books/edit/${encodeURIComponent(book.slug)}`, {
      state: { book },
    });
  };

  const handleToggleStatus = (book: Book) =>
    runOnBook(book, () =>
      setBookStatus(book.slug, book.status === "published" ? "draft" : "published"),
    );

  const confirmDelete = () => {
    const book = pendingDelete;
    setPendingDelete(null);
    if (book) void runOnBook(book, () => deleteBook(book.slug));
  };

  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          gap: 1,
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography
          component="h1"
          sx={{ fontWeight: "bold", fontSize: { xs: "20px", sm: "24px" } }}
        >
          Books
        </Typography>

        {/* `ActionButton` with the same leading `+` as `NewPostButton`, rather
            than that component: it hardcodes its own label, and "New post" on
            the books page would be wrong in the one way nobody rereads. */}
        <ActionButton
          onClick={() => navigate("/admin/books/new")}
          startIcon={<AddIcon />}
        >
          New book
        </ActionButton>
      </Stack>

      {/* Sticky under the fixed header, like the post console's filter row.
          `background.default` and not `transparent`: Admin.tsx's own wrapper is
          transparent, so the page colour comes from the body and has to be
          named here or rows would show through while scrolling. */}
      <Stack
        direction="row"
        sx={{
          gap: 2,
          flexWrap: "wrap",
          position: "sticky",
          top: HEADER_HEIGHT,
          zIndex: 1,
          bgcolor: "background.default",
          mx: { xs: -2, sm: -3 },
          px: { xs: 2, sm: 3 },
          py: 1.5,
          mb: 2,
        }}
      >
        <TextField
          size="small"
          label="Search"
          placeholder="Title, author or ISBN"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 200 }}
        />

        {/* All three selects default to "", and `displayEmpty` is what makes
            that show as "All genres" / "All statuses" / "Recently added"
            rather than an empty box; the label is pinned shrunk to match. */}
        {genres.length > 0 && (
          <TextField
            select
            size="small"
            label="Genre"
            value={genre}
            onChange={(event) => changeFilter(setGenre, event.target.value)}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value={ALL}>All genres</MenuItem>
            {genres.map((option) => (
              <MenuItem key={option.name} value={option.name}>
                {option.name} ({option.count})
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(event) => changeFilter(setStatus, event.target.value)}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value={ALL}>All statuses</MenuItem>
          {BOOK_STATUSES.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Sort"
          value={ordering}
          onChange={(event) => changeFilter(setOrdering, event.target.value)}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        >
          {BOOK_SORTS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <AdminBookList
        books={list.books}
        phase={list.phase}
        error={list.error}
        busySlug={busySlug}
        page={page}
        totalPages={list.totalPages}
        onPageChange={setPage}
        onRetry={list.reload}
        onEdit={openEditor}
        onToggleStatus={handleToggleStatus}
        onDelete={setPendingDelete}
        onShare={setSharing}
      />

      <ShareStoryDialog subject={shareSubject} onClose={() => setSharing(null)} />

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete this book?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            “{pendingDelete?.title}” will be removed from the catalogue for good.
            There is no undo.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setPendingDelete(null)}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default AdminBookConsole;
