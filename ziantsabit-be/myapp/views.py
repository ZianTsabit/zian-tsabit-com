from django.db.models import F
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .models import Post
from .serializers import PostSerializer, ViewCountSerializer

# What ?ordering= accepts, and the order_by() each value means. "views" keeps
# the default ordering as its tie-breaker so a page of all-zero counts still
# reads newest-first rather than in whatever order the database returns rows.
ORDERINGS = {
    "recent": ["-published_at", "-created_at"],
    "views": ["-view_count", "-published_at", "-created_at"],
}


# Both filters are read straight off query_params in get_queryset(), so the
# schema generator cannot see them -- without this they are missing from Swagger.
@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                name="category",
                description="Only posts in this section.",
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
                    "'views' is most-read first."
                ),
                enum=sorted(ORDERINGS),
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
      ?ordering=recent|views    (default recent)
    """

    serializer_class = PostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    lookup_field = "slug"

    def get_queryset(self):
        queryset = self._order(self._filter_category(Post.objects.all()))

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
        return queryset.filter(category=category)

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
