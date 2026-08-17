from rest_framework import serializers

from .models import Post


class PostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "categories",
            "excerpt",
            "body",
            "cover_image_url",
            "cover_image_alt",
            "tags",
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
        extra_kwargs = {
            "slug": {"required": False},
            # A post has to live somewhere: filed under nothing it appears on no
            # page at all, which is a mistake every time and an invisible one.
            #
            # Both flags are needed and they catch different mistakes.
            # `allow_empty` rejects an explicit []; `required` rejects leaving
            # the key out, which the model's `default=list` would otherwise
            # make a silent success -- the default exists so the column could
            # be added to existing rows, not as a value any client should get.
            "categories": {"allow_empty": False, "required": True},
        }

    def validate_categories(self, value):
        # Deduplicated and ordered in Post.save() so the admin and the shell get
        # it too; doing it again here is what makes the *response* to this write
        # match, since DRF renders the serializer's own validated data.
        return Post.clean_categories(value)

    def validate_slug(self, value):
        # A blank slug would otherwise pass the unique check and then collide in
        # save(), which surfaces as a 500 rather than a 400.
        if value is not None and not value.strip():
            raise serializers.ValidationError(
                "Leave slug out entirely to have it generated from the title."
            )
        return value


class MostReadPostSerializer(serializers.Serializer):
    """One row of the statistics page's "most read" table."""

    slug = serializers.SlugField(read_only=True)
    title = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    view_count = serializers.IntegerField(read_only=True)


class MonthCountSerializer(serializers.Serializer):
    """One bar of the publishing-cadence chart."""

    # A "YYYY-MM" string rather than a date: the value is a whole month, and a
    # date would invite the client to render a misleading "the 1st".
    month = serializers.CharField(read_only=True)
    count = serializers.IntegerField(read_only=True)


class DayCountSerializer(serializers.Serializer):
    """One bar of the daily-reads chart."""

    # "YYYY-MM-DD". A string for the same reason `month` is one: it names a
    # whole day in the server's timezone, and a datetime would invite a client
    # to shift it into its own and draw the reads on the wrong bar.
    date = serializers.CharField(read_only=True)
    count = serializers.IntegerField(read_only=True)


class PostStatsSerializer(serializers.Serializer):
    """The body of `GET /api/posts/stats/`.

    Aggregates rather than rows: the list endpoint is paginated, so a client
    adding up view counts itself would have to walk every page and would still
    be wrong the moment there were more posts than it fetched.
    """

    total = serializers.IntegerField(read_only=True)
    published = serializers.IntegerField(read_only=True)
    drafts = serializers.IntegerField(read_only=True)
    total_views = serializers.IntegerField(read_only=True)
    # Per *published* post, not per post: a draft has no public page to be read
    # on, so counting drafts in the denominator would drag the average down for
    # a reason that has nothing to do with how well anything is read.
    average_views = serializers.FloatField(read_only=True)
    # Every view ever counted, over the days since the first post was
    # published. A lifetime rate, so it covers the reads that happened before
    # anything was recorded per-day -- which is what `views_by_day` cannot do.
    views_per_day = serializers.FloatField(read_only=True)
    most_read = MostReadPostSerializer(many=True, read_only=True)
    published_by_month = MonthCountSerializer(many=True, read_only=True)
    # Exactly `DAILY_VIEWS_DAYS` rows ending on the server's today, **including
    # the days with no reads** -- the opposite of `published_by_month`, and
    # deliberately: the window is anchored to a clock only the server has.
    views_by_day = DayCountSerializer(many=True, read_only=True)


class ViewCountSerializer(serializers.Serializer):
    """The body of `POST /api/posts/{slug}/view/`.

    Its own serializer rather than a bare dict so drf-spectacular can describe
    the action's response instead of emitting an untyped blob.
    """

    slug = serializers.SlugField(read_only=True)
    view_count = serializers.IntegerField(read_only=True)
