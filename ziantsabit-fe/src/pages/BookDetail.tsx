import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from "@mui/material";

import Centered from "../components/Centered";
import Markdown from "../components/Markdown";
import { TagChipRow } from "../components/TagChip";
import Typewriter from "../components/Typewriter";
import { formatIsbn, formatYear } from "../services/books";
import { useBook } from "../services/useBook";
import { MONO_FONT } from "../theme";

/** One line of the facts column. Rendered as a definition list rather than a
 *  table: it is a handful of labelled values, and a table would promise
 *  columns that line up across rows there are none of. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography
        component="dt"
        sx={{ fontSize: "12px", color: "text.secondary", mb: 0.25 }}
      >
        {label}
      </Typography>
      <Typography component="dd" sx={{ m: 0, fontSize: "14px", color: "text.primary" }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * One catalogue entry in full: the jacket and the facts beside the review.
 *
 * Deliberately not `PostDetail` with different fields. A post leads with a
 * title and a date and then runs straight into its body; a book entry has to
 * establish *which book this is* before any of the owner's opinion of it is
 * worth reading, which is what the facts column is for.
 *
 * No view counter, unlike a post: `/api/books/` has nothing to count, on
 * purpose. How often a shelf entry is looked at says nothing about the book.
 */
function BookDetail() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { book, phase, error, retry } = useBook(slug);

  return (
    <Box
      sx={{
        width: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "transparent",
        alignItems: "center",
        pt: { xs: 2, sm: 3 },
      }}
    >
      <Container
        maxWidth="md"
        sx={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        <Box
          component={Link}
          to="/books"
          sx={{
            alignSelf: "flex-start",
            mb: 2,
            fontSize: { xs: "13px", sm: "14px" },
            color: "primary.main",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          ← Back to Books
        </Box>

        {phase === "loading" && (
          <Centered>
            <CircularProgress aria-label="Loading book" />
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

        {phase === "not-found" && (
          <Centered>
            <Typewriter text="Book not found..." />
          </Centered>
        )}

        {phase === "ready" && book && (
          <Stack sx={{ gap: 3, pb: 4 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: { xs: 2, sm: 4 }, alignItems: "flex-start" }}
            >
              {book.cover_image_url && (
                <Box
                  component="img"
                  src={book.cover_image_url}
                  alt={book.cover_image_alt}
                  sx={{
                    // Fixed width from `sm` up so the facts beside it always
                    // get the same column, whatever shape the jacket is. On a
                    // phone it is centred at a readable size rather than
                    // filling the width -- a full-bleed cover would push the
                    // title itself below the fold.
                    width: { xs: 160, sm: 200 },
                    alignSelf: { xs: "center", sm: "flex-start" },
                    flexShrink: 0,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    // A transparent PNG would otherwise vanish into the page.
                    bgcolor: "background.paper",
                  }}
                />
              )}

              {/* minWidth: 0 so a long title shrinks this column rather than
                  pushing the entry wider than the page. */}
              <Stack sx={{ gap: 1.5, minWidth: 0, flex: 1 }}>
                <Typography
                  component="h1"
                  sx={{
                    fontWeight: "bold",
                    fontSize: { xs: "22px", sm: "28px" },
                    color: "text.primary",
                  }}
                >
                  {book.title}
                </Typography>

                <Typography
                  sx={{
                    fontSize: { xs: "15px", sm: "17px" },
                    color: "text.secondary",
                  }}
                >
                  {book.author}
                </Typography>

                {book.genres.length > 0 && <TagChipRow labels={book.genres} />}

                <Box
                  component="dl"
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: { xs: 2, sm: 3 },
                    m: 0,
                    mt: 0.5,
                  }}
                >
                  <Fact label="Released" value={formatYear(book.release_year)} />
                  {/* Only when there is one. An "ISBN: —" line is a row of the
                      table saying nothing, and most of a personal shelf has no
                      ISBN recorded. */}
                  {book.isbn && (
                    <Box>
                      <Typography
                        component="dt"
                        sx={{ fontSize: "12px", color: "text.secondary", mb: 0.25 }}
                      >
                        ISBN
                      </Typography>
                      <Typography
                        component="dd"
                        sx={{
                          m: 0,
                          // Monospaced so the digits can be checked against a
                          // book in hand a group at a time.
                          fontFamily: MONO_FONT,
                          fontSize: "14px",
                          color: "text.primary",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {formatIsbn(book.isbn)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Stack>
            </Stack>

            {/* The review is Markdown, through the same renderer post bodies
                use -- there is one renderer on the site. An entry with no
                review is a perfectly good catalogue row, so it simply ends
                after the facts rather than showing an empty heading. */}
            {book.review && (
              <Box>
                <Typography
                  component="h2"
                  sx={{
                    fontWeight: "bold",
                    fontSize: { xs: "16px", sm: "18px" },
                    color: "text.primary",
                    mb: 1,
                  }}
                >
                  Notes
                </Typography>
                <Markdown>{book.review}</Markdown>
              </Box>
            )}
          </Stack>
        )}
      </Container>
    </Box>
  );
}

export default BookDetail;
