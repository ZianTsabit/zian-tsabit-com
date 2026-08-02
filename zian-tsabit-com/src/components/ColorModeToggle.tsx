import { useEffect, useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";

function ColorModeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const [mounted, setMounted] = useState(false);

  // `mode` is undefined until the provider has read localStorage, so the first
  // render must not commit to an icon or it can flash the wrong one.
  useEffect(() => setMounted(true), []);

  const resolved = mode === "system" ? systemMode : mode;

  if (!mounted || !resolved) {
    // Same footprint as the real button, so nothing shifts when it appears.
    return <IconButton disabled sx={{ p: 1, visibility: "hidden" }}><DarkModeIcon /></IconButton>;
  }

  const next = resolved === "dark" ? "light" : "dark";

  return (
    <Tooltip title={`Switch to ${next} mode`}>
      <IconButton
        onClick={() => setMode(next)}
        aria-label={`Switch to ${next} mode`}
        sx={{ p: 1, color: "text.primary" }}
      >
        {resolved === "dark" ? (
          <DarkModeIcon fontSize="small" />
        ) : (
          <LightModeIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}

export default ColorModeToggle;
