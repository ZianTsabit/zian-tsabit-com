import { Box, Skeleton, Stack, Tooltip, Typography } from "@mui/material";

import { useReactions } from "../services/useReactions";

/** Height of one button, shared by the real thing and the placeholder that
 *  stands in while the bar loads -- so the page does not jump when it lands. */
const BUTTON_HEIGHT = 36;

/** How many placeholders to show while loading. The real list comes from the
 *  API, so this is only ever a guess at its length; it is the current one, and
 *  being one out costs a few pixels of reflow rather than a visible jump. */
const PLACEHOLDERS = 7;

interface ButtonProps {
  emoji: string;
  label: string;
  count: number;
  reacted: boolean;
  disabled: boolean;
  onClick: () => void;
}

/**
 * One emoji and its count.
 *
 * A pill, matching `TagChip` -- the site has no filled buttons anywhere, and a
 * row of them under a post would be the loudest thing on the page. What marks
 * the ones this visitor picked is the same `emphasis` treatment a published
 * post gets in the admin list: the primary colour on the border and the
 * number, not a fill.
 */
function ReactionButton({
  emoji,
  label,
  count,
  reacted,
  disabled,
  onClick,
}: ButtonProps) {
  return (
    <Tooltip title={label}>
      {/* The span is not decoration: MUI's Tooltip attaches its listeners to
          its child, and a disabled button fires none -- so the label would
          vanish for exactly the moment the button is busy. */}
      <Box component="span" sx={{ display: "inline-flex" }}>
        <Box
          component="button"
          type="button"
          onClick={onClick}
          disabled={disabled}
          // The accessible name is the word, not the glyph: a screen reader
          // reads an emoji as whatever its Unicode name happens to be, which
          // for the heart is "heavy black heart".
          aria-label={`${label} (${count})`}
          // A toggle, so it says so -- "pressed" is what tells a screen-reader
          // user that this is one they already left.
          aria-pressed={reacted}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            height: BUTTON_HEIGHT,
            px: 1.5,
            fontFamily: "inherit",
            fontSize: { xs: "14px", sm: "15px" },
            lineHeight: 1,
            cursor: disabled ? "default" : "pointer",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: reacted ? "primary.main" : "divider",
            borderRadius: "999px",
            // Held while its own write is in flight, so a double tap cannot
            // toggle twice; the other buttons dim with it because the hook
            // deliberately runs one write at a time.
            opacity: disabled ? 0.6 : 1,
            transition: "border-color 0.15s ease, opacity 0.15s ease",
            "&:hover": { borderColor: disabled ? undefined : "primary.main" },
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: 2,
            },
          }}
        >
          {/* aria-hidden so the glyph is not read twice: the button's own
              aria-label already says "Celebrate (3)". */}
          <Box component="span" aria-hidden sx={{ fontSize: "17px" }}>
            {emoji}
          </Box>
          <Box
            component="span"
            aria-hidden
            sx={{
              fontSize: "13px",
              fontWeight: reacted ? 600 : 400,
              color: reacted ? "primary.main" : "text.secondary",
            }}
          >
            {count}
          </Box>
        </Box>
      </Box>
    </Tooltip>
  );
}

/**
 * The row of emoji under a post.
 *
 * **The available emoji come from the API, not from here.** The server
 * validates what may be stored, so it is also the thing that decides what may
 * be offered -- a list kept on both sides would eventually offer a button
 * whose taps are rejected. The response is dense (every emoji, zeros included)
 * precisely so this component can render it straight through.
 *
 * There is no error state on purpose: a bar that failed to load looks like one
 * that has not loaded yet, because a post that arrived perfectly well is not
 * worth putting an error banner on over seven emoji. See `useReactions`.
 */
function ReactionBar({ slug }: { slug: string }) {
  const { summary, pending, toggle } = useReactions(slug);

  return (
    <Box component="section" aria-labelledby="reactions-heading">
      <Typography
        id="reactions-heading"
        sx={{ fontSize: { xs: "12px", sm: "13px" }, color: "text.secondary", mb: 1 }}
      >
        {summary && summary.total > 0
          ? `${summary.total.toLocaleString()} ${
              summary.total === 1 ? "reaction" : "reactions"
            }`
          : "Leave a reaction"}
      </Typography>

      <Stack direction="row" sx={{ gap: { xs: 0.75, sm: 1 }, flexWrap: "wrap" }}>
        {summary
          ? summary.reactions.map((reaction) => (
              <ReactionButton
                key={reaction.emoji}
                emoji={reaction.emoji}
                label={reaction.label}
                count={reaction.count}
                reacted={reaction.reacted}
                // Every button holds while any write is in flight, since the
                // hook runs them one at a time.
                disabled={pending !== null}
                onClick={() => void toggle(reaction.emoji)}
              />
            ))
          : Array.from({ length: PLACEHOLDERS }, (_unused, index) => (
              <Skeleton
                key={index}
                variant="rounded"
                width={64}
                height={BUTTON_HEIGHT}
                sx={{ borderRadius: "999px" }}
              />
            ))}
      </Stack>
    </Box>
  );
}

export default ReactionBar;
