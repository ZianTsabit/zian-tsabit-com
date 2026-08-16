import { useState, type KeyboardEvent } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";

interface FlipPhotoProps {
  frontSrc: string;
  backSrc: string;
  alt: string;
  size: { xs: number; sm: number };
  sx?: SxProps<Theme>;
}

const faceStyle: SxProps<Theme> = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
  border: "1px solid",
  borderColor: "divider",
  // The face not currently facing the viewer would otherwise still show
  // through mirrored, since a rotated element is still painted by default.
  backfaceVisibility: "hidden",
};

/**
 * Circular photo that flips in place on click, front and back like a playing
 * card -- the About portrait flips between the avatar and the formal photo.
 */
function FlipPhoto({ frontSrc, backSrc, alt, size, sx }: FlipPhotoProps) {
  const [flipped, setFlipped] = useState(false);

  const toggle = () => setFlipped((current) => !current);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Space/Enter activate a native <button>; this has to do it by hand since
    // it's a div playing the "button" role.
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  };

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`Flip photo of ${alt}`}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        // The 3D depth the flip rotates through; too small and the flip looks
        // like a flat squash instead of a turn.
        perspective: "800px",
        cursor: "pointer",
        outline: "none",
        "&:focus-visible": {
          outlineStyle: "solid",
          outlineWidth: "2px",
          outlineOffset: "2px",
          outlineColor: "primary.main",
        },
        ...sx,
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 0.6s",
          transform: flipped ? "rotateY(180deg)" : "none",
        }}
      >
        <Box component="img" src={frontSrc} alt={alt} sx={faceStyle} />
        <Box
          component="img"
          src={backSrc}
          alt={alt}
          sx={{ ...faceStyle, transform: "rotateY(180deg)" }}
        />
      </Box>
    </Box>
  );
}

export default FlipPhoto;
