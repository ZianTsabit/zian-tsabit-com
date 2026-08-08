from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from .models import Post
from .serializers import PostSerializer


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
    """

    serializer_class = PostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    lookup_field = "slug"

    def get_queryset(self):
        queryset = self._filter_category(Post.objects.all())

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
        self._reject_unknown(category, Post.Category, "category")
        return queryset.filter(category=category)

    @staticmethod
    def _reject_unknown(value, choices, field):
        if value not in choices.values:
            raise ValidationError(
                {
                    field: [
                        f"'{value}' is not a valid {field}. "
                        f"Choose from: {', '.join(choices.values)}."
                    ]
                }
            )
