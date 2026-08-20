import { Link } from "react-router-dom";
import { Box, Stack, Typography } from "@mui/material";

import { TagChipRow } from "./TagChip";
import { toPlainText } from "./markdownText";
import { formatYear, type Book } from "../services/books";

/**
 * One shelf entry: jacket, title, author, year, genres, and the opening of the
 * review.
 *
 * The jacket leads rather than being optional trim, because a shelf is scanned
 * by spine and cover before it is read -- which is the difference between this
 * and `PostCard`, where the image is a nicety a post may not have. An entry
 * with no cover keeps its place in the grid by rendering a plate with the title
 * on it, so the rows stay aligned instead of collapsing around the gap.
 *
 * Like `PostCard`, the entry is not itself a link: only the title is. A block
 * wrapped in an anchor cannot hold anything else selectable, and it gives a
 * screen reader one enormous link named after every word in the entry.
 */
function BookCard({ book }: { book: Book }) {
  const to = `/books/${encodeURIComponent(book.slug)}`;
  const text = toPlainText(book.review);

  return (
    <Box component="article" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box
        component={Link}
        to={to}
        aria-label={`${book.title} by ${book.author}`}
        sx={{
          display: "block",
          // 2:3 is the shape of a paperback, so a grid of these is a row of
          // spines rather than a row of thumbnails at whatever aspect ratio
          // each jacket happened to be scanned at.
          aspectRatio: "2 / 3",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          textDecoration: "none",
          position: "relative",
        }}
      >
        {book.cover_image_url ? (
          <Box
            component="img"
            src={book.cover_image_url}
            // Blank alt marks it decorative, which is honest: the title and
            // author are right underneath in text. An entry whose alt was
            // filled in gets what was written.
            alt={book.cover_image_alt}
            loading="lazy"
            sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          // The stand-in is the book's own title set on a plain plate, which
          // is roughly what an unjacketed book looks like on a shelf -- and
          // far more use than a generic placeholder glyph.
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 2,
              textAlign: "center",
            }}
          >
            <Typography
              sx={{
                fontSize: { xs: "13px", sm: "15px" },
                fontWeight: 600,
                color: "text.secondary",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 5,
                overflow: "hidden",
              }}
            >
              {book.title}
            </Typography>
          </Box>
        )}
      </Box>

      <Stack sx={{ gap: 0.5, minWidth: 0 }}>
        <Box
          component={Link}
          to={to}
          sx={{
            fontWeight: "bold",
            fontSize: { xs: "15px", sm: "16px" },
            color: "text.primary",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {book.title}
        </Box>

        <Typography sx={{ fontSize: { xs: "13px", sm: "14px" }, color: "text.primary" }}>
          {book.author}
        </Typography>

        <Typography sx={{ fontSize: "12px", color: "text.secondary" }}>
          {formatYear(book.release_year)}
        </Typography>

        {book.genres.length > 0 && <TagChipRow labels={book.genres} />}

        {text && (
          <Typography
            sx={{
              fontSize: { xs: "13px", sm: "14px" },
              color: "text.secondary",
              mt: 0.5,
              whiteSpace: "pre-line",
              // Two lines: this is a grid of entries, and a card that grows to
              // fit its review would pull its whole row out of alignment.
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
            }}
          >
            {text}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export default BookCard;
