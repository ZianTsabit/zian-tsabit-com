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
            "status",
            "published_at",
            "created_at",
            "updated_at",
        ]
        # slug is generated in Post.save() when omitted, but stays writable so a
        # post's URL can be pinned by hand; the timestamps are bookkeeping.
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"slug": {"required": False}}

    def validate_slug(self, value):
        # A blank slug would otherwise pass the unique check and then collide in
        # save(), which surfaces as a 500 rather than a 400.
        if value is not None and not value.strip():
            raise serializers.ValidationError(
                "Leave slug out entirely to have it generated from the title."
            )
        return value
