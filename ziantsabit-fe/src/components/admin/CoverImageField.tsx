import { useRef, useState, type ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";

import type { FieldErrors } from "../../services/api";
import { ApiError } from "../../services/api";
import { ACCEPT_ATTRIBUTE, uploadImage } from "../../services/uploads";

interface Props {
  url: string;
  alt: string;
  fieldErrors: FieldErrors;
  onChange: (next: { url?: string; alt?: string }) => void;
}

/**
 * The post's lead image: upload a file, or paste a URL.
 *
 * The upload happens here and now, not on save -- the form holds a URL, so a
 * post write stays a plain JSON request and a cover can be chosen on the New
 * Post page, before the post it belongs to exists.
 *
 * The URL stays editable rather than being hidden behind the picker, because
 * an image already hosted somewhere else is a perfectly good cover and there is
 * no reason to make someone re-upload it to use one.
 */
function CoverImageField({ url, alt, fieldErrors, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // A URL that pointed nowhere, so the preview can say so instead of showing
  // the browser's broken-image glyph with no explanation.
  const [broken, setBroken] = useState(false);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset first, so re-picking the same file still fires a change event.
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadImage(file);
      setBroken(false);
      // Seed the alt text from the filename only when there is none to lose --
      // it is a poor description, but it beats an empty alt on a meaningful
      // image, and it is right there to edit.
      onChange({
        url: uploaded.url,
        alt: alt || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
      });
    } catch (failure: unknown) {
      setUploadError(
        failure instanceof ApiError || failure instanceof Error
          ? failure.message
          : "Could not upload that image.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Typography
        component="span"
        sx={{ fontSize: "13px", color: "text.secondary" }}
      >
        Cover image
      </Typography>

      <Stack sx={{ gap: 1.5, mt: 1 }}>
        {url && !broken && (
          <Box
            component="img"
            src={url}
            alt={alt || "Cover preview"}
            onError={() => setBroken(true)}
            onLoad={() => setBroken(false)}
            sx={{
              width: "100%",
              maxHeight: 220,
              objectFit: "cover",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              // A transparent PNG on a dark card is invisible without this.
              bgcolor: "background.paper",
            }}
          />
        )}

        {url && broken && (
          <Alert severity="warning">
            That URL did not load. It may be wrong, or the storage service may
            be unreachable.
          </Alert>
        )}

        {uploadError && (
          <Alert severity="error" onClose={() => setUploadError(null)}>
            {uploadError}
          </Alert>
        )}

        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            size="small"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            startIcon={
              uploading ? <CircularProgress size={16} /> : <ImageIcon fontSize="small" />
            }
          >
            {uploading ? "Uploading..." : url ? "Replace image" : "Upload image"}
          </Button>

          {url && (
            <Button
              size="small"
              color="inherit"
              disabled={uploading}
              onClick={() => {
                setBroken(false);
                onChange({ url: "", alt: "" });
              }}
            >
              Remove
            </Button>
          )}
        </Stack>

        <Box
          component="input"
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          ref={fileRef}
          onChange={handleFile}
          sx={{ display: "none" }}
        />

        <TextField
          label="Cover image URL"
          value={url}
          onChange={(event) => {
            setBroken(false);
            onChange({ url: event.target.value });
          }}
          error={Boolean(fieldErrors.cover_image_url)}
          helperText={
            fieldErrors.cover_image_url ??
            "Set by the upload button, or paste the address of an image hosted elsewhere."
          }
          fullWidth
        />

        {url && (
          <TextField
            label="Cover image alt text"
            value={alt}
            onChange={(event) => onChange({ alt: event.target.value })}
            error={Boolean(fieldErrors.cover_image_alt)}
            helperText={
              fieldErrors.cover_image_alt ??
              "Describes the image to screen readers. Leave blank if it is purely decorative."
            }
            fullWidth
          />
        )}
      </Stack>
    </Box>
  );
}

export default CoverImageField;
