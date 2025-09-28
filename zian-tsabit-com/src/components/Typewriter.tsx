import React from "react";
import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledBox = styled(Box)`
  &.typewriter-effect {
    display: flex;
    justify-content: center;
    font-family: monospace;
  }

  &.typewriter-effect > .text {
    max-width: 0;
    animation: typing 3s steps(var(--characters)) infinite;
    white-space: nowrap;
    overflow: hidden;
  }

  &.typewriter-effect:after {
    content: " ";
    animation: blink 1s infinite;
    animation-timing-function: step-end;
  }

  @keyframes typing {
    75%,
    100% {
      max-width: calc(var(--characters) * 1ch);
    }
  }

  @keyframes blink {
    0%,
    75%,
    100% {
      opacity: 1;
    }
    25% {
      opacity: 0;
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
      <Box 
        style={styles} 
        className="text" 
        id="typewriter-text"
        sx={{ fontFamily: "'Ubuntu', sans-serif", color: "white", fontSize: { xs: "18px", sm: "18px", md: "18px", lg: "22px" } }}>
        {text}
      </Box>
    </StyledBox>
  );
}

export default Typewriter;