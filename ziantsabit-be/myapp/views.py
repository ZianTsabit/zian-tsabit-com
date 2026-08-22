from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Avg, CharField, Count, F, Func, Min, Q, Sum
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import (
    SAFE_METHODS,
    AllowAny,
    BasePermission,
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
)
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import (
    REACTION_EMOJI,
    Book,
    Comment,
    PageContent,
    Post,
    PostViewDay,
    Reaction,
    normalise_isbn,
)
from .pages import empty_page_data
from .serializers import (
    BookSerializer,
    CommentSerializer,
    LabelCountSerializer,
    PageContentSerializer,
    PostSerializer,
    PostStatsSerializer,
    ReactionSummarySerializer,
    ReactionToggleSerializer,
    ViewCountSerializer,
)

def stored_labels(model, field):
    """Every distinct label in one `ArrayField`, however it was spelled.

    `unnest` flattens the arrays into one row per label; `output_field` is
    required because Django cannot infer the element type of a set-returning
    function on its own.
    """
    return (
        model.objects.annotate(
            name=Func(F(field), function="unnest", output_field=CharField())
        )
        .values_list("name", flat=True)
        .distinct()
    )


def filter_by_label(queryset, model, field, label):
    """Rows whose `ArrayField` carries `label`, ignoring case.

    Shared by `?tag=` on posts and `?genre=` on books, which are the same
    question asked of two free-text arrays.

    Two steps, because an `ArrayField` has no `icontains` lookup and
    `__contains` is exact: a filter naming "Sci-Fi" would miss a row labelled
    "sci-fi". `clean_labels` dedupes case-insensitively but keeps the first
    spelling *per row*, so both spellings genuinely do exist across a table.
    So: find the stored spellings that match, then ask for rows carrying any
    of them.

    An unmatched label is an empty result, never an error -- these are free
    text, so there is no list to be wrong about and an unused label
    legitimately matches nothing.
    """
    spellings = [
        name
        for name in stored_labels(model, field)
        if name.casefold() == label.casefold()
    ]
    if not spellings:
        return queryset.none()
    return queryset.filter(**{f"{field}__overlap": spellings})


def label_counts(queryset, field, limit):
    """`[{name, count}]` for one `ArrayField`, commonest first.

    Backs the two vocabulary endpoints -- `/api/posts/tags/` and
    `/api/books/genres/` -- which exist because a filter control needs a list of
    labels to offer and free text has no enum to read one off. Counted over a
    whole queryset rather than derived on the client from a page of results,
    which would offer only the labels that happened to land on page one.

    **Spellings are folded together, which the stored values are not.** Offering
    "Sci-Fi" and "sci-fi" as separate options would be offering the same filter
    twice -- `filter_by_label` matches either way round -- with the count split
    between them. The commonest spelling wins; ties break alphabetically, so the
    answer does not depend on row order.
    """
    rows = (
        queryset.annotate(
            name=Func(F(field), function="unnest", output_field=CharField())
        )
        .values("name")
        .annotate(count=Count("id"))
    )

    folded = {}
    for row in rows:
        entry = folded.setdefault(row["name"].casefold(), {"spellings": {}, "count": 0})
        entry["spellings"][row["name"]] = row["count"]
        entry["count"] += row["count"]

    labels = [
        {
            "name": max(sorted(entry["spellings"]), key=entry["spellings"].get),
            "count": entry["count"],
        }
        for entry in folded.values()
    ]
    # Sorted here rather than in SQL, because the counts are only final once the
    # spellings have been folded together.
    labels.sort(key=lambda label: (-label["count"], label["name"].casefold()))
    return labels[:limit]


def reject_unknown(value, allowed, field):
    """Turn an unrecognised query-param value into a 400 with the valid ones.

    Shared by both viewsets. Dropping an unrecognised filter silently would
    answer a typo'd `?category=book` with every post on the site, and a typo'd
    `?ordering=titel` with the default order -- both of which look like the
    filter worked.
    """
    if value not in allowed:
        raise ValidationError(
            {
                field: [
                    f"'{value}' is not a valid {field}. "
                    f"Choose from: {', '.join(allowed)}."
                ]
            }
        )


# The `PostViewSet` actions whose response is one or more serialised posts, and
# therefore the only ones that need `comment_count`. See `_with_comment_count`
# for why the annotation cannot simply be applied to every route.
SERIALISED_POST_ACTIONS = frozenset(
    {"list", "retrieve", "create", "update", "partial_update"}
)

