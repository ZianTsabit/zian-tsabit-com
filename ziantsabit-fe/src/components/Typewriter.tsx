import React from "react";
import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledBox = styled(Box)`
  &.typewriter-effect {
    display: flex;
    justify-content: center;
    width: 100%;
    max-width: 100%;
  }

  /*
   * The track is a one-cell grid holding two stacked copies of the text: a
   * hidden one in ::before that sizes the cell to the text's real rendered
   * width, and the visible one whose width animates from 0 to exactly 100% of
   * that cell. Measuring in ch would be wrong -- the text is set in Ubuntu,
   * which is proportional, so character count says nothing about how wide the
   * text actually is, and the reveal box ended up wider than its own text.
   * Because the track keeps the full width for the whole animation, the text
   * stays put under the container's centering instead of drifting left.
   */
  &.typewriter-effect > .track {
    display: inline-grid;
    max-width: 100%;
    overflow: hidden;
  }

  &.typewriter-effect > .track::before {
    content: attr(data-text);
    grid-area: 1 / 1;
    white-space: pre;
    visibility: hidden;
  }

  &.typewriter-effect > .track > .text {
    grid-area: 1 / 1;
    width: 0;
    white-space: pre;
    overflow: hidden;
    animation: typing 3s steps(var(--characters)) infinite;
  }

  @keyframes typing {
    75%,
    100% {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &.typewriter-effect > .track > .text {
      width: 100%;
      animation: none;
    }
  }
`;

interface CustomStyles extends React.CSSProperties {
  "--characters": number | string;
}

interface TypewriterProps {
  text?: string;
}

function Typewriter({ text = "Typewriter Effect" }: TypewriterProps) {
  const styles: CustomStyles = {
    "--characters": text.length,
  };

  return (
    <StyledBox className="typewriter-effect">
      {/* The font has to sit here rather than on .text, so the hidden ::before
          copy measures the same glyphs the visible copy renders. */}
      <Box
        className="track"
        data-text={text}
        sx={{
          fontFamily: "'Ubuntu', sans-serif",
          color: "text.primary",
          // Scales smoothly between the old 18px and 22px endpoints instead of
          // stepping at lg, so it tracks the viewport at every width between.
          fontSize: "clamp(1.125rem, 1rem + 0.6vw, 1.375rem)",
        }}
      >
        <Box style={styles} className="text" id="typewriter-text">
          {text}
        </Box>
      </Box>
    </StyledBox>
  );
}

export default Typewriter;
