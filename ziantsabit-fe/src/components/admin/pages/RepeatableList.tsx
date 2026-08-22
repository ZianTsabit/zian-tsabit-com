import { useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CloseIcon from "@mui/icons-material/Close";

import ActionButton from "../ActionButton";

interface Props<T> {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  /** A fresh item for the Add button. A factory, not a constant: two items
   *  sharing one object would edit each other. */
  create: () => T;
  addLabel: string;
  /** The heading shown on a row's own bar, so a collapsed-looking list of
   *  cards can still be told apart at a glance. Falls back to a number. */
  titleOf: (item: T, index: number) => string;
  children: (item: T, replace: (next: T) => void, index: number) => ReactNode;
  /** Shown in place of the rows when there are none. */
  emptyText: string;
}

/**
 * A list of editable records with add, remove and reorder.
 *
 * Every repeated thing on the two page editors is one of these -- CV
 * experience, projects, education, skill groups, header links, About sections
 * -- so the controls behave identically across all of them rather than each
 * section growing its own slightly different set.
 *
 * **Order is the content's order, and it is edited by moving rows.** A CV is
 * read top to bottom and the newest job goes first; there is no date field
 * reliable enough to sort on (`duration` is free text like "June 2025 -
 * Present"), so the arrows are how the author says what comes first. Both are
 * disabled at the ends rather than hidden, so the row of controls does not
 * change width as you move a card up a list.
 *
 * **Removing a row with anything in it asks first.** Autosave writes the
 * deletion within three seconds and there is no draft copy of a page to
 * recover from, so a mis-clicked X on a job entry is a real loss -- the same
 * reasoning behind the post list's delete dialog. A row that is still blank is
 * removed outright: confirming the disposal of nothing is pure friction, and a
 * blank row is what the Add button leaves behind when someone changes their
 * mind.
 *
 * **Rows are keyed by index, deliberately.** The usual objection is that index
 * keys break when a list is reordered -- but here the *value at* an index is
 * what a row shows, and reordering swaps those values, so an index key is the
 * one thing that keeps the DOM in step with what is on screen. There is no
 * stable id to key by either: these records are fields in a JSON document, not
 * database rows.
 */
function RepeatableList<T>({
  label,
  items,
  onChange,
  create,
  addLabel,
  titleOf,
  children,
  emptyText,
}: Props<T>) {
  // The row a confirmation is open for. `null` is closed -- 0 is a valid
  // index, so a plain falsiness check would leave the first row unguarded.
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);

  const replaceAt = (index: number, next: T) =>
    onChange(items.map((item, position) => (position === index ? next : item)));

  const removeAt = (index: number) => {
    onChange(items.filter((_item, position) => position !== index));
    setPendingRemoval(null);
  };

  const requestRemoval = (index: number) => {
    // An empty row has nothing to lose, so it goes without a question.
    if (titleOf(items[index], index)) setPendingRemoval(index);
    else removeAt(index);
  };

  const move = (index: number, by: number) => {
    const target = index + by;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <Stack sx={{ gap: 1.5 }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
      >
        <Typography
          component="div"
          sx={{ fontWeight: 600, fontSize: "15px", color: "text.primary" }}
        >
          {label}
        </Typography>
        <ActionButton onClick={() => onChange([...items, create()])}>
          + {addLabel}
        </ActionButton>
      </Stack>

      {items.length === 0 && (
        <Typography sx={{ fontSize: "14px", color: "text.secondary" }}>
          {emptyText}
        </Typography>
      )}

      {items.map((item, index) => (
        <Box
          key={index}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: { xs: 1.5, sm: 2 },
          }}
        >
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5 }}
          >
            <Typography
              sx={{
                fontSize: "13px",
                color: "text.secondary",
                fontWeight: 600,
                // A long job title must not push the controls off the card.
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {titleOf(item, index) || `Untitled ${index + 1}`}
            </Typography>
            <Stack direction="row" sx={{ flexShrink: 0 }}>
              <Tooltip title="Move up">
                {/* The span is what carries the tooltip when the button is
                    disabled: MUI attaches its listeners to the child, and a
                    disabled button fires none. Same reason `ReactionButton`
                    wraps one. */}
                <span>
                  <IconButton
                    size="small"
                    aria-label={`Move ${label} item ${index + 1} up`}
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
                    aria-label={`Move ${label} item ${index + 1} down`}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Remove">
                <IconButton
                  size="small"
                  aria-label={`Remove ${label} item ${index + 1}`}
                  onClick={() => requestRemoval(index)}
                  sx={{ color: "error.main" }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {children(item, (next) => replaceAt(index, next), index)}
        </Box>
      ))}

      <Dialog open={pendingRemoval !== null} onClose={() => setPendingRemoval(null)}>
        <DialogTitle>Remove this entry?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingRemoval !== null &&
              `"${titleOf(items[pendingRemoval], pendingRemoval)}" will be removed from ${label}. The page saves itself, so this goes live in a few seconds.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setPendingRemoval(null)}>
            Cancel
          </Button>
          <Button
            color="error"
            onClick={() => pendingRemoval !== null && removeAt(pendingRemoval)}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default RepeatableList;
