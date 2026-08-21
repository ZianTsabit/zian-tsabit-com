from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import (
    EARLIEST_RELEASE_YEAR,
    REACTION_EMOJI_VALUES,
    Book,
    Comment,
    Post,
    isbn_is_valid,
    max_release_year,
    normalise_isbn,
)


class PostSerializer(serializers.ModelSerializer):
    # How many *visible* comments the post has, for the feed card and the
    # detail page's heading. Always the published count, even for the owner:
    # it is the number a visitor sees under the post, and an admin list that
    # said "4 comments" where the page shows 3 would be reporting a different
    # figure under the same word. The admin console counts hidden ones by
    # filtering `/api/comments/` instead.
    comment_count = serializers.SerializerMethodField()

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
            # Writable, and the only place either is set: the editor's two
            # switches. Both default True on the model, so a create that leaves
            # them out gets a post behaving like every existing one.
            "comments_enabled",
            "reactions_enabled",
            "view_count",
            "comment_count",
            "created_at",
            "updated_at",
        ]
        # slug is generated in Post.save() when omitted, but stays writable so a
        # post's URL can be pinned by hand; the timestamps are bookkeeping.
        # view_count is raised only through the /view/ action, never by a write
        # to the post itself -- otherwise an edit would carry whatever number
        # the form loaded and quietly roll back every view since.
        read_only_fields = [
            "id",
            "view_count",
            "comment_count",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "slug": {"required": False},
        }

    @extend_schema_field(serializers.IntegerField())
    def get_comment_count(self, post):
        """Read the annotation `PostViewSet.get_queryset` attaches, or count.

        The fallback is not decoration: a create/update response serialises the
        instance `save()` returned, which never went through the queryset and so
        carries no annotation. That is one extra query on a write -- a page the
        owner is looking at, one row at a time -- while every read path, which
        is where the N+1 would actually hurt, comes in annotated.
        """
        counted = getattr(post, "comment_count", None)
        if counted is not None:
            return counted
        return post.comments.filter(status=Comment.Status.PUBLISHED).count()

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


class CommentSerializer(serializers.ModelSerializer):
    """A visitor's comment, both read and written through this one shape.

    `post` is the slug rather than the id, matching every other route here --
    the client already has the slug, and asking it for a numeric id would mean
    a lookup it has no reason to make.
    """

    post = serializers.SlugRelatedField(
        slug_field="slug", queryset=Post.objects.all()
    )
    # For the admin console's rows, which list comments across posts and would
    # otherwise show a slug where a title belongs. Read-only and cheap: the
    # viewset select_related()s the post it comes from.
    post_title = serializers.CharField(source="post.title", read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id",
            "post",
            "post_title",
            "author_name",
            "body",
            "status",
            "created_at",
            "updated_at",
        ]
        # `status` stays writable -- that is how the admin hides and restores a
        # comment -- but an anonymous create never gets to choose it: see
        # `CommentViewSet.perform_create`.
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            # A CharField is `blank=False` already; naming it here is what turns
            # a submitted "" into a 400 rather than an anonymous row.
            "author_name": {"allow_blank": False},
            "body": {"allow_blank": False},
        }

    def validate_post(self, value):
        """Refuse a comment on a post the caller cannot see, or has closed.

        Two separate refusals, and they are worded differently on purpose. A
        draft is answered as if it did not exist -- `get_queryset` hides drafts
        from anonymous callers on every read route, and a write has to agree, or
        posting to a guessed slug would confirm an unpublished post exists and
        would attach a comment that appears the moment it is published. A closed
        thread, by contrast, is a post the visitor is looking at right now, so
        the message says plainly what happened.

        **The owner is exempt from both.** They are not the audience either
        switch is about: closing a thread means visitors may no longer add to
        it, and leaving the last word on a thread you just closed is a
        reasonable thing to want. The form is gone from the public page either
        way, so this only ever comes up through the API.
        """
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            return value
        if value.status != Post.Status.PUBLISHED:
            raise serializers.ValidationError("No post found with that slug.")
        if not value.comments_enabled:
            raise serializers.ValidationError(
                "Comments are closed on this post."
            )
        return value

    def validate_author_name(self, value):
        # Collapses runs of whitespace as well as trimming, so a name padded out
        # to look like a heading in the thread cannot be.
        name = " ".join(value.split())
        if not name:
            raise serializers.ValidationError("Give a name to post under.")
        return name

    def validate_body(self, value):
        # Only the ends are trimmed: the newlines *inside* are the commenter's
        # paragraphs, and the page renders them with `pre-line`.
        body = value.strip()
        if not body:
            raise serializers.ValidationError("Write something first.")
        return body


class ReactionCountSerializer(serializers.Serializer):
    """One button of the reaction bar.

    Sent for **every** emoji in `REACTION_EMOJI`, zeros included -- the same
    denseness `views_by_day` has and for a related reason: the bar is a fixed
    row of buttons, so the client renders what the server offers rather than
    keeping its own copy of the list and hoping the two agree.
    """

    emoji = serializers.CharField(read_only=True)
    # The accessible name, e.g. "Celebrate". Sent rather than kept client-side
    # so the set and its wording live in one file.
    label = serializers.CharField(read_only=True)
    count = serializers.IntegerField(read_only=True)
    # Whether the `visitor` token on this request has this reaction. False for
    # every emoji when no token was sent, which is what an unknown browser sees.
    reacted = serializers.BooleanField(read_only=True)


class ReactionSummarySerializer(serializers.Serializer):
    """The body of `GET|POST /api/posts/{slug}/reactions/`."""

    slug = serializers.SlugField(read_only=True)
    total = serializers.IntegerField(read_only=True)
    reactions = ReactionCountSerializer(many=True, read_only=True)


class ReactionToggleSerializer(serializers.Serializer):
    """The request body of `POST /api/posts/{slug}/reactions/`.

    A serializer rather than raw `request.data` reads so drf-spectacular can
    describe the request -- and so both fields are validated in one place.
    """

    emoji = serializers.ChoiceField(choices=REACTION_EMOJI_VALUES)
    # Opaque and client-generated; see `Reaction.visitor`. Bounded because it
    # goes into a CharField, and non-blank because "everyone who sent nothing"
    # would otherwise be one visitor sharing one reaction.
    visitor = serializers.CharField(max_length=64, allow_blank=False, trim_whitespace=True)
