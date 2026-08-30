import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import {
  STORY_HEIGHT,
  STORY_WIDTH,
  renderStoryCard,
  storyFileName,
  toPng,
  type StorySubject,
} from "../../services/storyCard";
import {
  SITE_THEMES,
  THEME_LABELS,
  useSiteTheme,
  type SiteTheme,
} from "../../services/useSiteTheme";

interface Card {
  url: string;
  blob: Blob;
  coverDropped: boolean;
}

/**
 * Turn one post or one book into an Instagram story.
 *
 * The card is drawn on a canvas by `storyCard.ts`; everything here is the way
 * in and the two ways out -- save the PNG, or hand it straight to the phone's
 * share sheet, which is what puts it in Instagram in one step on the device
 * this is actually posted from.
 *
 * Deliberately a preview and not a "post to Instagram" button: Instagram has no
 * API that accepts a story from a personal account, so anything claiming to
 * publish one would be a lie. What it can do is make the image, in the site's
 * own colours, with the link already on it.
 */
interface Props {
  /** Null closes the dialog. Memoise it in the caller -- redrawing is keyed on
   *  identity, and a fresh object each render would redraw forever. */
  subject: StorySubject | null;
  onClose: () => void;
}

function ShareStoryDialog({ subject, onClose }: Props) {
  // The card opens in whatever scheme the admin is being read in, which is the
  // owner's current taste and so the best guess available. It is only a
  // starting point: a story is looked at beside other stories, not beside the
  // site, so the picker matters more here than it does on a page.
  const { theme } = useSiteTheme();
  const [scheme, setScheme] = useState<SiteTheme>("light");
  const [card, setCard] = useState<Card | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The object URL currently on screen. Held in a ref rather than revoked from
  // the effect's cleanup, so redrawing after a scheme change can keep the old
  // preview visible until the new one is ready -- a cleanup-time revoke leaves
  // the <img> pointing at a dead URL for a frame, which flashes as a broken
  // image.
  const live = useRef<string | null>(null);

  // Follow the site's scheme until the dialog is actually opened, then leave
  // the choice alone: re-syncing on every render would undo the picker below.
  const opened = subject !== null;
  useEffect(() => {
    if (opened && theme) setScheme(theme);
  }, [opened, theme]);

  useEffect(() => {
    if (!subject) return;
    let cancelled = false;
    setDrawing(true);
    setError(null);

    void (async () => {
      try {
        const { canvas, coverDropped } = await renderStoryCard(subject, scheme);
        const blob = await toPng(canvas);
        if (cancelled) return;
        if (live.current) URL.revokeObjectURL(live.current);
        live.current = URL.createObjectURL(blob);
        setCard({ url: live.current, blob, coverDropped });
      } catch (failure: unknown) {
        if (cancelled) return;
        setError(
          failure instanceof Error ? failure.message : "The card could not be drawn.",
        );
      } finally {
        if (!cancelled) setDrawing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subject, scheme]);

  // Closing throws the card away: it is cheap to redraw and holding a few
  // megabytes of PNG for a dialog nobody has open is not worth it.
  useEffect(() => {
    if (opened) return;
    if (live.current) URL.revokeObjectURL(live.current);
    live.current = null;
    setCard(null);
  }, [opened]);

  // Revoke on unmount as well -- the effect above only fires on a close the
  // component survives.
  useEffect(
    () => () => {
      if (live.current) URL.revokeObjectURL(live.current);
      live.current = null;
    },
    [],
  );

  const file = useMemo(
    () =>
      card && subject
        ? new File([card.blob], storyFileName(subject), { type: "image/png" })
        : null,
    [card, subject],
  );

  // Feature-detected rather than sniffed: the share sheet is the whole point on
  // a phone and absent on most desktops, and `canShare` with the actual file is
  // the only honest way to ask -- Chrome on Linux has `navigator.share` and
  // refuses files.
  const canShare =
    file !== null &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (!subject) return null;

  const handleDownload = () => {
    if (!card) return;
    const link = document.createElement("a");
    link.href = card.url;
    link.download = storyFileName(subject);
    link.click();
  };

  const handleShare = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: subject.title, text: subject.url });
    } catch (failure: unknown) {
      // Dismissing the sheet rejects with AbortError, which is not a failure
      // and must not be reported as one.
      if (failure instanceof DOMException && failure.name === "AbortError") return;
      setNotice("The share sheet did not open.");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(subject.url);
      setNotice("Link copied.");
    } catch {
      // Clipboard access is refused outright in some contexts, and there is
      // nothing to fall back to -- the URL is on the card and in the field
      // below it either way.
      setNotice("Could not reach the clipboard.");
    }
  };

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Share as a story</DialogTitle>

        <DialogContent sx={{ pb: 1 }}>
          <Stack sx={{ gap: 2 }}>
            {!subject.published && (
              <Alert severity="warning">
                This is still a draft, so the link on the card is a 404 until you
                publish it.
              </Alert>
            )}

            {card?.coverDropped && (
              <Alert severity="info">
                The cover image could not be loaded into the card — the image host
                has to allow cross-origin reads for it to be saveable. The rest of
                the card is unaffected.
              </Alert>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {/* Capped rather than given the dialog's full width, so the whole
                thing -- caption and buttons included -- fits a laptop screen
                without scrolling. The ratio comes from the card's own
                constants, so a square stays square here too, and the box is
                fixed either way: it must not resize under the preview each time
                the scheme changes and the PNG is re-encoded. */}
            <Box
              sx={{
                position: "relative",
                alignSelf: "center",
                width: "min(100%, 300px)",
                aspectRatio: `${STORY_WIDTH} / ${STORY_HEIGHT}`,
                borderRadius: 2,
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.default",
              }}
            >
              {card && (
                <Box
                  component="img"
                  src={card.url}
                  alt={`Story card for “${subject.title}”`}
                  sx={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    // Dimmed rather than removed while a new scheme is drawing:
                    // the layout is identical, so swapping it for a spinner
                    // makes the dialog jump for a change that is only a recolour.
                    opacity: drawing ? 0.4 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                />
              )}
              {drawing && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CircularProgress size={28} aria-label="Drawing the card" />
                </Box>
              )}
            </Box>

            <ToggleButtonGroup
              exclusive
              size="small"
              value={scheme}
              onChange={(_event, next: SiteTheme | null) => {
                // Null is the group reporting the current value being pressed
                // again. There is no "no scheme", so that is a no-op.
                if (next) setScheme(next);
              }}
              aria-label="Card colours"
              sx={{ alignSelf: "center" }}
            >
              {SITE_THEMES.map((option) => (
                <ToggleButton
                  key={option}
                  value={option}
                  sx={{ textTransform: "none", px: 2 }}
                >
                  {THEME_LABELS[option]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Typography sx={{ fontSize: "13px", color: "text.secondary", textAlign: "center" }}>
              {STORY_WIDTH}×{STORY_HEIGHT} — square, so it works as a feed post
              too. Instagram centres it in a story; add the link sticker to make
              the URL tappable.
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
          <Button color="inherit" onClick={onClose}>
            Close
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button color="inherit" onClick={() => void handleCopyLink()}>
            Copy link
          </Button>
          <Button onClick={handleDownload} disabled={!card}>
            Download
          </Button>
          {/* Only where the sheet will actually take a file. On a desktop the
              download is the whole workflow, and a Share button that opens
              nothing is worse than no button. */}
          {canShare && (
            <Button variant="contained" onClick={() => void handleShare()}>
              Share
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notice !== null}
        autoHideDuration={3000}
        onClose={() => setNotice(null)}
        message={notice}
      />
    </>
  );
}

export default ShareStoryDialog;
