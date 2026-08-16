import {
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Alert,
  Box,
  CircularProgress,
  FormHelperText,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import ImageIcon from "@mui/icons-material/Image";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import LinkIcon from "@mui/icons-material/Link";
import TitleIcon from "@mui/icons-material/Title";

import Markdown from "../Markdown";
import { ApiError } from "../../services/api";
import { ACCEPT_ATTRIBUTE, uploadImage } from "../../services/uploads";
import { MONO_FONT } from "../../theme";
import {
  BULLET,
  continueList,
  HEADING,
  indent,
  insertImage,
  insertLink,
  ORDERED,
  QUOTE,
  toggleCode,
  toggleLinePrefix,
  toggleWrap,
  type Edit,
} from "./markdownCommands";

// Only affects what the tooltips say, so a rough sniff is enough.
const MOD = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent)
  ? "⌘"
  : "Ctrl";

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  helperText?: ReactNode;
  minRows?: number;
}

/**
 * Body editor: a Write tab over the raw Markdown and a Preview tab that renders
 * it with the very same `Markdown` component the published page uses, so what
 * the preview shows is what the post will look like -- not an approximation of
 * it that can drift.
 */
function MarkdownEditor({
  value,
  onChange,
  error,
  helperText,
  minRows = 12,
}: Props) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Set by Escape, cleared by anything else. See the Tab handling below.
  const tabReleased = useRef(false);

  const fileRef = useRef<HTMLInputElement>(null);
  // Where the image will be inserted. Captured before the file dialog opens:
  // the dialog takes focus, and a textarea that has lost focus reports
  // selectionStart === selectionEnd === 0 in some browsers, which would drop
  // every upload at the very top of the body.
  const insertAt = useRef<{ start: number; end: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const apply = (edit: Edit) => {
    const el = inputRef.current;
    if (!el) return;

    el.focus();
    el.setSelectionRange(edit.start, edit.end);

    // Deprecated, and still the only way to make a programmatic edit that the
    // browser's own undo stack knows about. Without it, Ctrl+Z after clicking
    // a toolbar button throws away everything typed rather than that one edit.
    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, edit.text);
    } catch {
      inserted = false;
    }

    if (inserted) {
      // React re-renders from the input event execCommand fired; the value it
      // renders is identical, so the caret set here survives.
      el.setSelectionRange(edit.selectStart, edit.selectEnd);
    } else {
      // Undo history is lost on this path, but the edit still lands.
      onChange(el.value.slice(0, edit.start) + edit.text + el.value.slice(edit.end));
    }

    // The fallback updates through React, so the caret has to wait for that
    // render before it can be placed.
    requestAnimationFrame(() => {
      el.setSelectionRange(edit.selectStart, edit.selectEnd);
    });
  };

  /** Run a command against the current selection. */
  const run = (command: (value: string, start: number, end: number) => Edit | null) => {
    const el = inputRef.current;
    if (!el) return;
    const edit = command(el.value, el.selectionStart, el.selectionEnd);
    if (edit) apply(edit);
  };

  /** Toolbar button: remember the caret, then open the file dialog. */
  const pickImage = () => {
    const el = inputRef.current;
    insertAt.current = el
      ? { start: el.selectionStart, end: el.selectionEnd }
      : null;
    setUploadError(null);
    fileRef.current?.click();
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clearing it here rather than after the upload means picking the same file
    // twice in a row still fires a change event the second time.
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const { url } = await uploadImage(file);
      const el = inputRef.current;
      const at = insertAt.current ??
        (el ? { start: el.value.length, end: el.value.length } : { start: 0, end: 0 });
      // The alt text is left to the author; insertImage parks the caret between
      // the brackets so it is the next thing they type.
      apply(insertImage(el?.value ?? value, at.start, at.end, url));
    } catch (failure: unknown) {
      setUploadError(
        failure instanceof ApiError || failure instanceof Error
          ? failure.message
          : "Could not upload that image.",
      );
    } finally {
      setUploading(false);
      insertAt.current = null;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const mod = event.metaKey || event.ctrlKey;

    if (event.key === "Escape") {
      // Escape arms the next Tab to move focus instead of indenting. Without
      // an opt-out, trapping Tab would strand a keyboard-only user in the
      // textarea with no way to reach the Save button.
      tabReleased.current = true;
      return;
    }

    if (mod && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === "b") {
        event.preventDefault();
        run((v, s, e) => toggleWrap(v, s, e, "**"));
        return;
      }
      if (key === "i") {
        event.preventDefault();
        run((v, s, e) => toggleWrap(v, s, e, "*"));
        return;
      }
      if (key === "k") {
        event.preventDefault();
        run(insertLink);
        return;
      }
    }

    if (event.key === "Tab") {
      if (tabReleased.current) {
        tabReleased.current = false;
        return; // let the browser move focus
      }
      event.preventDefault();
      run((v, s, e) => indent(v, s, e, event.shiftKey));
      return;
    }

    if (event.key === "Enter" && !mod && !event.shiftKey) {
      const el = inputRef.current;
      if (!el) return;
      const edit = continueList(el.value, el.selectionStart, el.selectionEnd);
      // Ordinary prose returns null: leave Enter alone so it stays a plain
      // newline, undo and all.
      if (edit) {
        event.preventDefault();
        apply(edit);
      }
      tabReleased.current = false;
      return;
    }

    tabReleased.current = false;
  };

  const tools = [
    {
      key: "bold",
      title: `Bold (${MOD}+B)`,
      icon: <FormatBoldIcon fontSize="small" />,
      run: () => run((v, s, e) => toggleWrap(v, s, e, "**")),
    },
    {
      key: "italic",
      title: `Italic (${MOD}+I)`,
      icon: <FormatItalicIcon fontSize="small" />,
      run: () => run((v, s, e) => toggleWrap(v, s, e, "*")),
    },
    {
      key: "heading",
      title: "Heading",
      icon: <TitleIcon fontSize="small" />,
      run: () => run((v, s, e) => toggleLinePrefix(v, s, e, HEADING.pattern, HEADING.make)),
    },
    {
      key: "link",
      title: `Link (${MOD}+K)`,
      icon: <LinkIcon fontSize="small" />,
      run: () => run(insertLink),
    },
    {
      key: "image",
      title: "Insert image",
      icon: uploading ? (
        <CircularProgress size={18} aria-label="Uploading image" />
      ) : (
        <ImageIcon fontSize="small" />
      ),
      run: pickImage,
    },
    {
      key: "bullet",
      title: "Bulleted list",
      icon: <FormatListBulletedIcon fontSize="small" />,
      run: () => run((v, s, e) => toggleLinePrefix(v, s, e, BULLET.pattern, BULLET.make)),
    },
    {
      key: "ordered",
      title: "Numbered list",
      icon: <FormatListNumberedIcon fontSize="small" />,
      run: () => run((v, s, e) => toggleLinePrefix(v, s, e, ORDERED.pattern, ORDERED.make)),
    },
    {
      key: "quote",
      title: "Quote",
      icon: <FormatQuoteIcon fontSize="small" />,
      run: () => run((v, s, e) => toggleLinePrefix(v, s, e, QUOTE.pattern, QUOTE.make)),
    },
    {
      key: "code",
      title: "Code",
      icon: <CodeIcon fontSize="small" />,
      run: () => run(toggleCode),
    },
  ];

  return (
    <Box>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
          mb: 1,
        }}
      >
        <Typography
          component="span"
          sx={{ fontSize: "13px", color: error ? "error.main" : "text.secondary" }}
        >
          Body
        </Typography>

        <Tabs
          value={tab}
          onChange={(_event, next) => setTab(next)}
          sx={{ minHeight: 0, "& .MuiTab-root": { minHeight: 0, py: 1 } }}
        >
          <Tab value="write" label="Write" />
          <Tab value="preview" label="Preview" />
        </Tabs>
      </Stack>

      {tab === "write" ? (
        <>
          <Stack
            direction="row"
            sx={{
              flexWrap: "wrap",
              gap: 0.5,
              mb: 1,
              p: 0.5,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            {tools.map((tool) => (
              <Tooltip key={tool.key} title={tool.title}>
                {/* A disabled IconButton fires no events, so Tooltip needs a
                    wrapper it can listen on to keep explaining the button. */}
                <Box component="span" sx={{ display: "inline-flex" }}>
                  <IconButton
                    size="small"
                    aria-label={tool.title}
                    disabled={tool.key === "image" && uploading}
                    // The button must not steal focus, or the selection the
                    // command is about to act on is gone by the time it runs.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={tool.run}
                  >
                    {tool.icon}
                  </IconButton>
                </Box>
              </Tooltip>
            ))}
          </Stack>

          {/* Outside the toolbar so its layout never shifts. Kept mounted
              rather than rendered on demand, since the click that opens it
              comes from the toolbar button above. */}
          <Box
            component="input"
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            ref={fileRef}
            onChange={handleFile}
            sx={{ display: "none" }}
          />

          {uploadError && (
            <Alert
              severity="error"
              onClose={() => setUploadError(null)}
              sx={{ mb: 1 }}
            >
              {uploadError}
            </Alert>
          )}

          <TextField
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            inputRef={inputRef}
            error={error}
            multiline
            minRows={minRows}
            fullWidth
            slotProps={{
              // Monospace, because the whole point of the Write tab is seeing
              // the syntax line up.
              input: { sx: { fontFamily: MONO_FONT, fontSize: "14px" } },
            }}
          />
        </>
      ) : (
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: 2,
            // Roughly a full textarea, so switching tabs does not jump the
            // page around under the Save button.
            minHeight: minRows * 24,
          }}
        >
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <Typography sx={{ color: "text.secondary", fontStyle: "italic" }}>
              Nothing to preview yet.
            </Typography>
          )}
        </Box>
      )}

      {helperText && (
        <FormHelperText error={error} sx={{ mx: 1.75 }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  );
}

export default MarkdownEditor;
