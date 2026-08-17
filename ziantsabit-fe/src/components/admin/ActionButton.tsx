import type { ReactNode } from "react";
import Button from "@mui/material/Button";

const TONE_COLOURS = {
  primary: "primary.main",
  neutral: "text.primary",
  danger: "error.main",
} as const;

interface Props {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Rendered before the label, at the label's size. */
  startIcon?: ReactNode;
  /** Colour, and nothing else -- size, weight and geometry are the same in all
   *  three. `neutral` is the page's own ink, `danger` is for what cannot be
   *  taken back. */
  tone?: "primary" | "neutral" | "danger";
  "aria-label"?: string;
}

/**
 * Every action in the admin: New post, Save as draft, Publish, Edit, Unpublish,
 * Delete.
 *
 * One component because they were six different-looking controls doing the same
 * kind of thing -- a filled Publish, a grey Save, a blue Edit, a red Delete,
 * two sizes between them -- which made the admin look assembled rather than
 * designed. Reuse it for a new action rather than reaching for `<Button>`.
 *
 * The style is the site's own: a text link, no surface, no border, no shadow,
 * because the site has none of those anywhere. What keeps it reading as an
 * action rather than as prose is the weight and an underline on hover and
 * focus. Capitals are off site-wide, in `theme.ts`.
 *
 * **Emphasis is position, not decoration.** No variant here is louder than
 * another, so the primary action of a page is the last one in its row -- which
 * is where it already was when it was the filled one.
 */
function ActionButton({
  children,
  onClick,
  disabled,
  startIcon,
  tone = "primary",
  "aria-label": ariaLabel,
}: Props) {
  return (
    <Button
      variant="text"
      onClick={onClick}
      disabled={disabled}
      startIcon={startIcon}
      aria-label={ariaLabel}
      sx={{
        flexShrink: 0,
        // Nearly flush with the edge of whatever column it ends a row in, like
        // `Sign out` in AdminNav: a button's worth of padding would leave the
        // label visibly short of the margin everything else is aligned to.
        px: 0.5,
        minWidth: 0,
        fontWeight: 600,
        // Colour is the only thing a tone changes -- same size, same weight,
        // same geometry -- so Delete belongs to the set while still being the
        // one you cannot take back.
        //
        // `neutral` is `text.primary`, never a black literal: that token is
        // near-black on the light scheme and bone white on the dark one, and a
        // hardcoded black would be an invisible button on the dark page. See
        // the palette rules in CLAUDE.md.
        color: TONE_COLOURS[tone],
        // MUI sizes a start icon at 20px and spaces it for a filled button;
        // both are a shade heavy next to text this size.
        "& .MuiButton-startIcon": { mr: 0.5 },
        "& .MuiButton-startIcon > *": { fontSize: 18 },
        // The tinted wash a text button paints on hover would put back the
        // surface this is meant not to have.
        "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
        "&:focus-visible": {
          bgcolor: "transparent",
          textDecoration: "underline",
          outline: "2px solid",
          // Follows `color`, so the danger tone is not ringed in blue.
          outlineColor: "currentcolor",
          outlineOffset: 2,
        },
      }}
    >
      {children}
    </Button>
  );
}

export default ActionButton;
