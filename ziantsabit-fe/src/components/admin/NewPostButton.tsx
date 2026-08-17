import AddIcon from "@mui/icons-material/Add";

import ActionButton from "./ActionButton";

/**
 * "New post", on the overview and on the post list.
 *
 * Shared rather than written twice: the two sit in identical header rows and
 * differ only in where they navigate, so a restyle of one that missed the other
 * would be invisible until someone opened both pages.
 *
 * The style is `ActionButton`'s, like every other action in the admin. The
 * leading `+` is the one thing of its own: it opens a row rather than closing
 * one, and the glyph is what says so.
 */
function NewPostButton({ onClick }: { onClick: () => void }) {
  return (
    <ActionButton onClick={onClick} startIcon={<AddIcon />}>
      New post
    </ActionButton>
  );
}

export default NewPostButton;
