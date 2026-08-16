from django.db.models import Avg, Count, F, Q, Sum
from django.db.models.functions import Coalesce, TruncMonth
from django.utils.dateparse import parse_date
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
)
from rest_framework.response import Response

from .models import Post
from .serializers import PostSerializer, PostStatsSerializer, ViewCountSerializer

# How many rows the statistics page's "most read" table asks for. Enough to
# show a ranking rather than a podium, short enough to stay one glance.
MOST_READ_LIMIT = 10

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


# Both filters are read straight off query_params in get_queryset(), so the
# schema generator cannot see them -- without this they are missing from Swagger.
@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                name="category",
                description=(
                    "Only posts in this section. A post may be in several, and "
                    "is returned by each of them."
                ),
                enum=Post.Category.values,
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
      ?category=posts|books|projects|garage_sale
      ?status=draft|published   (authenticated only; anonymous never sees drafts)
      ?ordering=recent|updated|views    (default recent)
      ?published_after=YYYY-MM-DD, ?published_before=YYYY-MM-DD (both inclusive)
    """

    serializer_class = PostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    lookup_field = "slug"

    def get_queryset(self):
        queryset = self._order(
            self._filter_dates(self._filter_category(Post.objects.all()))
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

    def _filter_category(self, queryset):
        category = self.request.query_params.get("category")
        if not category:
            return queryset
        # An unrecognised value has to be an error: filtering it out silently
        # would answer a typo'd ?category=book with every post on the site.
        self._reject_unknown(category, Post.Category.values, "category")
        # Containment, not equality: a post filed under several sections belongs
        # on each of their pages. Still singular as a parameter -- it asks
        # "which section am I looking at", which has one answer per page.
        return queryset.filter(categories__contains=[category])

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
        if value not in allowed:
            raise ValidationError(
                {
                    field: [
                        f"'{value}' is not a valid {field}. "
                        f"Choose from: {', '.join(allowed)}."
                    ]
                }
            )

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

        most_read = (
            Post.objects.filter(view_count__gt=0)
            .order_by("-view_count", "-published_at", "-created_at")
            .values("slug", "title", "status", "view_count")[:MOST_READ_LIMIT]
        )

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
                    "most_read": list(most_read),
                    "published_by_month": [
                        {"month": row["month"].strftime("%Y-%m"), "count": row["count"]}
                        for row in by_month
                    ],
                }
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
        post.refresh_from_db(fields=["view_count"])
        return Response(ViewCountSerializer(post).data)
