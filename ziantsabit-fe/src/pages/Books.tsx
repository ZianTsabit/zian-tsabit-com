import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  InputAdornment,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import BookCard from "../components/BookCard";
import Centered from "../components/Centered";
import Typewriter from "../components/Typewriter";
import { HEADER_HEIGHT } from "../constants/layout";
import { BOOK_SORTS } from "../services/books";
import { useBooks, useGenres } from "../services/useBooks";

const ALL = "";

/** How long the search box sits still before the request goes out. Short
 *  enough to feel immediate, long enough that typing "neuromancer" is one
 *  request rather than eleven. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The book catalogue.
 *
 * **Not a filtered view of the posts feed** -- that was what this page used to
 * be, back when posts had categories and one of them was "books". The two are
 * different things: a post about a book is writing, and lives in the feed at
 * `/` (tagged however its author likes); this page is the shelf itself, backed
 * by `/api/books/`, where an entry has an author, a year, an ISBN and a
 * review.
 *
 * A grid rather than the divided column the post lists use: entries here are
 * scanned by cover, and twenty of them stacked one per row would be a very long
 * page of very little information.
 */
function Books() {
  const [genre, setGenre] = useState(ALL);
  const [ordering, setOrdering] = useState(ALL);
  const [page, setPage] = useState(1);

  // Two pieces of state for one box: what is being typed, and what has been
  // asked for. Without the split, every keystroke is a request and an aborted
  // one -- and the input would re-render from the fetch rather than from the
  // key that caused it.
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typed.trim());
      // A new search starts at the beginning, for the same reason the filters
      // below do.
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const genres = useGenres();
  const { books, count, phase, error, totalPages, retry } = useBooks(
    genre,
    search,
    ordering,
    page,
  );

  /** Every filter change goes back to page 1: page 3 of the whole catalogue is
   *  usually past the end of a filtered one, and landing on an empty page
   *  looks like the filter matched nothing. Same rule as the Blog page. */
  const changeFilter = (set: (value: string) => void, value: string) => {
    set(value);
    setPage(1);
  };

  const filtered = genre !== ALL || search !== "";

  return (
    <Box
      sx={{
        width: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        alignItems: "center",
        pt: { xs: 2, sm: 3 },
      }}
    >
      {/* flex: 1 so the loading spinner and the empty state centre in what is
          left below the quote and the filters. */}
      <Container
        maxWidth="md"
        sx={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        {/* A pull quote, not two loose paragraphs: `figure` + `blockquote` +
            `figcaption` is what this always was semantically, and the box is
            what makes it look like one thing rather than stray italics above
            the filters.

            The opening “ is a real element rather than a `::before`, so it is a
            flex item the text lays out beside -- an absolutely positioned glyph
            would overlap the first line at some font size, and there are four
            of those here. `aria-hidden` because it is ornament: the quotation
            is already marked up as one, and a screen reader announcing a
            stray double-quote before it is noise. */}
        <Box
          component="figure"
          sx={{
            // `figure` carries a default margin in every browser.
            m: 0,
            mb: 3,
            display: "flex",
            alignItems: "flex-start",
            gap: { xs: 1.5, sm: 2 },
            px: { xs: 2, sm: 3 },
            py: { xs: 2, sm: 2.5 },
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              flexShrink: 0,
              fontSize: { xs: "36px", sm: "48px", md: "60px" },
              // The glyph sits high in its em box, so a line box of its own
              // height would push it well below the first line of the quote.
              lineHeight: 0.75,
              // Serif, because Ubuntu draws a straight, unremarkable quote mark
              // and the whole point of this one is that it is decorative.
              fontFamily: "Georgia, 'Times New Roman', serif",
              color: "primary.main",
              // Ornament, not emphasis -- full-strength primary at this size
              // reads as a link that lost its text.
              opacity: 0.55,
              userSelect: "none",
            }}
          >
            “
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="blockquote"
              sx={{
                m: 0,
                textAlign: { xs: "left", sm: "justify" },
                fontStyle: "italic",
                color: "text.primary",
                fontSize: { xs: "12px", sm: "14px", md: "16px", lg: "22px" },
              }}
            >
              It is foolish to think that you have to read all the books you
              buy, as it is foolish to criticize those who buy more books than
              they will ever be able to read ...
            </Typography>

            <Typography
              component="figcaption"
              sx={{
                mt: 1,
                textAlign: "right",
                fontStyle: "italic",
                color: "text.secondary",
                fontSize: { xs: "12px", sm: "13px", md: "14px", lg: "16px" },
              }}
            >
              — Umberto Eco
            </Typography>
          </Box>
        </Box>

        {/* Sticky under the fixed header, like the Blog page's filter row.
            The negative margins let the background run to the container's
            gutters, so entries scrolling underneath do not show through at the
            edges; `background.default` is named explicitly because the page
            colour comes from the body, which this would otherwise let through. */}
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
            sx={{ minWidth: { xs: "100%", sm: 240 }, flex: { sm: 1 } }}
          />

          {/* Only rendered once there is a vocabulary to offer: a select whose
              single option is "All genres" is a control that does nothing. */}
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

        {phase === "loading" && (
          <Centered>
            <CircularProgress aria-label="Loading books" />
          </Centered>
        )}

        {phase === "error" && (
          <Centered>
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={retry}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          </Centered>
        )}

        {/* Two empty states, because they mean opposite things. A filter that
            matched nothing is the visitor's own doing and says so; an empty
            shelf is the placeholder this page shipped with, back when there
            was genuinely nothing here. */}
        {phase === "ready" && books.length === 0 && (
          <Centered>
            {filtered ? (
              <Typography sx={{ color: "text.secondary" }}>
                No books match that.
              </Typography>
            ) : (
              <Typewriter text="Coming soon..." />
            )}
          </Centered>
        )}

        {phase === "ready" && books.length > 0 && (
          <Stack sx={{ gap: 3, width: "100%", pb: { xs: 4, sm: 5 } }}>
            <Typography sx={{ fontSize: "13px", color: "text.secondary" }}>
              {count.toLocaleString()} {count === 1 ? "book" : "books"}
            </Typography>

            {/* Grid rather than flex, so the last row's entries keep the column
                width of the rows above instead of stretching to fill it.
                `auto-fill` and a minimum column width mean the count follows
                the viewport without a breakpoint per size. */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  sm: "repeat(auto-fill, minmax(180px, 1fr))",
                },
                gap: { xs: 2, sm: 3 },
              }}
            >
              {books.map((book) => (
                <BookCard key={book.slug} book={book} />
              ))}
            </Box>

            {totalPages > 1 && (
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_event, value) => setPage(value)}
                sx={{ alignSelf: "center" }}
              />
            )}
          </Stack>
        )}
      </Container>
    </Box>
  );
}

export default Books;