# How many rows the statistics page's "most read" table asks for. Enough to
# show a ranking rather than a podium, short enough to stay one glance.
MOST_READ_LIMIT = 10

# How many days of the reading history `views_by_day` covers, today included.
# Bounded here rather than left to the client because days accumulate fast --
# a year of them is 365 rows for a chart that shows a month.
DAILY_VIEWS_DAYS = 30

# What ?ordering= accepts, and the order_by() each value means. "views" keeps
# the default ordering as its tie-breaker so a page of all-zero counts still
# reads newest-first rather than in whatever order the database returns rows.
#
# "updated" sorts by last edit rather than by publication: a post revised today
# leads the feed even if it was first published a year ago. updated_at is
# auto_now, so every save bumps it -- but recording a view deliberately does
# not, since that path is an F() UPDATE rather than a save() (see record_view).
ORDERINGS = {
    "recent": ["-published_at", "-created_at"],
    "updated": ["-updated_at", "-created_at"],
    "views": ["-view_count", "-published_at", "-created_at"],
}


def summarise_reactions(post, visitor):
    """The whole reaction bar for one post: every emoji, its count, and mine.

    **Dense over `REACTION_EMOJI`**, so the client renders the row the server
    defines instead of holding a second copy of the list -- the same reasoning
    behind `views_by_day` being dense, and the reason adding an emoji is one
    edit rather than two.

    `total` sums the emoji currently on offer, not every row in the table. A
    reaction left with an emoji since retired stays in the database (it is a
    thing that happened) but is no longer shown, and a total that counted it
    would disagree with the buttons underneath it.

    Two queries whatever the token: the counts, and -- only when a token was
    sent -- which of them are this browser's.
    """
    counts = dict(
        Reaction.objects.filter(post=post)
        .values_list("emoji")
        .annotate(total=Count("id"))
    )
    mine = (
        set(
            Reaction.objects.filter(post=post, visitor=visitor).values_list(
                "emoji", flat=True
            )
        )
        if visitor
        else set()
    )
    rows = [
        {
            "emoji": emoji,
            "label": label,
            "count": counts.get(emoji, 0),
            "reacted": emoji in mine,
        }
        for emoji, label in REACTION_EMOJI
    ]
    return {
        "slug": post.slug,
        "total": sum(row["count"] for row in rows),
        "reactions": rows,
    }


