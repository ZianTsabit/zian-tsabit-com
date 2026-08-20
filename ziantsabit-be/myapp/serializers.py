from rest_framework import serializers

from .models import (
    EARLIEST_RELEASE_YEAR,
    Book,
    Post,
    isbn_is_valid,
    max_release_year,
    normalise_isbn,
)


class PostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
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
        }

    def validate_tags(self, value):
        # Trimmed and deduped in Post.save() so the admin and the shell get it
        # too; doing it again here is what makes the *response* to this write
        # match what was stored, since DRF renders the serializer's own
        # validated data.
        #
        # Deliberately no `allow_empty=False`, unlike the `categories` field
        # this replaced: an untagged post is a perfectly good post. Filing under
        # nothing used to mean appearing on no page at all, which is why that
        # was an error; the feed at `/` lists every post regardless of its tags,
        # so an untagged one is simply one nobody has labelled yet.
        return Post.clean_tags(value)

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


class BookSerializer(serializers.ModelSerializer):
    # Declared rather than inferred from the model field, because that field's
    # ceiling is a *callable* -- `max_release_year`, so it follows the calendar
    # -- and drf-spectacular cannot put a function into an OpenAPI `maximum`.
    # The floor is a constant and worth publishing in the schema; the moving
    # ceiling is enforced in `validate_release_year` below, which is also the
    # only place that can name the year currently allowed in its message.
    release_year = serializers.IntegerField(
        required=False, allow_null=True, min_value=EARLIEST_RELEASE_YEAR
    )

    class Meta:
        model = Book
        fields = [
            "id",
            "title",
            "slug",
            "author",
            "genres",
            "isbn",
            "release_year",
            "review",
            "cover_image_url",
            "cover_image_alt",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            # Generated in Book.save() when omitted, but writable so a URL can
            # be pinned by hand -- the same arrangement Post has.
            "slug": {"required": False},
            # A catalogue entry with no author is not a catalogue entry. The
            # model's CharField is `blank=False` already; naming it here is
            # what turns "" into a 400 rather than a silently empty shelf line.
            "author": {"allow_blank": False},
        }

    def validate_slug(self, value):
        # A blank slug would pass the unique check and then collide inside
        # save(), which surfaces as a 500 rather than a 400.
        if value is not None and not value.strip():
            raise serializers.ValidationError(
                "Leave slug out entirely to have it generated from the title."
            )
        return value

    def validate_genres(self, value):
        # Tidied in Book.save() so the admin and the shell get it too; doing it
        # again here is what makes the *response* to this write match what was
        # stored, since DRF renders the serializer's own validated data.
        return Book.clean_genres(value)

    def validate_isbn(self, value):
        """Normalise the separators away, then check the number's own digit.

        Length alone would accept a transposed pair, which is the typo that
        leaves an ISBN looking right and matching nothing. Rejected here rather
        than on the model so it is a 400 with a message, and so an entry typed
        into the Django admin or the shell is still saved -- a bad ISBN is worth
        refusing at the form, not worth losing the rest of the record over.
        """
        compact = normalise_isbn(value)
        if not compact:
            return ""
        if not isbn_is_valid(compact):
            raise serializers.ValidationError(
                "That is not a valid ISBN. Give 10 or 13 digits, hyphens optional."
            )
        return compact

    def validate_release_year(self, value):
        """Reject a year outside the range a printed book can carry.

        The model carries the same validators, but a ModelSerializer does not
        run a field's validators against `None`-able integers in every path --
        and the ceiling moves with the calendar, so it is worth saying plainly
        in the message which year is currently the last allowed one.
        """
        if value is None:
            return None
        latest = max_release_year()
        if not EARLIEST_RELEASE_YEAR <= value <= latest:
            raise serializers.ValidationError(
                f"Give a year between {EARLIEST_RELEASE_YEAR} and {latest}."
            )
        return value


class LabelCountSerializer(serializers.Serializer):
    """One row of a vocabulary endpoint: `/api/posts/tags/` or
    `/api/books/genres/`.

    One serializer for both, because they are the same answer to the same
    question -- what labels exist here, and how many rows carry each -- asked of
    two free-text arrays. See `label_counts` in views.py.
    """

    name = serializers.CharField(read_only=True)
    count = serializers.IntegerField(read_only=True)
