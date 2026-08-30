import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Pagination,
  Stack,
  Typography,
} from "@mui/material";

import ActionButton from "./ActionButton";
import TagChip from "../TagChip";
import { toPlainText } from "../markdownText";
import { formatIsbn, formatYear, type Book } from "../../services/books";
import { MONO_FONT } from "../../theme";

/** Matches the admin post list: last edit, with the time of day kept, since
 *  editing twice in an afternoon is exactly the case this list is for. */
function formatEdited(book: Book): string {
  const date = new Date(book.updated_at);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface RowProps {
  book: Book;
  busy: boolean;
  onEdit: (book: Book) => void;
  onToggleStatus: (book: Book) => void;
  onDelete: (book: Book) => void;
  onShare: (book: Book) => void;
}

function BookRow({ book, busy, onEdit, onToggleStatus, onDelete, onShare }: RowProps) {
  const published = book.status === "published";
  const text = toPlainText(book.review);

  return (
    <Box
      component="article"
      sx={{
        // No border, no surface -- the same divided list the rest of the site
        // uses. Dimmed while its own request is in flight, so a slow publish
        // is visibly doing something rather than looking ignored.
        opacity: busy ? 0.5 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{
          gap: { xs: 1, md: 2 },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "center" },
        }}
      >
        {/* A thumbnail rather than the public grid's full jacket: this list
            runs 20 rows to a page and is scanned by title, with the cover only
            confirming which edition a row is. */}
        {book.cover_image_url && (
          <Box
            component="img"
            src={book.cover_image_url}
            alt=""
            loading="lazy"
            sx={{
              width: 44,
              height: 66,
              flexShrink: 0,
              objectFit: "cover",
              borderRadius: 0.5,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              alignSelf: "flex-start",
            }}
          />
        )}

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            component="h2"
            sx={{
              fontWeight: "bold",
              fontSize: { xs: "15px", sm: "17px" },
              color: "text.primary",
            }}
          >
            {book.title}
          </Typography>

          <Typography sx={{ fontSize: "13px", color: "text.primary" }}>
            {book.author}
          </Typography>

          <Typography
            sx={{
              fontFamily: MONO_FONT,
              fontSize: "12px",
              color: "text.secondary",
              // A long slug should not be able to widen the page.
              overflowWrap: "anywhere",
            }}
          >
            /{book.slug}
          </Typography>

          <Typography sx={{ fontSize: "12px", color: "text.secondary", mt: 0.5 }}>
            {formatYear(book.release_year)}
            {book.isbn && ` | ISBN ${formatIsbn(book.isbn)}`}
            {" | "}
            <Box component="time" dateTime={book.updated_at}>
              Updated {formatEdited(book)}
            </Box>
          </Typography>

          {text && (
            <Typography
              sx={{
                fontSize: { xs: "13px", sm: "14px" },
                color: "text.primary",
                mt: 0.5,
                whiteSpace: "pre-line",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
              }}
            >
              {text}
            </Typography>
          )}

          <Stack
            direction="row"
            sx={{ gap: 1, mt: 1, alignItems: "center", flexWrap: "wrap" }}
          >
            {/* The status chip leads, so the entry's own genres do not get
                lost among the admin-only labels. */}
            <TagChip label={published ? "Published" : "Draft"} emphasis={published} />
            {book.genres.map((genre) => (
              <TagChip key={genre} label={genre} />
            ))}
          </Stack>
        </Box>

        <Stack
          direction="row"
          sx={{
            gap: 1,
            flexShrink: 0,
            justifyContent: { xs: "flex-end", md: "initial" },
          }}
        >
          {/* First, so Delete stays last -- the same order the post list's
              row uses, and for the same reason. */}
          <ActionButton onClick={() => onShare(book)} disabled={busy}>
            Share
          </ActionButton>
          <ActionButton onClick={() => onEdit(book)} disabled={busy}>
            Edit
          </ActionButton>
          {/* One button, two actions, so the tone follows the label -- taking
              an entry down is the page's ink, putting one up is the primary
              colour Publish carries in the editor. */}
          <ActionButton
            tone={published ? "neutral" : "primary"}
            onClick={() => onToggleStatus(book)}
            disabled={busy}
          >
            {published ? "Unpublish" : "Publish"}
          </ActionButton>
          <ActionButton tone="danger" onClick={() => onDelete(book)} disabled={busy}>
            Delete
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}

interface Props extends Omit<RowProps, "book" | "busy"> {
  books: Book[];
  phase: "loading" | "ready" | "error";
  error: string | null;
  /** Slug of the book whose own request is in flight, if any. */
  busySlug: string | null;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

/** Renders the four states the list can be in: loading, error, empty, populated. */
function AdminBookList({
  books,
  phase,
  error,
  busySlug,
  page,
  totalPages,
  onPageChange,
  onRetry,
  onEdit,
  onToggleStatus,
  onDelete,
  onShare,
}: Props) {
  if (phase === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress aria-label="Loading books" />
      </Box>
    );
  }

  if (phase === "error") {
    return (
      <Alert
        severity="error"
        sx={{ my: 2 }}
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (books.length === 0) {
    return (
      <Typography sx={{ color: "text.secondary", py: 6, textAlign: "center" }}>
        No books match this filter.
      </Typography>
    );
  }

  return (
    <Stack sx={{ gap: 3, width: "100%" }}>
      {/* Its own Stack so the rule falls only between rows, not above the
          pagination. The gap is per side, since a divider is a flex child. */}
      <Stack divider={<Divider />} sx={{ gap: { xs: 2, sm: 2.5 } }}>
        {books.map((book) => (
          <BookRow
            key={book.slug}
            book={book}
            busy={busySlug === book.slug}
            onEdit={onEdit}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
            onShare={onShare}
          />
        ))}
      </Stack>

      {totalPages > 1 && (
        <Pagination
          count={totalPages}
          page={page}
          onChange={(_event, value) => onPageChange(value)}
          sx={{ alignSelf: "center" }}
        />
      )}
    </Stack>
  );
}

export default AdminBookList;
