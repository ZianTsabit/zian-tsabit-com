from rest_framework import serializers

from .models import Post


class PostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "category",
            "excerpt",
            "body",
            "cover_image_url",
            "cover_image_alt",
            "status",
            "published_at",
            "view_count",
            "created_at",
            "updated_at",
        ]
        # slug is generated in Post.save() when omitted, but stays writable so a
        # post's URL can be pinned by hand; the timestamps are bookkeeping.
        # view_count is raised only through the /view/ action, never by a write
        # to the post itself -- otherwise an edit would carry whatever number
        # the form loaded and quietly roll back every view since.
        read_only_fields = ["id", "view_count", "created_at", "updated_at"]
        extra_kwargs = {"slug": {"required": False}}

    def validate_slug(self, value):
        # A blank slug would otherwise pass the unique check and then collide in
        # save(), which surfaces as a 500 rather than a 400.
        if value is not None and not value.strip():
            raise serializers.ValidationError(
                "Leave slug out entirely to have it generated from the title."
            )
        return value


class ViewCountSerializer(serializers.Serializer):
    """The body of `POST /api/posts/{slug}/view/`.

    Its own serializer rather than a bare dict so drf-spectacular can describe
    the action's response instead of emitting an untyped blob.
    """

    slug = serializers.SlugField(read_only=True)
    view_count = serializers.IntegerField(read_only=True)
