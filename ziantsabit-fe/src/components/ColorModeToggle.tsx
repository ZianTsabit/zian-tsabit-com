import { useState, type MouseEvent } from "react";
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import ThunderstormIcon from "@mui/icons-material/Thunderstorm";

import {
  SITE_THEMES,
  THEME_LABELS,
  useSiteTheme,
  type SiteTheme,
} from "../services/useSiteTheme";

const ICONS: Record<SiteTheme, typeof LightModeIcon> = {
  light: LightModeIcon,
  dark: DarkModeIcon,
  rain: ThunderstormIcon,
};

/**
 * The theme picker in the header.
 *
 * **A menu rather than the toggle this used to be.** With two schemes a single
 * button was right: it showed the current one and pressing it meant "the other
 * one". With three there is no "the other one" -- a button would have to cycle,
 * which makes reaching a specific theme a guessing game, and its icon could no
 * longer say what pressing it would do.
 */
function ColorModeToggle() {
  const { theme, setTheme } = useSiteTheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const open = (event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget);
  const close = () => setAnchor(null);

  const choose = (next: SiteTheme) => {
    setTheme(next);
    close();
  };

  if (!theme) {
    // `useColorScheme` has not read storage yet, so committing to an icon here
    // can flash the wrong one. Same footprint as the real button, so nothing
    // shifts when it appears.
    return (
      <IconButton disabled sx={{ p: 1, visibility: "hidden" }}>
        <DarkModeIcon />
      </IconButton>
    );
  }

  const Icon = ICONS[theme];

  return (
    <>
      <Tooltip title={`Theme: ${THEME_LABELS[theme]}`}>
        <IconButton
          onClick={open}
          aria-label={`Change theme, currently ${THEME_LABELS[theme]}`}
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          sx={{ p: 1, color: "text.primary" }}
        >
          <Icon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        slotProps={{ paper: { sx: { bgcolor: "background.paper", backgroundImage: "none" } } }}
      >
        {SITE_THEMES.map((option) => {
          const OptionIcon = ICONS[option];
          return (
            <MenuItem
              key={option}
              selected={option === theme}
              onClick={() => choose(option)}
            >
              <ListItemIcon sx={{ color: "inherit" }}>
                <OptionIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{THEME_LABELS[option]}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

export default ColorModeToggle;
