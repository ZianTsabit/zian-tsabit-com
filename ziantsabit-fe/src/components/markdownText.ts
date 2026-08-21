/**
 * Flatten Markdown to bare text, for the card previews that fall back to the
 * body when a post has no excerpt.
 *
 * Deliberately regex rather than a real parse: the output is a one-or-two-line
 * teaser that gets clamped anyway, so "close enough, and cheap" beats pulling
 * the whole AST just to throw it away. It only has to stop `## Heading` and
 * `[text](url)` from showing up as literal syntax on a card.
 *
 * Lives beside `Markdown.tsx` rather than inside it because that file's job is
 * to export the component: a module that exports both a component and a plain
 * function breaks React Fast Refresh, which `react-refresh/only-export-components`
 * fails the build on.
 */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    // Images before links: image syntax is link syntax with a leading "!".
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Maths, after the code rules above so a `$` inside a fence is already
    // gone. The two forms are treated differently on purpose, because they
    // read differently as text: a **display block** is a standalone equation
    // whose source (`\int_{-\infty}^{\infty} e^{-x^2}\,dx`) is unreadable on a
    // card, so it goes; **inline** maths is usually a symbol or two inside a
    // sentence, and dropping it would delete that sentence's subject, so its
    // source stays. Display first -- `$$` would otherwise be read as an empty
    // inline expression.
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$([^$\n]*)\$/g, "$1")
    // An escaped dollar is a dollar. Only this one escape is unwrapped, since
    // `$` is the only character this file's own rules made special.
    .replace(/\\\$/g, "$")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/^\s{0,3}(?:[-*_]\s*){3,}$/gm, " ")
    // Tables: drop the `| --- | --- |` separator row outright, then unwrap the
    // remaining rows so their cells read as words instead of `| one | two |`.
    // Runs after the horizontal-rule rule above, which only matches a line of
    // bare dashes and so never eats a separator row.
    .replace(/^\s*\|[-:\s|]*\|\s*$/gm, " ")
    .replace(/^\s*\|(.*)\|\s*$/gm, "$1")
    .replace(/\s*\|\s*/g, " ")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
