from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.routers import DefaultRouter

from .auth import LoginView, LogoutView, SessionView
from .uploads import ImageUploadView
from .views import BookViewSet, CommentViewSet, PostViewSet

router = DefaultRouter()
router.register(r"posts", PostViewSet, basename="post")
router.register(r"books", BookViewSet, basename="book")
# Top-level rather than nested under a post: the admin reads comments
# across every post, and the public page asks for one thread with
# `?post=<slug>`. See CommentViewSet.
router.register(r"comments", CommentViewSet, basename="comment")

urlpatterns = [
    # Docs and auth first: the router's own index lives at "" and would
    # otherwise be a candidate for these paths.
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # Session login for the SPA's admin page.
    path("auth/session/", SessionView.as_view(), name="auth-session"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    # Image uploads for the admin editor: returns a URL for a cover image or a
    # Markdown `![](...)` in a body.
    path("uploads/images/", ImageUploadView.as_view(), name="upload-image"),
    path("", include(router.urls)),
]
