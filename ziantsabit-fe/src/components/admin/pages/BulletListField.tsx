import { Box, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CloseIcon from "@mui/icons-material/Close";

import ActionButton from "../ActionButton";

interface Props {
  label: string;
  points: string[];
  onChange: (points: string[]) => void;
  helperText?: string;
}

/**
 * The bullets under one CV entry.
 *
 * A column of multiline text fields rather than one textarea of newline-
 * separated lines, which was the other obvious shape. A CV bullet routinely
 * runs to four or five lines of prose, so "one line per bullet" stops being a
 * useful way to read the box the moment the text wraps -- and reordering, which
 * is the thing the author actually does to these, would mean cutting and
 * pasting between lines rather than pressing an arrow.
 *
 * **Not `MarkdownEditor`.** These are Markdown, but only for inline things --
 * a link, a bit of emphasis. That editor is a tabbed Write/Preview surface with
 * a toolbar and a full-screen mode, and stacking five of them inside one entry
 * inside one section would bury the CV under its own chrome. The helper text
 * below the group is what says Markdown works here.
 *
 * Blank bullets are kept while typing and dropped by the API on save, so a
 * freshly added empty field does not vanish under the cursor.
 */
function BulletListField({ label, points, onChange, helperText }: Props) {
  const move = (index: number, by: number) => {
    const target = index + by;
    if (target < 0 || target >= points.length) return;
    const next = [...points];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <Stack sx={{ gap: 1 }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
      >
        <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "text.secondary" }}>
          {label}
        </Typography>
        <ActionButton onClick={() => onChange([...points, ""])}>+ Add bullet</ActionButton>
      </Stack>

      {points.map((point, index) => (
        // Index key for the same reason as `RepeatableList`: the value at an
        // index is what the row shows, and reordering swaps those values.
        <Stack key={index} direction="row" sx={{ gap: 0.5, alignItems: "flex-start" }}>
          <TextField
            value={point}
            onChange={(event) =>
              onChange(
                points.map((existing, position) =>
                  position === index ? event.target.value : existing,
                ),
              )
            }
            label={`Bullet ${index + 1}`}
            multiline
            minRows={2}
            fullWidth
            size="small"
          />
          <Stack sx={{ flexShrink: 0 }}>
            <Tooltip title="Move up">
              <span>
                <IconButton
                  size="small"
                  aria-label={`Move bullet ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move down">
              <span>
                <IconButton
                  size="small"
                  aria-label={`Move bullet ${index + 1} down`}
                  disabled={index === points.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Remove bullet">
              <IconButton
                size="small"
                aria-label={`Remove bullet ${index + 1}`}
                onClick={() =>
                  onChange(points.filter((_point, position) => position !== index))
                }
                sx={{ color: "error.main" }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      ))}

      {helperText && (
        <Box sx={{ fontSize: "12px", color: "text.secondary" }}>{helperText}</Box>
      )}
    </Stack>
  );
}

export default BulletListField;
