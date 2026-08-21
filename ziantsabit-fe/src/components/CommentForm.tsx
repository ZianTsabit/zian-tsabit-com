import { useState, type FormEvent } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";

import {
  MAX_COMMENT_LENGTH,
  MAX_NAME_LENGTH,
  type CommentDraft,
} from "../services/comments";

/** How long the "posted" line stays up. Long enough to be read on the way to
 *  the thread it points at, short enough not to become page furniture. */
const CONFIRMATION_MS = 6000;

interface Props {
  /** The post being commented on. */
  slug: string;
  submitting: boolean;
  error: string | null;
  onDismissError: () => void;
  /** Resolves to whether the comment was stored, which is what decides
   *  whether the form clears itself. */
  onSubmit: (draft: CommentDraft) => Promise<boolean>;
}

/**
 * The box a visitor writes a comment in: a name, the comment, and one button.
 *
 * **Two fields and no email.** A comment box that asks for an address collects
 * personal data this site has no use for -- nothing here sends mail, so it
 * would exist only to be leaked. The backend has no column for one either; see
 * the `Comment` model.
 *
 * The name is not an account and nothing pretends otherwise: it is display
 * text, so the field says so rather than implying a sign-in that does not
 * exist.
 */
function CommentForm({
  slug,
  submitting,
  error,
  onDismissError,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [posted, setPosted] = useState(false);

  const trimmedName = name.trim();
  const trimmedBody = body.trim();
  // The button is dead until there is something to send. The server checks the
  // same two things and its answer is the one that counts -- this only avoids
  // a round trip that was always going to be a 400.
  const ready = trimmedName !== "" && trimmedBody !== "" && !submitting;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setPosted(false);
    const ok = await onSubmit({
      post: slug,
      author_name: trimmedName,
      body: trimmedBody,
    });
    if (!ok) return;
    // The name stays. Someone who comments twice on a post is the same person
    // both times, and retyping it is the kind of small rudeness that stops
    // people from replying at all.
    setBody("");
    setPosted(true);
    setTimeout(() => setPosted(false), CONFIRMATION_MS);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
      <Stack sx={{ gap: 1.5 }}>
        <TextField
          size="small"
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          // Mirrors the model's max_length, so the field stops at the length
          // the API would have refused rather than losing the tail on submit.
          slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH } }}
          // Not an account: nothing is verified and nothing is kept beyond the
          // comment, and it costs one line to say so rather than let a visitor
          // wonder whether they are signing in to something.
          helperText="Shown with your comment. No account, nothing else stored."
          sx={{ maxWidth: { sm: 320 } }}
        />

        <TextField
          multiline
          minRows={3}
          label="Comment"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH } }}
        />

        {error && (
          <Alert severity="error" onClose={onDismissError}>
            {error}
          </Alert>
        )}

        <Stack
          direction="row"
          sx={{ gap: 2, alignItems: "center", justifyContent: "flex-end" }}
        >
          {/* A live region, so the confirmation is announced rather than only
              seen -- the thread it refers to is further down the page. */}
          <Typography
            role="status"
            aria-live="polite"
            sx={{ fontSize: "13px", color: "text.secondary", mr: "auto" }}
          >
            {posted ? "Posted. It is in the thread above." : ""}
          </Typography>

          {/* Deliberately a real Button rather than the admin's `ActionButton`:
              that component is the admin's own language, where every action is
              a text link in a row of them. This is the one thing a visitor is
              being asked to do on the page, and it has to look like a control
              a stranger will recognise. */}
          <Button type="submit" variant="outlined" disabled={!ready}>
            {submitting ? "Posting..." : "Post comment"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default CommentForm;