# Both filters are read straight off query_params in get_queryset(), so the
# schema generator cannot see them -- without this they are missing from Swagger.
@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                name="tag",
                description=(
                    "Only posts carrying this tag. A post may have several, and "
                    "is returned by each of them. Matched case-insensitively; "
                    "an unused tag is an empty result, not an error."
                ),
            ),
            OpenApiParameter(
                name="status",
                description=(
                    "Only posts with this status. Authenticated callers only: "
                    "anonymous requests always see published posts and nothing else."
                ),
                enum=Post.Status.values,
            ),
            OpenApiParameter(
                name="ordering",
                description=(
                    "Sort order. 'recent' (the default) is newest first; "
                    "'updated' is most-recently-edited first; "
                    "'views' is most-read first."
                ),
                enum=sorted(ORDERINGS),
            ),
            OpenApiParameter(
                name="published_after",
                description=(
                    "Only posts dated on or after this day (YYYY-MM-DD). The "
                    "date compared is published_at, or created_at for a draft "
                    "that has none -- the same date the post displays."
                ),
                type=OpenApiTypes.DATE,
            ),
            OpenApiParameter(
                name="published_before",
                description="Only posts dated on or before this day (YYYY-MM-DD).",
                type=OpenApiTypes.DATE,
            ),
        ],
    ),
)
class PostViewSet(viewsets.ModelViewSet):
    """CRUD for posts, addressed by slug rather than id.

    Reads are open; create/update/delete need an authenticated user, so the API
    can be exposed to the site without handing anyone a public delete button.

    Query params on list:
      ?tag=<label>              (containment, case-insensitive)
      ?status=draft|published   (authenticated only; anonymous never sees drafts)
      ?ordering=recent|updated|views    (default recent)
      ?published_after=YYYY-MM-DD, ?published_before=YYYY-MM-DD (both inclusive)
    """

    serializer_class = PostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    lookup_field = "slug"
    # Declared, and deliberately None: `@action(throttle_scope=...)` is passed
    # to `as_view()` as an initkwarg, and DRF refuses one that does not name an
    # existing attribute on the class. Nothing here is throttled by default --
    # the `reactions` action names its own scope *and* its own throttle class,
    # so the limit applies to that route and no other.
    throttle_scope = None

    def get_queryset(self):
        queryset = self._order(
            self._filter_dates(self._filter_tag(self._with_comment_count()))
        )

        # Drafts are invisible to the public on detail routes too -- filtering
        # only the list would still leak an unpublished post to anyone who
        # guessed its slug.
        user = self.request.user
        if not (user and user.is_authenticated):
            return queryset.filter(status=Post.Status.PUBLISHED)

        status = self.request.query_params.get("status")
        if status:
            self._reject_unknown(status, Post.Status, "status")
            queryset = queryset.filter(status=status)
        return queryset

    def _with_comment_count(self):
        """Every post, carrying its visible comment count as an annotation.

        Annotated in the queryset rather than counted per row in the
        serializer, which on a page of twenty posts would be twenty extra
        queries. `filter=` on the aggregate rather than a `filter()` on the
        queryset: filtering the join would drop the posts with no visible
        comments off the feed entirely.

        Published comments only, even for the owner -- the number means "what a
        visitor sees under this post". See `PostSerializer.get_comment_count`.

        **Only for the routes that actually serialise a post.** An aggregate
        annotation carries a GROUP BY, and `tags` aggregates again on top of
        this queryset -- a second `.values(...).annotate(...)` over an already
        grouped query counts the wrong thing and drops labels entirely. The
        other three actions here (`stats`, `record_view`, `reactions`) have no
        use for the number and no reason to pay for the join.
        """
        if self.action not in SERIALISED_POST_ACTIONS:
            return Post.objects.all()
        return Post.objects.annotate(
            comment_count=Count(
                "comments",
                filter=Q(comments__status=Comment.Status.PUBLISHED),
                distinct=True,
            )
            # `Meta.ordering` is *dropped* by an aggregate annotation -- the
            # GROUP BY makes a default ordering ambiguous, so Django clears it
            # rather than guess -- and the feed came back in whatever order
            # Postgres felt like. Restating it from `Meta.ordering` itself
            # keeps that the one place the default lives, which is why `_order`
            # still applies nothing when no `?ordering=` was asked for.
        ).order_by(*Post._meta.ordering)

    def _filter_tag(self, queryset):
        label = (self.request.query_params.get("tag") or "").strip()
        if not label:
            return queryset
        # Containment, not equality: a post carrying several tags belongs to
        # each of their listings. Still singular as a parameter -- it asks
        # "which tag am I browsing", which has one answer per page.
        #
        # Unlike the `?category=` param this replaced, an unrecognised value is
        # *not* an error: tags are free text, so there is no enum to typo
        # relative to. See `filter_by_label`.
        return filter_by_label(queryset, Post, "tags", label)

    def _filter_dates(self, queryset):
        after = self._date_param("published_after")
        before = self._date_param("published_before")
        if after is None and before is None:
            return queryset

        # A draft has no published_at, so the date it is filtered by is the one
        # it actually displays: created_at. Without the coalesce, every draft
        # would drop out of a date range the moment one was applied.
        queryset = queryset.annotate(
            effective_date=Coalesce("published_at", "created_at")
        )
        if after:
            queryset = queryset.filter(effective_date__date__gte=after)
        if before:
            # Inclusive, hence __date: a naive `lte` against a datetime would
            # compare to midnight and silently exclude the whole end day.
            queryset = queryset.filter(effective_date__date__lte=before)
        return queryset

    def _date_param(self, name):
        raw = self.request.query_params.get(name)
        if not raw:
            return None
        try:
            value = parse_date(raw)
        except ValueError:
            # Well-formed but impossible, e.g. 2026-02-31.
            value = None
        if value is None:
            raise ValidationError(
                {name: [f"'{raw}' is not a valid date. Use YYYY-MM-DD."]}
            )
        return value

    def _order(self, queryset):
        ordering = self.request.query_params.get("ordering")
        if not ordering:
            # Meta.ordering already applies; naming it again would only be a
            # second place to keep the default in step.
            return queryset
        self._reject_unknown(ordering, sorted(ORDERINGS), "ordering")
        return queryset.order_by(*ORDERINGS[ordering])

    @staticmethod
    def _reject_unknown(value, allowed, field):
        reject_unknown(value, allowed, field)

    @extend_schema(responses={200: PostStatsSerializer})
    @action(
        detail=False,
        methods=["get"],
        url_path="stats",
        # Authenticated only, unlike the rest of the reads here: the draft count
        # and every draft's view count are the owner's business, and a public
        # total would also disclose how many unpublished posts exist.
        permission_classes=[IsAuthenticated],
    )
    def stats(self, request):
        """Site-wide aggregates for the admin statistics page.

        Deliberately built from `Post.objects.all()` rather than
        `get_queryset()`: this is an overview of everything, so the list's
        `?category=` / `?status=` filters must not silently narrow it.
        """
        # One query for the three counts and the view total, rather than four
        # round trips for numbers that are always read together.
        totals = Post.objects.aggregate(
            total=Count("id"),
            published=Count("id", filter=Q(status=Post.Status.PUBLISHED)),
            total_views=Coalesce(Sum("view_count"), 0),
            # Avg over published posts only -- see the serializer.
            average_views=Coalesce(
                Avg("view_count", filter=Q(status=Post.Status.PUBLISHED)), 0.0
            ),
        )

        # One reading of the clock for everything below, so the daily window and
        # the lifetime rate cannot land on different days if this runs across
        # midnight.
        today = timezone.localdate()

        # The lifetime rate, which is what makes the daily chart readable on the
        # day it ships: the chart only knows about days it has recorded, while
        # every view ever counted is in `total_views`.
        #
        # Denominator is days since the *first publication*, not since the first
        # post was written -- a site with nothing published has no public page
        # to be read on, so counting the drafting weeks would divide by time
        # nobody could have been reading. Numerator stays every view, drafts
        # included: they are reads that happened.
        first_published = Post.objects.filter(
            status=Post.Status.PUBLISHED, published_at__isnull=False
        ).aggregate(first=Min("published_at"))["first"]
        if first_published is None:
            views_per_day = 0.0
        else:
            # Inclusive of both ends, so the first day is a day. max() guards a
            # publish date set in the future, which would otherwise divide by
            # zero or by a negative.
            days_live = max(
                1, (today - timezone.localtime(first_published).date()).days + 1
            )
            views_per_day = round(totals["total_views"] / days_live, 1)

        most_read = (
            Post.objects.filter(view_count__gt=0)
            .order_by("-view_count", "-published_at", "-created_at")
            .values("slug", "title", "status", "view_count")[:MOST_READ_LIMIT]
        )

        # Dense, and unlike `published_by_month` the gaps are filled *here*.
        # The window is anchored to the server's today, which is the one thing
        # a client cannot work out for itself: a browser a day ahead would
        # otherwise draw a last bar for a day this server has never seen, and
        # one behind would drop today's reads off the end.
        window_start = today - timedelta(days=DAILY_VIEWS_DAYS - 1)
        recorded = dict(
            PostViewDay.objects.filter(date__gte=window_start, date__lte=today)
            .values_list("date")
            .annotate(count=Sum("count"))
        )
        views_by_day = [
            {
                "date": (day := window_start + timedelta(days=offset)).isoformat(),
                "count": recorded.get(day, 0),
            }
            for offset in range(DAILY_VIEWS_DAYS)
        ]

        # Only months that actually have a post; filling the gaps is the
        # client's job, since which range to show is a question about the chart
        # rather than about the data.
        by_month = (
            Post.objects.filter(
                status=Post.Status.PUBLISHED, published_at__isnull=False
            )
            .annotate(month=TruncMonth("published_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )

        return Response(
            PostStatsSerializer(
                {
                    **totals,
                    "drafts": totals["total"] - totals["published"],
                    "average_views": round(totals["average_views"], 1),
                    "views_per_day": views_per_day,
                    "views_by_day": views_by_day,
                    "most_read": list(most_read),
                    "published_by_month": [
                        {"month": row["month"].strftime("%Y-%m"), "count": row["count"]}
                        for row in by_month
                    ],
                }
            ).data
        )

    @extend_schema(responses={200: LabelCountSerializer(many=True)})
    @action(detail=False, methods=["get"], url_path="tags")
    def tags(self, request):
        """Every tag in use, with how many posts carry it.

        The feed's filter control needs a list of tags to offer, and tags are
        free text -- so there is no enum to read them off, and building the list
        from one page of results would offer only the tags that happened to be
        on page one. This is what `?category=`'s fixed four values used to give
        the client for nothing.

        Scoped by `get_queryset()` rather than `Post.objects.all()`, so an
        anonymous caller is told about the tags of published posts and nothing
        else -- a draft's tag would otherwise be a filter option that returns
        nothing, and would disclose what is being written about.

        Read-open, unlike `stats`: a tag on a published post is already visible
        on the post itself.
        """
        return Response(
            LabelCountSerializer(
                label_counts(self.get_queryset(), "tags", LABEL_LIMIT),
                many=True,
            ).data
        )

    @extend_schema(
        request=None,
        responses={200: ViewCountSerializer},
        description=(
            "Record one read of this post and return its new total. Open to "
            "anonymous callers -- it is what the public detail page calls."
        ),
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="view",
        # The one write a visitor is allowed. IsAuthenticatedOrReadOnly would
        # refuse it, since this is a POST.
        permission_classes=[AllowAny],
    )
    def record_view(self, request, slug=None):
        # get_object() runs get_queryset(), so an anonymous caller counting a
        # draft gets the same 404 the detail route would give them.
        post = self.get_object()
        # An UPDATE with F() rather than post.save(): concurrent readers would
        # otherwise each write back the number they loaded, and save() would
        # drag updated_at along with it -- a read is not an edit.
        Post.objects.filter(pk=post.pk).update(view_count=F("view_count") + 1)
        self._record_view_day(post)
        post.refresh_from_db(fields=["view_count"])
        return Response(ViewCountSerializer(post).data)

    @staticmethod
    def _record_view_day(post):
        """Add one to this post's tally for today, in `PostViewDay`.

        The running counter above cannot be looked back through, so the same
        read is also filed under its day. Update first and insert only when
        nothing was updated: every read after the first of the day -- which is
        almost all of them -- is then one statement, and the same F() reasoning
        applies as for the counter.

        The INSERT is wrapped and its IntegrityError swallowed because two first
        reads of the day can race into it; the unique constraint is what decides
        between them, and the loser simply retries the UPDATE that now has a row
        to hit. `atomic` is what keeps that failure from poisoning an outer
        transaction (a TestCase runs inside one).
        """
        today = timezone.localdate()
        rows = PostViewDay.objects.filter(post=post, date=today)
        if rows.update(count=F("count") + 1):
            return
        try:
            with transaction.atomic():
                PostViewDay.objects.create(post=post, date=today, count=1)
        except IntegrityError:
            rows.update(count=F("count") + 1)

    @extend_schema(
        methods=["GET"],
        parameters=[
            OpenApiParameter(
                name="visitor",
                description=(
                    "The browser's own opaque token, so the bar can show which "
                    "emoji this visitor already picked. Omit it and every "
                    "`reacted` comes back false -- the counts are the same "
                    "either way."
                ),
            ),
        ],
        responses={200: ReactionSummarySerializer},
        description=(
            "Every emoji this post may be reacted with, its count, and whether "
            "the calling browser picked it. Dense: an emoji nobody has used is "
            "still returned, with a count of 0."
        ),
    )
    @extend_schema(
        methods=["POST"],
        request=ReactionToggleSerializer,
        responses={200: ReactionSummarySerializer},
        description=(
            "Toggle one emoji for one browser and return the whole bar again. "
            "Sending the same emoji twice removes it -- there is no separate "
            "DELETE, because the button is one control with two meanings and "
            "the client should not have to work out which it is about to do."
        ),
    )
    @action(
        detail=True,
        methods=["get", "post"],
        url_path="reactions",
        # A visitor's write, like the view counter above: IsAuthenticatedOrReadOnly
        # would refuse the POST. What keeps it from being a firehose is the
        # throttle scope, not the permission.
        permission_classes=[AllowAny],
        throttle_classes=[ScopedRateThrottle],
        throttle_scope="reactions",
    )
    def reactions(self, request, slug=None):
        # get_object() runs get_queryset(), so a draft is a 404 to an anonymous
        # caller here exactly as it is on the detail route.
        post = self.get_object()

        if request.method == "POST":
            form = ReactionToggleSerializer(data=request.data)
            form.is_valid(raise_exception=True)
            # The owner is exempt, exactly as they are from a closed comment
            # thread: the switch is about what *visitors* may add, and the bar
            # is not rendered for anyone once it is off, so this only ever
            # comes up through the API.
            user = request.user
            if not post.reactions_enabled and not (user and user.is_authenticated):
                raise ValidationError(
                    {"emoji": ["Reactions are turned off for this post."]}
                )
            visitor = form.validated_data["visitor"]
            self._toggle_reaction(post, form.validated_data["emoji"], visitor)
        else:
            # GET stays open even with reactions off. It is a count of things
            # that already happened, the page does not ask for it once the bar
            # is hidden, and 404ing a summary that exists would make the switch
            # look like the post had gone.
            visitor = (request.query_params.get("visitor") or "").strip()

        return Response(ReactionSummarySerializer(summarise_reactions(post, visitor)).data)

    @staticmethod
    def _toggle_reaction(post, emoji, visitor):
        """Add this visitor's reaction, or take it away if it is already there.

        Delete-first, so the common "un-react" case is one statement and the
        decision is made by the database rather than by a read this request
        would then have to trust. The insert is wrapped for the same reason
        `_record_view_day`'s is: two taps racing each other both find nothing to
        delete, the unique constraint picks a winner, and the loser has nothing
        to do -- the reaction is on, which is what its tap asked for.
        """
        deleted, _rows = Reaction.objects.filter(
            post=post, emoji=emoji, visitor=visitor
        ).delete()
        if deleted:
            return
        try:
            with transaction.atomic():
                Reaction.objects.create(post=post, emoji=emoji, visitor=visitor)
        except IntegrityError:
            pass


# What ?ordering= accepts on the book catalogue, and the order_by() each means.
# Every one of them ends in a total tie-breaker, so a page boundary cannot fall
# between two rows the database is free to return in either order -- which on a
# catalogue sorted by author (where a dozen rows share a value) would otherwise
# show one book twice and drop another entirely.
BOOK_ORDERINGS = {
    "recent": ["-created_at", "-id"],
    "title": ["title", "-id"],
    "author": ["author", "title", "-id"],
    # Newest release first, and the books with no year sit at the end rather
    # than leading the list: `-release_year` alone puts NULLs first in Postgres,
    # which reads as "these are the newest" when it means "these are unknown".
    "year": [F("release_year").desc(nulls_last=True), "title", "-id"],
}

class BookPagination(PageNumberPagination):
    """The catalogue's own page size, smaller than the site-wide 20.

    `/books` is a grid of covers rather than a column of rows, and the two want
    different page lengths: twenty entries is a short list but five rows of a
    four-up grid, which is more scrolling than a shelf is worth -- and on a
    shelf this size it meant the pager never appeared at all, since it is
    deliberately hidden at one page.

    **12 rather than a round 10** because it is what the grid divides by: the
    layout is two columns on a phone and `auto-fill` from `sm` up, so a page
    lands as 6x2, 4x3 or 3x4 with no ragged last row at any width a visitor is
    likely to have. `REST_FRAMEWORK.PAGE_SIZE` still covers posts and comments,
    which really are columns of rows.

    Set on the viewset rather than as a `?page_size=` the client may name: how
    long a page is is a decision about this page, and letting a caller ask for
    ten thousand entries is the usual way that setting goes wrong.
    """

    page_size = 12


# How many labels the two vocabulary endpoints return -- `/api/posts/tags/` and
# `/api/books/genres/`. Long enough to be the whole vocabulary of a personal
# site, short enough that a runaway list of typo'd labels cannot become the
# page's biggest response.
LABEL_LIMIT = 100


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                name="genre",
                description=(
                    "Only books carrying this genre. A book may have several, "
                    "and is returned by each of them. Matched case-insensitively."
                ),
            ),
            OpenApiParameter(
                name="search",
                description="Match against title, author or ISBN.",
            ),
            OpenApiParameter(
                name="status",
                description=(
                    "Only books with this status. Authenticated callers only: "
                    "anonymous requests always see published books and nothing else."
                ),
                enum=Book.Status.values,
            ),
            OpenApiParameter(
                name="ordering",
                description=(
                    "Sort order. 'recent' (the default) is most-recently added "
                    "first; 'title' and 'author' are A-Z; 'year' is newest "
                    "release first, with undated books last."
                ),
                enum=sorted(BOOK_ORDERINGS),
            ),
        ],
    ),
)
class BookViewSet(viewsets.ModelViewSet):
    """CRUD for the book catalogue, addressed by slug rather than id.

    Reads are open, writes need an authenticated user -- the same arrangement
    `PostViewSet` has, and for the same reason.

    Query params on list:
      ?genre=<label>            (containment, case-insensitive)
      ?search=<text>            (title, author or ISBN)
      ?status=draft|published   (authenticated only)
      ?ordering=recent|title|author|year   (default recent)
    """

    serializer_class = BookSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    lookup_field = "slug"
    # A shorter page than the rest of the API -- see BookPagination. Both
    # clients have to agree with it: `BOOKS_PAGE_SIZE` in the SPA's `books.ts`
    # is the same number, and it is what the public catalogue and the admin
    # console derive their page counts from.
    pagination_class = BookPagination

    def get_queryset(self):
        queryset = self._order(self._search(self._filter_genre(Book.objects.all())))

        # Unpublished entries are hidden on the detail route too, not just on
        # the list: filtering only the list would still hand a draft to anyone
        # who guessed its slug.
        user = self.request.user
        if not (user and user.is_authenticated):
            return queryset.filter(status=Book.Status.PUBLISHED)

        status_value = self.request.query_params.get("status")
        if status_value:
            reject_unknown(status_value, Book.Status.values, "status")
            queryset = queryset.filter(status=status_value)
        return queryset

    def _filter_genre(self, queryset):
        label = (self.request.query_params.get("genre") or "").strip()
        if not label:
            return queryset
        # Case-insensitive containment, exactly as `?tag=` is on posts -- see
        # `filter_by_label` for why an ArrayField needs two steps for this, and
        # why an unused label is an empty result rather than a 400.
        return filter_by_label(queryset, Book, "genres", label)

    def _search(self, queryset):
        term = (self.request.query_params.get("search") or "").strip()
        if not term:
            return queryset
        # ISBNs are stored without separators, so the term is stripped of them
        # too -- otherwise pasting "978-0-13-235088-4" off a back cover would
        # match nothing at all.
        compact = normalise_isbn(term)
        matches = Q(title__icontains=term) | Q(author__icontains=term)
        if compact:
            matches |= Q(isbn__icontains=compact)
        return queryset.filter(matches)

    def _order(self, queryset):
        ordering = self.request.query_params.get("ordering")
        if not ordering:
            # Meta.ordering already applies.
            return queryset
        reject_unknown(ordering, sorted(BOOK_ORDERINGS), "ordering")
        return queryset.order_by(*BOOK_ORDERINGS[ordering])

    @extend_schema(responses={200: LabelCountSerializer(many=True)})
    @action(detail=False, methods=["get"], url_path="genres")
    def genres(self, request):
        """Every genre in the catalogue, with how many books carry it.

        Scoped by `get_queryset()`, so an anonymous caller is told about the
        genres of published books and nothing else -- a draft's genre would
        otherwise be a filter option that returns nothing. The folding of
        spellings and the ordering are `label_counts`'s; see it for why both
        matter.
        """
        return Response(
            LabelCountSerializer(
                label_counts(self.get_queryset(), "genres", LABEL_LIMIT),
                many=True,
            ).data
        )


