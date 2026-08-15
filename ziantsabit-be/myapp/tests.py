import base64
import io

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import Post

# The CORS tests below pin this rather than relying on settings.py's default,
# so they assert the behaviour and not the environment: a deployment sets
# CORS_ALLOWED_ORIGINS to its real site origin, and without the override the
# suite fails inside exactly the container it is supposed to be validating.
SPA_ORIGIN = "http://spa.test"


class PostModelTests(APITestCase):
    def test_slug_is_derived_from_title(self):
        post = Post.objects.create(title="Clean Code", category=Post.Category.BOOKS)
        self.assertEqual(post.slug, "clean-code")

    def test_duplicate_titles_get_distinct_slugs(self):
        first = Post.objects.create(title="Clean Code", category=Post.Category.BOOKS)
        second = Post.objects.create(title="Clean Code", category=Post.Category.BOOKS)
        third = Post.objects.create(title="Clean Code", category=Post.Category.BOOKS)
        self.assertEqual(
            [first.slug, second.slug, third.slug],
            ["clean-code", "clean-code-2", "clean-code-3"],
        )

    def test_explicit_slug_is_kept(self):
        post = Post.objects.create(
            title="Clean Code", slug="the-one", category=Post.Category.BOOKS
        )
        self.assertEqual(post.slug, "the-one")

    def test_publishing_stamps_published_at(self):
        post = Post.objects.create(
            title="Shipped",
            category=Post.Category.PROJECTS,
            status=Post.Status.PUBLISHED,
        )
        self.assertIsNotNone(post.published_at)

    def test_draft_has_no_published_at(self):
        post = Post.objects.create(title="Draft", category=Post.Category.BOOKS)
        self.assertIsNone(post.published_at)

    def test_title_of_only_punctuation_still_gets_a_slug(self):
        post = Post.objects.create(title="!!!", category=Post.Category.BOOKS)
        self.assertEqual(post.slug, "post")


class PostAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="zian", password="pw-for-tests")
        cls.list_url = reverse("post-list")
        cls.published = Post.objects.create(
            title="Published Book",
            category=Post.Category.BOOKS,
            status=Post.Status.PUBLISHED,
        )
        cls.draft = Post.objects.create(
            title="Draft Project", category=Post.Category.PROJECTS
        )
        cls.sale = Post.objects.create(
            title="Old Desk",
            category=Post.Category.GARAGE_SALE,
            status=Post.Status.PUBLISHED,
        )

    def detail_url(self, post):
        return reverse("post-detail", kwargs={"slug": post.slug})

    # --- read ---------------------------------------------------------------

    def test_anonymous_list_shows_only_published(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = {row["slug"] for row in response.data["results"]}
        self.assertEqual(slugs, {self.published.slug, self.sale.slug})

    def test_anonymous_cannot_retrieve_a_draft_by_slug(self):
        response = self.client.get(self.detail_url(self.draft))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_authenticated_list_includes_drafts(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(self.list_url)
        self.assertEqual(len(response.data["results"]), 3)

    def test_filter_by_category(self):
        response = self.client.get(self.list_url, {"category": "garage_sale"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([r["slug"] for r in response.data["results"]], ["old-desk"])

    def test_filter_by_posts_category(self):
        ordinary = Post.objects.create(
            title="Just a Post",
            category=Post.Category.POSTS,
            status=Post.Status.PUBLISHED,
        )
        response = self.client.get(self.list_url, {"category": "posts"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [r["slug"] for r in response.data["results"]], [ordinary.slug]
        )

    def test_unknown_category_is_rejected(self):
        response = self.client.get(self.list_url, {"category": "book"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", response.data)

    def test_filter_by_status_when_authenticated(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(self.list_url, {"status": "draft"})
        self.assertEqual([r["slug"] for r in response.data["results"]], ["draft-project"])

    def test_retrieve_by_slug(self):
        response = self.client.get(self.detail_url(self.published))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Published Book")

    # --- write --------------------------------------------------------------

    def test_anonymous_cannot_create(self):
        response = self.client.post(
            self.list_url, {"title": "Nope", "category": "books"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Post.objects.count(), 3)

    def test_create_generates_slug_and_defaults_to_draft(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url,
            {"title": "A New Post", "category": "books", "body": "hello"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["slug"], "a-new-post")
        self.assertEqual(response.data["status"], "draft")

    def test_basic_auth_can_create(self):
        # Covers the `curl -u user:password` flow the README documents; every
        # other write test here authenticates in-process instead.
        token = base64.b64encode(b"zian:pw-for-tests").decode()
        response = self.client.post(
            self.list_url,
            {"title": "Via Curl", "category": "books"},
            format="json",
            HTTP_AUTHORIZATION=f"Basic {token}",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_rejects_unknown_category(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url, {"title": "X", "category": "recipes"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", response.data)

    def test_create_rejects_blank_slug(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url,
            {"title": "X", "category": "books", "slug": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("slug", response.data)

    def test_patch_updates_a_field(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            self.detail_url(self.published), {"excerpt": "short"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.published.refresh_from_db()
        self.assertEqual(self.published.excerpt, "short")

    def test_patch_publishing_a_draft_stamps_published_at(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            self.detail_url(self.draft), {"status": "published"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.draft.refresh_from_db()
        self.assertIsNotNone(self.draft.published_at)

    def test_put_replaces_the_post(self):
        self.client.force_authenticate(self.user)
        response = self.client.put(
            self.detail_url(self.published),
            {
                "title": "Renamed",
                "slug": self.published.slug,
                "category": "books",
                "excerpt": "",
                "body": "",
                "status": "published",
                "published_at": None,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.published.refresh_from_db()
        self.assertEqual(self.published.title, "Renamed")

    @override_settings(CORS_ALLOWED_ORIGINS=[SPA_ORIGIN])
    def test_allowed_origin_gets_cors_header(self):
        # Without this header the browser discards the response and the SPA sees
        # an opaque network error, so it is worth asserting rather than assuming.
        response = self.client.get(self.list_url, HTTP_ORIGIN=SPA_ORIGIN)
        self.assertEqual(
            response.headers.get("Access-Control-Allow-Origin"),
            SPA_ORIGIN,
        )

    @override_settings(CORS_ALLOWED_ORIGINS=[SPA_ORIGIN])
    def test_preflight_is_answered(self):
        response = self.client.options(
            self.list_url,
            HTTP_ORIGIN=SPA_ORIGIN,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Access-Control-Allow-Headers", response.headers)

    @override_settings(CORS_ALLOWED_ORIGINS=[SPA_ORIGIN])
    def test_unknown_origin_gets_no_cors_header(self):
        response = self.client.get(self.list_url, HTTP_ORIGIN="http://evil.example")
        self.assertIsNone(response.headers.get("Access-Control-Allow-Origin"))

    def test_delete_removes_the_post(self):
        self.client.force_authenticate(self.user)
        response = self.client.delete(self.detail_url(self.sale))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Post.objects.filter(pk=self.sale.pk).exists())

    def test_anonymous_cannot_delete(self):
        response = self.client.delete(self.detail_url(self.sale))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Post.objects.filter(pk=self.sale.pk).exists())


class SessionAuthTests(APITestCase):
    """The cookie-and-CSRF flow behind the SPA's /admin page."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="zian", password="pw-for-tests")
        cls.session_url = reverse("auth-session")
        cls.login_url = reverse("auth-login")
        cls.logout_url = reverse("auth-logout")
        cls.posts_url = reverse("post-list")

    def setUp(self):
        # CSRF is what these tests are about, so the check has to be on: the
        # default test client skips the one thing a browser will not.
        self.client = APIClient(enforce_csrf_checks=True)

    def start_session(self):
        """GET the session endpoint, returning the CSRF token it hands out."""
        return self.client.get(self.session_url).data["csrf_token"]

    def log_in(self):
        """Log in, returning the post-login CSRF token."""
        response = self.client.post(
            self.login_url,
            {"username": "zian", "password": "pw-for-tests"},
            format="json",
            HTTP_X_CSRFTOKEN=self.start_session(),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["csrf_token"]

    def create_post(self, token, title="Written By The Admin Page"):
        return self.client.post(
            self.posts_url,
            {"title": title, "category": "books"},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )

    # --- session state ------------------------------------------------------

    def test_session_reports_anonymous_and_sets_the_csrf_cookie(self):
        response = self.client.get(self.session_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["authenticated"])
        self.assertIsNone(response.data["username"])
        self.assertIn("csrftoken", response.cookies)

    def test_session_reports_the_user_after_login(self):
        self.log_in()
        response = self.client.get(self.session_url)
        self.assertTrue(response.data["authenticated"])
        self.assertEqual(response.data["username"], "zian")

    # --- login --------------------------------------------------------------

    def test_login_returns_the_username(self):
        response = self.client.post(
            self.login_url,
            {"username": "zian", "password": "pw-for-tests"},
            format="json",
            HTTP_X_CSRFTOKEN=self.start_session(),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["authenticated"])
        self.assertEqual(response.data["username"], "zian")

    def test_login_rejects_a_bad_password(self):
        response = self.client.post(
            self.login_url,
            {"username": "zian", "password": "wrong"},
            format="json",
            HTTP_X_CSRFTOKEN=self.start_session(),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_login_requires_a_csrf_token(self):
        # DRF's as_view() is csrf_exempt and an anonymous request is never
        # CSRF-checked by SessionAuthentication, so this only holds because
        # LoginView carries csrf_protect.
        response = self.client.post(
            self.login_url,
            {"username": "zian", "password": "pw-for-tests"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- writing with the session -------------------------------------------

    def test_write_with_a_session_but_no_csrf_token_is_rejected(self):
        self.log_in()
        response = self.client.post(
            self.posts_url, {"title": "No Token", "category": "books"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Post.objects.filter(title="No Token").exists())

    def test_write_succeeds_with_the_token_login_returned(self):
        response = self.create_post(self.log_in())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_the_token_from_before_login_no_longer_works(self):
        # login() rotates the CSRF secret, which is why the login response
        # carries a fresh token instead of leaving the client to reuse its own.
        stale = self.start_session()
        self.log_in()
        self.assertEqual(
            self.create_post(stale).status_code, status.HTTP_403_FORBIDDEN
        )

    def test_session_write_can_see_and_publish_a_draft(self):
        # The admin page's whole job: drafts are invisible anonymously.
        token = self.log_in()
        draft = Post.objects.create(title="Hidden", category=Post.Category.BOOKS)
        detail = reverse("post-detail", kwargs={"slug": draft.slug})

        self.assertEqual(
            self.client.get(detail).status_code, status.HTTP_200_OK
        )
        response = self.client.patch(
            detail, {"status": "published"}, format="json", HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        draft.refresh_from_db()
        self.assertIsNotNone(draft.published_at)

    # --- logout -------------------------------------------------------------

    def test_logout_ends_the_session(self):
        token = self.log_in()
        response = self.client.post(
            self.logout_url, format="json", HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["authenticated"])
        self.assertFalse(self.client.get(self.session_url).data["authenticated"])

    def test_logout_requires_authentication(self):
        response = self.client.post(
            self.logout_url, format="json", HTTP_X_CSRFTOKEN=self.start_session()
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


def png_bytes(size=(4, 4), image_format="PNG"):
    """A real image, encoded in memory -- the upload endpoint hands the bytes to
    Pillow, so a fixture of `b"not an image"` would be rejected before it ever
    reached the logic under test."""
    buffer = io.BytesIO()
    Image.new("RGB", size, "blue").save(buffer, format=image_format)
    return buffer.getvalue()


# InMemoryStorage, so the suite never needs MinIO running -- and never leaves
# test uploads sitting in a real bucket. The view only ever calls save()/url()
# on the default storage, so swapping the backend exercises the same code path.
@override_settings(
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
)
class ImageUploadTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="zian", password="pw-for-tests")
        cls.url = reverse("upload-image")

    def upload(self, file, **kwargs):
        return self.client.post(self.url, {"file": file}, format="multipart", **kwargs)

    def png_upload(self, name="Screen Shot.png", **kwargs):
        return SimpleUploadedFile(name, png_bytes(**kwargs), content_type="image/png")

    def test_anonymous_cannot_upload(self):
        response = self.upload(self.png_upload())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_upload_returns_a_url(self):
        self.client.force_authenticate(self.user)
        response = self.upload(self.png_upload())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["url"])
        self.assertTrue(response.data["name"].startswith("uploads/"))

    def test_stored_name_is_slugified_and_suffixed(self):
        # The uploaded filename has a space and mixed case; the key must not,
        # and two uploads of the same name must not collide.
        self.client.force_authenticate(self.user)
        first = self.upload(self.png_upload()).data["name"]
        second = self.upload(self.png_upload()).data["name"]
        self.assertRegex(first, r"^uploads/\d{4}/\d{2}/screen-shot-[0-9a-f]{8}\.png$")
        self.assertNotEqual(first, second)

    def test_extension_follows_the_real_format_not_the_filename(self):
        # A JPEG uploaded as "photo.png" is stored as .jpg: the extension comes
        # from Pillow's verdict on the bytes, never from the name.
        self.client.force_authenticate(self.user)
        jpeg = SimpleUploadedFile(
            "photo.png", png_bytes(image_format="JPEG"), content_type="image/png"
        )
        self.assertTrue(self.upload(jpeg).data["name"].endswith(".jpg"))

    def test_non_image_is_rejected(self):
        # Correct extension, correct Content-Type, contents that are neither.
        self.client.force_authenticate(self.user)
        response = self.upload(
            SimpleUploadedFile("payload.png", b"MZ\x00not an image", "image/png")
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)

    @override_settings(MAX_UPLOAD_SIZE=100)
    def test_oversized_image_is_rejected(self):
        self.client.force_authenticate(self.user)
        response = self.upload(self.png_upload(size=(400, 400)))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)

    def test_missing_file_is_rejected(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class CoverImageTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="zian", password="pw-for-tests")
        cls.list_url = reverse("post-list")

    def test_cover_fields_default_to_blank(self):
        post = Post.objects.create(title="No Cover", category=Post.Category.BOOKS)
        self.assertEqual(post.cover_image_url, "")
        self.assertEqual(post.cover_image_alt, "")

    def test_create_with_a_cover_url(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url,
            {
                "title": "With Cover",
                "category": "books",
                "cover_image_url": "http://localhost:9000/ziantsabit-media/a.png",
                "cover_image_alt": "A blue square",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.data["cover_image_url"],
            "http://localhost:9000/ziantsabit-media/a.png",
        )
        self.assertEqual(response.data["cover_image_alt"], "A blue square")

    def test_cover_url_must_be_a_url(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url,
            {"title": "Bad", "category": "books", "cover_image_url": "not a url"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cover_image_url", response.data)

    def test_cover_is_exposed_to_anonymous_readers(self):
        Post.objects.create(
            title="Public",
            category=Post.Category.BOOKS,
            status=Post.Status.PUBLISHED,
            cover_image_url="http://localhost:9000/ziantsabit-media/b.png",
        )
        response = self.client.get(self.list_url)
        self.assertEqual(
            response.data["results"][0]["cover_image_url"],
            "http://localhost:9000/ziantsabit-media/b.png",
        )

    def test_cover_can_be_cleared(self):
        post = Post.objects.create(
            title="Clear Me",
            category=Post.Category.BOOKS,
            cover_image_url="http://localhost:9000/ziantsabit-media/c.png",
        )
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            reverse("post-detail", args=[post.slug]),
            {"cover_image_url": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["cover_image_url"], "")
