/**
 * The text transforms behind the Markdown editor's toolbar and key handling.
 *
 * Every one of them is pure and describes an edit as a *splice* -- which range
 * of the current value to replace, with what, and where to leave the caret --
 * rather than returning a whole new string. That shape is what lets the editor
 * apply them through `document.execCommand("insertText")`, which keeps the
 * browser's native undo stack intact. Assigning a fresh value straight to the
 * textarea would make Ctrl+Z wipe the entire field instead of stepping back
 * one edit.
 */

export interface Edit {
  /** Range in the current value that `text` replaces. */
  start: number;
  end: number;
  text: string;
  /** Where to leave the selection afterwards, as offsets in the new value. */
  selectStart: number;
  selectEnd: number;
}

/** Two spaces: deep enough to nest a list, narrow enough not to eat the line. */
const INDENT = "  ";

function lineStart(value: string, index: number): number {
  return value.lastIndexOf("\n", index - 1) + 1;
}

function lineEnd(value: string, index: number): number {
  const found = value.indexOf("\n", index);
  return found === -1 ? value.length : found;
}

/**
 * Wrap the selection in `marker`, or unwrap it if it is already wrapped --
 * so the same button both applies and removes bold.
 */
export function toggleWrap(
  value: string,
  start: number,
  end: number,
  marker: string,
): Edit {
  const len = marker.length;
  const selected = value.slice(start, end);

  // Markers inside the selection: **like this**, selected including the stars.
  if (
    selected.length >= 2 * len &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(len, -len);
    return {
      start,
      end,
      text: inner,
      selectStart: start,
      selectEnd: start + inner.length,
    };
  }

  // Markers just outside it: **like this**, with only the words selected.
  if (
    value.slice(start - len, start) === marker &&
    value.slice(end, end + len) === marker
  ) {
    return {
      start: start - len,
      end: end + len,
      text: selected,
      selectStart: start - len,
      selectEnd: start - len + selected.length,
    };
  }

  return {
    start,
    end,
    text: marker + selected + marker,
    // With nothing selected this lands the caret between the two markers, so
    // the next keystroke is already inside the emphasis.
    selectStart: start + len,
    selectEnd: start + len + selected.length,
  };
}

/**
 * Add `make(...)` to the front of every line the selection touches, or strip
 * `pattern` from them if they all already match.
 */
export function toggleLinePrefix(
  value: string,
  start: number,
  end: number,
  pattern: RegExp,
  make: (index: number) => string,
): Edit {
  const from = lineStart(value, start);
  const to = lineEnd(value, end);
  const lines = value.slice(from, to).split("\n");

  // A half-marked block finishes being marked rather than being cleared, which
  // is what someone dragging across a partial list almost always wants.
  const allMarked = lines.every((line) => line.trim() === "" || pattern.test(line));

  const next = lines.map((line, index) =>
    allMarked ? line.replace(pattern, "") : make(index) + line,
  );
  const text = next.join("\n");

  const headDelta = next[0].length - lines[0].length;
  const totalDelta = text.length - (to - from);
  return {
    start: from,
    end: to,
    text,
    selectStart: Math.max(from, start + headDelta),
    selectEnd: Math.max(from, end + totalDelta),
  };
}

export const BULLET = {
  pattern: /^(\s*)[-*+]\s+/,
  make: () => "- ",
};

export const ORDERED = {
  pattern: /^(\s*)\d+[.)]\s+/,
  make: (index: number) => `${index + 1}. `,
};

export const QUOTE = {
  pattern: /^(\s*)>\s?/,
  make: () => "> ",
};

export const HEADING = {
  pattern: /^(\s*)#{1,6}\s+/,
  make: () => "## ",
};

// Anything that already looks like a destination goes in the parentheses
// rather than the brackets.
const URL_LIKE = /^(?:https?:\/\/|mailto:|\/)\S*$/i;

export function insertLink(value: string, start: number, end: number): Edit {
  const selected = value.slice(start, end);

  if (selected && URL_LIKE.test(selected)) {
    return {
      start,
      end,
      text: `[](${selected})`,
      // Caret between the brackets, waiting for the label.
      selectStart: start + 1,
      selectEnd: start + 1,
    };
  }

  const label = selected || "text";
  const text = `[${label}](url)`;
  // "url" comes out selected, so typing the address replaces the placeholder.
  const urlAt = start + label.length + 3;
  return { start, end, text, selectStart: urlAt, selectEnd: urlAt + 3 };
}

/**
 * Insert `![alt](url)` for an image that has already been uploaded.
 *
 * Unlike `insertLink` this takes the URL rather than leaving a placeholder --
 * the editor calls it after the upload has come back, so the destination is
 * known and only the alt text is still up to the author. Any selected text
 * becomes that alt text.
 */
export function insertImage(
  value: string,
  start: number,
  end: number,
  url: string,
  alt = "",
): Edit {
  const label = alt || value.slice(start, end);
  const text = `![${label}](${url})`;

  if (label) {
    // Alt text already supplied, so put the caret after the whole image.
    const after = start + text.length;
    return { start, end, text, selectStart: after, selectEnd: after };
  }

  // Empty brackets, caret inside them: alt text is worth prompting for, and an
  // author who tabs away leaves a decorative image correctly marked as one.
  return { start, end, text, selectStart: start + 2, selectEnd: start + 2 };
}