# What ?ordering= accepts on the comment list. "oldest" is Meta.ordering and
# the reading order of a thread; "newest" exists for the admin, where the thing
# worth seeing is whatever arrived while nobody was looking.
COMMENT_ORDERINGS = {
    "oldest": ["created_at", "id"],
    "newest": ["-created_at", "-id"],
}


class CommentPermission(BasePermission):
    """Read open, **create open**, edit and delete for the owner only.

    Not `IsAuthenticatedOrReadOnly`: the whole point of a comment box is that a
    stranger can write to it, so POST has to be allowed for everyone while PUT,
    PATCH and DELETE stay the owner's. Moderation is the one thing a visitor
    must not be able to do -- otherwise anyone could hide anyone's comment, or
    unhide the one that was taken down.

    What stops that open POST being a spam target is the throttle on the
    viewset, not this class.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS or request.method == "POST":
            return True
        return bool(request.user and request.user.is_authenticated)


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                name="post",
                description=(
                    "Only comments on the post with this slug. This is how the "
                    "public page asks for its thread."
                ),
            ),
            OpenApiParameter(
                name="status",
                description=(
                    "Only comments with this status. Authenticated callers "
                    "only: anonymous requests always see published comments "
                    "and nothing else."
                ),
                enum=Comment.Status.values,
            ),
            OpenApiParameter(
                name="search",
                description="Match against the comment body or the name on it.",
            ),
            OpenApiParameter(
                name="ordering",
                description=(
                    "Sort order. 'oldest' (the default) is the order a thread "
                    "is read in; 'newest' puts the most recent first."
                ),
                enum=sorted(COMMENT_ORDERINGS),
            ),
        ],
    ),
)
class CommentViewSet(viewsets.ModelViewSet):
    """Visitors' comments, listed per post and moderated by the owner.

    Its own top-level resource rather than a nested action on `PostViewSet`,
    unlike `/posts/{slug}/reactions/`, and the difference is what each one is:
    a reaction bar is a fixed-size summary that only ever makes sense attached
    to its post, while comments are rows -- they page, they filter, and the
    admin console reads them **across** posts, which a route nested under one
    post cannot express. `?post=<slug>` is what the public page uses to get the
    nested view back.

    Query params on list:
      ?post=<slug>
      ?status=published|hidden   (authenticated only; anonymous never sees hidden)
      ?search=<text>             (body or name)
      ?ordering=oldest|newest    (default oldest)
    """

    serializer_class = CommentSerializer
    permission_classes = [CommentPermission]
    # Used only by `create` -- see get_throttles.
    throttle_scope = "comments"

    def get_throttles(self):
        """Rate-limit the one route a stranger can write to, and only that one.

        Reading a thread is a page load like any other and throttling it would
        break a busy post; the owner moderating from the admin is not the thing
        anyone is worried about either. What is worth bounding is an anonymous
        POST, which is the route a script would find.
        """
        if self.action == "create":
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        # select_related, because `post_title` reads through the foreign key on
        # every row -- without it the admin's page of twenty comments is twenty
        # extra queries for twenty titles.
        queryset = self._order(self._search(Comment.objects.select_related("post")))

        slug = (self.request.query_params.get("post") or "").strip()
        if slug:
            queryset = queryset.filter(post__slug=slug)

        user = self.request.user
        if not (user and user.is_authenticated):
            # Two conditions, not one: a hidden comment is invisible, and so is
            # every comment on a post that is not itself public -- otherwise
            # the thread would be a way to read around the draft filter and
            # confirm that an unpublished post exists.
            return queryset.filter(
                status=Comment.Status.PUBLISHED, post__status=Post.Status.PUBLISHED
            )

        status_value = self.request.query_params.get("status")
        if status_value:
            reject_unknown(status_value, Comment.Status.values, "status")
            queryset = queryset.filter(status=status_value)
        return queryset

    def _search(self, queryset):
        term = (self.request.query_params.get("search") or "").strip()
        if not term:
            return queryset
        return queryset.filter(
            Q(body__icontains=term) | Q(author_name__icontains=term)
        )

    def _order(self, queryset):
        ordering = self.request.query_params.get("ordering")
        if not ordering:
            # Meta.ordering already applies, and it is "oldest".
            return queryset
        reject_unknown(ordering, sorted(COMMENT_ORDERINGS), "ordering")
        return queryset.order_by(*COMMENT_ORDERINGS[ordering])

    def perform_create(self, serializer):
        """Force a visitor's comment to `published`; let the owner choose.

        `status` is writable so the admin can hide and restore, which means an
        anonymous POST could otherwise name it too -- and a spammer posting
        `hidden` comments to seed a page they later expect to be unhidden is
        silly, but a visitor choosing their own moderation state is wrong
        whatever they choose it to be.

        Published rather than pending on purpose: see the `Comment` docstring
        for why this site moderates after the fact rather than before.
        """
        user = self.request.user
        if user and user.is_authenticated:
            serializer.save()
            return
        serializer.save(status=Comment.Status.PUBLISHED)


class PageContentViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """The CV and About pages' content: read by anyone, written by the owner.

    **Not a `ModelViewSet`.** There is deliberately no create and no delete: the
    set of pages is fixed at two, each already has a route and a component, and
    a third row would be content nothing renders. Deleting one would leave a
    public page with nothing to show and no way back through the API.

    Reads are open for the obvious reason -- these back two public pages -- and
    unlike posts and books there is nothing to hide, since a page has no draft
    state.

    Addressed by `key` (`/api/pages/cv/`) rather than by id, so the URL is
    something the SPA can write down rather than something it has to look up.
    """

    serializer_class = PageContentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    queryset = PageContent.objects.all()
    lookup_field = "key"
    # Two rows. A pager over them would be a wrapper object around a list that
    # can never have a second page.
    pagination_class = None

    def get_object(self):
        """The row for this key, created empty if it has never been saved.

        `0013` seeds both rows with the content the pages shipped with, so this
        only fires for a key added to the enum later, or a database restored
        from before that migration. It matters because the alternative is a 404
        on a page that genuinely exists: the SPA would show "could not load"
        for a CV that has simply never been edited, and there would be no way
        to fix it through the admin, since a PATCH needs a row to patch.
        """
        key = self.kwargs[self.lookup_field]
        if key not in PageContent.Key.values:
            raise NotFound(f"No page called '{key}'.")

        page, _ = PageContent.objects.get_or_create(
            key=key, defaults={"data": empty_page_data(key)}
        )
        # Object permissions are still the class's to apply; skipping this is
        # how a hand-rolled get_object quietly drops a permission check.
        self.check_object_permissions(self.request, page)
        return page
