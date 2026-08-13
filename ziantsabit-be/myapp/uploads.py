"""Image uploads for the admin editor.

A single endpoint that takes a file and hands back a URL. Deliberately not part
of the post write itself, for two reasons:

1. The New Post form has no post yet. An image attached to a `POST /api/posts/`
   multipart body could only ever belong to a post being created in that same
   request, which rules out picking a cover before you have finished writing --
   or uploading three images into the body as you go.
2. A cover image and an inline `![](...)` in the body then want exactly the same
   thing from the server, so they share one endpoint instead of growing two
   different upload paths.

The cost is that nothing links an object in the bucket back to the post using
it: deleting a post leaves its images behind. That is unavoidable for inline
images regardless (their URLs live inside Markdown text, which is the only
record that they are referenced at all), so a personal site is better served by
the occasional orphan than by a reference-counting scheme that the body field
could silently defeat anyway.
"""

import secrets
from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage
from django.utils import timezone
from django.utils.text import slugify
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# What Pillow reported the bytes to be -> the extension the object is stored
# with. The stored name is built from this rather than from the uploaded
# filename, so a `.png` that is really a JPEG is saved as what it actually is.
#
# Anything absent is rejected. SVG is the one worth calling out: it can carry
# script, and it is excluded here by construction, since Pillow cannot open it
# and DRF's ImageField has already refused the upload before this map is read.
ALLOWED_FORMATS = {
    "JPEG": "jpg",
    "PNG": "png",
    "GIF": "gif",
    "WEBP": "webp",
}


class ImageUploadSerializer(serializers.Serializer):
    """The multipart body. `ImageField` is what makes this more than a file
    drop: it hands the bytes to Pillow, so a renamed archive with an
    `image/png` Content-Type fails here rather than becoming a broken <img>."""

    file = serializers.ImageField(write_only=True)


class UploadedImageSerializer(serializers.Serializer):
    """What the editor needs back: somewhere to point an `<img>` at."""

    url = serializers.URLField()
    name = serializers.CharField()


def _object_key(upload, image_format):
    """Build the key an upload is stored under.

    Date-partitioned so the bucket stays browsable by hand, and suffixed with
    random hex so two files named `screenshot.png` cannot collide -- and so a
    key is not guessable from the filename someone happened to upload.
    """
    stem = slugify(Path(upload.name or "").stem)[:60] or "image"
    extension = ALLOWED_FORMATS[image_format]
    return (
        f"uploads/{timezone.now():%Y/%m}/"
        f"{stem}-{secrets.token_hex(4)}.{extension}"
    )


@extend_schema(
    request={"multipart/form-data": ImageUploadSerializer},
    responses={201: UploadedImageSerializer},
    description=(
        "Upload one image and get back its public URL. The URL is what goes "
        "into a post's cover_image_url, or into the body as Markdown. "
        "Authenticated callers only."
    ),
)
class ImageUploadView(APIView):
    """POST an image, receive `{url, name}`."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = ImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data["file"]

        # Checked after validation, so an oversized *non*-image is reported as
        # the wrong file type rather than as a size problem.
        limit = settings.MAX_UPLOAD_SIZE
        if upload.size > limit:
            raise serializers.ValidationError(
                {
                    "file": [
                        f"Image is {upload.size // 1024} KB; "
                        f"the limit is {limit // 1024} KB."
                    ]
                }
            )

        # Set by Django's ImageField during validation above -- this is Pillow's
        # verdict on the bytes, not the browser's guess from the extension.
        image_format = upload.image.format
        if image_format not in ALLOWED_FORMATS:
            raise serializers.ValidationError(
                {
                    "file": [
                        f"{image_format} images are not supported. "
                        f"Use one of: {', '.join(sorted(ALLOWED_FORMATS))}."
                    ]
                }
            )

        stored_name = default_storage.save(_object_key(upload, image_format), upload)
        return Response(
            {"url": default_storage.url(stored_name), "name": stored_name},
            status=status.HTTP_201_CREATED,
        )