/** Inline code for a selection on one line, a fenced block for one spanning several. */
export function toggleCode(value: string, start: number, end: number): Edit {
  const selected = value.slice(start, end);
  if (!selected.includes("\n")) return toggleWrap(value, start, end, "`");

  const from = lineStart(value, start);
  const to = lineEnd(value, end);
  const block = value.slice(from, to);

  if (block.startsWith("```") && block.endsWith("```")) {
    const inner = block.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "");
    return {
      start: from,
      end: to,
      text: inner,
      selectStart: from,
      selectEnd: from + inner.length,
    };
  }

  return {
    start: from,
    end: to,
    text: "```\n" + block + "\n```",
    selectStart: from + 4,
    selectEnd: from + 4 + block.length,
  };
}

/**
 * Wrap the selection in maths delimiters -- `$...$` on one line, `$$` on its
 * own lines for more.
 *
 * Deliberately the same shape as `toggleCode` above, because the two are the
 * same gesture: one delimiter inline, a fenced block across lines. An author
 * who has learned that the code button does the right thing with a multi-line
 * selection should not have to learn something else here.
 */
export function toggleMath(value: string, start: number, end: number): Edit {
  const selected = value.slice(start, end);
  if (!selected.includes("\n")) return toggleWrap(value, start, end, "$");

  const from = lineStart(value, start);
  const to = lineEnd(value, end);
  const block = value.slice(from, to);

  if (block.startsWith("$$") && block.endsWith("$$")) {
    const inner = block.replace(/^\$\$[^\n]*\n?/, "").replace(/\n?\$\$$/, "");
    return {
      start: from,
      end: to,
      text: inner,
      selectStart: from,
      selectEnd: from + inner.length,
    };
  }

  return {
    start: from,
    end: to,
    text: "$$\n" + block + "\n$$",
    // Past the "$$\n" that now leads the block, so the selection still covers
    // what the author had selected rather than the fence around it.
    selectStart: from + 3,
    selectEnd: from + 3 + block.length,
  };
}

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?(.*)$/;
const QUOTE_LINE = /^(\s*)(>\s?)(.*)$/;

/**
 * What Enter should do inside a list or a quote.
 *
 * Returns null when the line is ordinary prose, which is the editor's signal to
 * let the browser insert its own newline.
 *
 * Note the ordered case only increments the item being created; items further
 * down are left alone. Markdown numbers an ordered list by position when it
 * renders, so `1. 2. 2. 3.` in the source still comes out 1-2-3-4 on the page
 * -- re-sequencing the rest would rewrite text the author never touched, for
 * no change in output.
 */
export function continueList(value: string, start: number, end: number): Edit | null {
  // With a range selected, Enter means "replace this", not "continue the list".
  if (start !== end) return null;

  const from = lineStart(value, start);
  // Only what precedes the caret: pressing Enter mid-item should not treat the
  // trailing half of the line as the item's content.
  const line = value.slice(from, start);

  const item = LIST_ITEM.exec(line);
  if (item) {
    const [, indent, marker, space, task, content] = item;

    // Enter on an empty bullet ends the list instead of adding another one.
    if (content.trim() === "") {
      return { start: from, end: start, text: "", selectStart: from, selectEnd: from };
    }

    const next = /^\d/.test(marker)
      ? `${parseInt(marker, 10) + 1}${marker.slice(-1)}`
      : marker;
    const text = `\n${indent}${next}${space}${task ? "[ ] " : ""}`;
    const caret = start + text.length;
    return { start, end: start, text, selectStart: caret, selectEnd: caret };
  }

  const quote = QUOTE_LINE.exec(line);
  if (quote) {
    const [, indent, marker, content] = quote;
    if (content.trim() === "") {
      return { start: from, end: start, text: "", selectStart: from, selectEnd: from };
    }
    const text = `\n${indent}${marker}`;
    const caret = start + text.length;
    return { start, end: start, text, selectStart: caret, selectEnd: caret };
  }

  return null;
}

/** A line that opens a list item or a quote, which Tab should nest as a whole. */
const NESTABLE = /^\s*(?:[-*+]|\d+[.)])\s|^\s*>/;

/** Tab / Shift+Tab. */
export function indent(
  value: string,
  start: number,
  end: number,
  outdent: boolean,
): Edit {
  const from = lineStart(value, start);
  const to = lineEnd(value, end);
  const block = value.slice(from, to);

  // A bare caret in ordinary prose just gets an indent where it stands;
  // anything else shifts whole lines, so a selection is not destroyed by the
  // Tab and -- the case that matters most -- Tab inside a list nests the item
  // rather than pushing its text away from its own bullet.
  if (!outdent && start === end && !block.includes("\n") && !NESTABLE.test(block)) {
    const caret = start + INDENT.length;
    return { start, end, text: INDENT, selectStart: caret, selectEnd: caret };
  }

  const lines = block.split("\n");
  const next = lines.map((line) =>
    outdent ? line.replace(/^(?: {1,2}|\t)/, "") : INDENT + line,
  );
  const text = next.join("\n");

  const headDelta = next[0].length - lines[0].length;
  const totalDelta = text.length - block.length;
  return {
    start: from,
    end: to,
    text,
    selectStart: Math.max(from, start + headDelta),
    selectEnd: Math.max(from, end + totalDelta),
  };
}
