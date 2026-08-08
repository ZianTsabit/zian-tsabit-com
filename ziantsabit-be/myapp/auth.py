"""Session login for the SPA's /admin page.

The admin page is a normal cross-origin SPA route, so it cannot borrow the
browsable API's HTML login form. These three endpoints hand it the session
cookie that DRF's SessionAuthentication already accepts, plus the CSRF token
every unsafe request has to echo back in `X-CSRFToken`.

The token travels in the response *body*, not just the `csrftoken` cookie:
JavaScript served from the SPA's origin cannot read a cookie set by the API's
origin, so the cookie is only ever useful to the browser, never to the client
code that has to build the header.
"""

from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class SessionStateSerializer(serializers.Serializer):
    """Who the caller is, and the token their next write has to carry."""

    authenticated = serializers.BooleanField()
    username = serializers.CharField(allow_null=True)
    csrf_token = serializers.CharField()


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(write_only=True)
    password = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )


class DetailSerializer(serializers.Serializer):
    """DRF's own error shape, declared so the 400 below appears in Swagger."""

    detail = serializers.CharField()


def session_state(request):
    user = request.user
    authenticated = bool(user and user.is_authenticated)
    return {
        "authenticated": authenticated,
        "username": user.get_username() if authenticated else None,
        # Called after login()/logout() this returns the *rotated* token: both
        # cycle it, so a client that kept the token it logged in with would be
        # 403'd on its very first write.
        "csrf_token": get_token(request),
    }


@extend_schema(
    responses=SessionStateSerializer,
    description=(
        "Current session, and the CSRF token to send as X-CSRFToken. The SPA "
        "calls this on load: it answers 'am I still logged in?' and primes the "
        "csrftoken cookie in one round trip."
    ),
)
class SessionView(APIView):
    permission_classes = [AllowAny]

    # get_token() already flags the cookie for the response, but the decorator
    # is the documented way to say so and costs nothing.
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response(session_state(request))


# DRF's as_view() is csrf_exempt, and SessionAuthentication only enforces CSRF
# once a request is authenticated -- which a login request is not. Without this
# decorator the endpoint would accept a cross-site POST, letting an attacker log
# a visitor into an account of the attacker's choosing.
@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    """Start a session from a username and password."""

    permission_classes = [AllowAny]

    @extend_schema(
        request=LoginSerializer,
        responses={200: SessionStateSerializer, 400: DetailSerializer},
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            # Deliberately does not say which of the two was wrong.
            return Response(
                {"detail": "Incorrect username or password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        login(request, user)
        return Response(session_state(request))


class LogoutView(APIView):
    """End the session. CSRF is enforced here by SessionAuthentication."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=SessionStateSerializer)
    def post(self, request):
        logout(request)
        # logout() flushed the session, so request.user is anonymous by now and
        # session_state() reports the logged-out truth.
        return Response(session_state(request))
