/**
 * Image uploads for the admin editor.
 *
 * One endpoint serves both places an image can go -- a post's cover and an
 * inline `![](...)` in its body -- because both want the same thing back: a
 * URL. The upload is its own request rather than part of the post write, so
 * the New Post form can attach an image before the post it belongs to exists.
 */

import { apiRequest, ApiError } from "./api";

/** What `POST /api/uploads/images/` returns. */
export interface UploadedImage {
  /** Public URL, straight from the bucket -- what goes in an `<img src>`. */
  url: string;
  /** The object key it was stored under, e.g. `uploads/2026/08/a-1f2e3d4c.png`. */
  name: string;
}

/** Mirrors ALLOWED_FORMATS in `myapp/uploads.py`. Used only to set the file
 *  picker's `accept` filter and to fail obvious cases without a round trip;
 *  the server re-checks the actual bytes, which is the check that counts. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",");

/** Matches MAX_UPLOAD_SIZE in `settings.py`. Checked here as well so a 12 MB
 *  photo is refused instantly instead of after being pushed over the wire. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Upload one image, returning its public URL.
 *
 * Throws `ApiError` like every other write here, so a caller can show
 * `error.message` without knowing whether the failure was the file, the
 * session, or the network.
 */
export async function uploadImage(
  file: File,
  signal?: AbortSignal,
): Promise<UploadedImage> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(
      `That image is ${Math.round(file.size / 1024 / 1024)} MB; the limit is ` +
        `${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      0,
    );
  }

  const body = new FormData();
  body.append("file", file);

  return apiRequest<UploadedImage>("/uploads/images/", {
    method: "POST",
    body,
    signal,
  });
}
