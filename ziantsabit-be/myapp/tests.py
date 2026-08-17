import base64
import datetime
import io

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import Post, PostViewDay
from .views import DAILY_VIEWS_DAYS

# The CORS tests below pin this rather than relying on settings.py's default,
# so they assert the behaviour and not the environment: a deployment sets
# CORS_ALLOWED_ORIGINS to its real site origin, and without the override the
# suite fails inside exactly the container it is supposed to be validating.
SPA_ORIGIN = "http://spa.test"


class PostModelTests(APITestCase):
    def test_slug_is_derived_from_title(self):
        post = Post.objects.create(title="Clean Code", categories=[Post.Category.BOOKS])
        self.assertEqual(post.slug, "clean-code")

    def test_duplicate_titles_get_distinct_slugs(self):
        first = Post.objects.create(title="Clean Code", categories=[Post.Category.BOOKS])
        second = Post.objects.create(title="Clean Code", categories=[Post.Category.BOOKS])
        third = Post.objects.create(title="Clean Code", categories=[Post.Category.BOOKS])
        self.assertEqual(
            [first.slug, second.slug, third.slug],
            ["clean-code", "clean-code-2", "clean-code-3"],
        )

    def test_explicit_slug_is_kept(self):
        post = Post.objects.create(
            title="Clean Code", slug="the-one", categories=[Post.Category.BOOKS]
        )
        self.assertEqual(post.slug, "the-one")

    def test_publishing_stamps_published_at(self):
        post = Post.objects.create(
            title="Shipped",
            categories=[Post.Category.PROJECTS],
            status=Post.Status.PUBLISHED,
        )
        self.assertIsNotNone(post.published_at)

    def test_draft_has_no_published_at(self):
        post = Post.objects.create(title="Draft", categories=[Post.Category.BOOKS])
        self.assertIsNone(post.published_at)

    def test_title_of_only_punctuation_still_gets_a_slug(self):
        post = Post.objects.create(title="!!!", categories=[Post.Category.BOOKS])
        self.assertEqual(post.slug, "post")


class PostAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="zian", password="pw-for-tests")
        cls.list_url = reverse("post-list")
        cls.published = Post.objects.create(
            title="Published Book",
            categories=[Post.Category.BOOKS],
            status=Post.Status.PUBLISHED,
        )
        cls.draft = Post.objects.create(
            title="Draft Project", categories=[Post.Category.PROJECTS]
        )
        cls.sale = Post.objects.create(
            title="Old Desk",
            categories=[Post.Category.GARAGE_SALE],
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
            categories=[Post.Category.POSTS],
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

    def test_a_post_in_two_sections_is_returned_by_both(self):
        both = Post.objects.create(
            title="Building a Bookshelf",
            categories=[Post.Category.BOOKS, Post.Category.PROJECTS],
            status=Post.Status.PUBLISHED,
        )
        for section in ("books", "projects"):
            with self.subTest(section=section):
                response = self.client.get(self.list_url, {"category": section})
                slugs = [r["slug"] for r in response.data["results"]]
                self.assertIn(both.slug, slugs)

    def test_a_post_appears_once_in_an_unfiltered_list(self):
        # Containment, not a join: the multi-section post must not arrive twice
        # just because it matches on two counts.
        Post.objects.create(
            title="Building a Bookshelf",
            categories=[Post.Category.BOOKS, Post.Category.PROJECTS],
            status=Post.Status.PUBLISHED,
        )
        response = self.client.get(self.list_url)
        slugs = [r["slug"] for r in response.data["results"]]
        self.assertEqual(len(slugs), len(set(slugs)))

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
            self.list_url, {"title": "Nope", "categories": ["books"]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Post.objects.count(), 3)

    def test_create_generates_slug_and_defaults_to_draft(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url,
            {"title": "A New Post", "categories": ["books"], "body": "hello"},
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
            {"title": "Via Curl", "categories": ["books"]},
            format="json",
            HTTP_AUTHORIZATION=f"Basic {token}",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_rejects_unknown_category(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url, {"title": "X", "categories": ["recipes"]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("categories", response.data)

    def test_create_rejects_empty_categories(self):
        # A post filed under nothing appears on no page: invisible, and only
        # discoverable by going looking for it in the admin list.
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url, {"title": "Homeless", "categories": []}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("categories", response.data)

    def test_create_rejects_missing_categories(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url, {"title": "Homeless"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("categories", response.data)

    def test_categories_are_deduplicated_and_ordered_on_write(self):
        # Membership is a set, so the order the boxes were ticked in must not
        # survive into the API -- two identical posts would otherwise compare
        # unequal on nothing but row order.
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url,
            {
                "title": "Tidied",
                "categories": ["projects", "books", "projects"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["categories"], ["books", "projects"])
        self.assertEqual(
            Post.objects.get(slug=response.data["slug"]).categories,
            ["books", "projects"],
        )

    def test_model_save_orders_categories_for_the_shell_too(self):
        post = Post.objects.create(
            title="Shell Written",
            categories=[Post.Category.GARAGE_SALE, Post.Category.POSTS],
        )
        post.refresh_from_db()
        self.assertEqual(post.categories, ["posts", "garage_sale"])

    def test_create_rejects_blank_slug(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url,
            {"title": "X", "categories": ["books"], "slug": "   "},
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
                "categories": ["books"],
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
            {"title": title, "categories": ["books"]},
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
            self.posts_url, {"title": "No Token", "categories": ["books"]}, format="json"
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
        draft = Post.objects.create(title="Hidden", categories=[Post.Category.BOOKS])
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
        post = Post.objects.create(title="No Cover", categories=[Post.Category.BOOKS])
        self.assertEqual(post.cover_image_url, "")
        self.assertEqual(post.cover_image_alt, "")

    def test_create_with_a_cover_url(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url,
            {
                "title": "With Cover",
                "categories": ["books"],
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
            {"title": "Bad", "categories": ["books"], "cover_image_url": "not a url"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cover_image_url", response.data)

    def test_cover_is_exposed_to_anonymous_readers(self):
        Post.objects.create(
            title="Public",
            categories=[Post.Category.BOOKS],
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
            categories=[Post.Category.BOOKS],
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


class ViewCountTests(APITestCase):
    """The read counter: POST /api/posts/{slug}/view/ and ?ordering=views."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="zian", password="pw-for-tests")
        cls.list_url = reverse("post-list")
        cls.popular = Post.objects.create(
            title="Popular",
            categories=[Post.Category.POSTS],
            status=Post.Status.PUBLISHED,
        )
        cls.quiet = Post.objects.create(
            title="Quiet",
            categories=[Post.Category.POSTS],
            status=Post.Status.PUBLISHED,
        )
        cls.draft = Post.objects.create(title="Hidden", categories=[Post.Category.POSTS])

    def view_url(self, post):
        return reverse("post-record-view", kwargs={"slug": post.slug})

    def test_new_post_starts_at_zero(self):
        self.assertEqual(self.quiet.view_count, 0)

    def test_anonymous_can_record_a_view(self):
        response = self.client.post(self.view_url(self.popular))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"slug": self.popular.slug, "view_count": 1})

    def test_views_accumulate(self):
        for _ in range(3):
            self.client.post(self.view_url(self.popular))
        self.popular.refresh_from_db()
        self.assertEqual(self.popular.view_count, 3)

    def test_recording_a_view_does_not_touch_updated_at(self):
        before = Post.objects.get(pk=self.popular.pk).updated_at
        self.client.post(self.view_url(self.popular))
        self.assertEqual(Post.objects.get(pk=self.popular.pk).updated_at, before)

    def test_anonymous_cannot_record_a_view_on_a_draft(self):
        response = self.client.post(self.view_url(self.draft))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.draft.refresh_from_db()
        self.assertEqual(self.draft.view_count, 0)

    def test_unknown_slug_is_404(self):
        response = self.client.post(
            reverse("post-record-view", kwargs={"slug": "nothing-here"})
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_view_count_is_serialised(self):
        Post.objects.filter(pk=self.popular.pk).update(view_count=7)
        response = self.client.get(
            reverse("post-detail", kwargs={"slug": self.popular.slug})
        )
        self.assertEqual(response.data["view_count"], 7)

    def test_view_count_is_read_only_on_a_write(self):
        Post.objects.filter(pk=self.popular.pk).update(view_count=7)
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            reverse("post-detail", kwargs={"slug": self.popular.slug}),
            {"view_count": 0},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.popular.refresh_from_db()
        self.assertEqual(self.popular.view_count, 7)

    def test_ordering_by_views(self):
        Post.objects.filter(pk=self.quiet.pk).update(view_count=1)
        Post.objects.filter(pk=self.popular.pk).update(view_count=9)
        response = self.client.get(self.list_url, {"ordering": "views"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["slug"] for row in response.data["results"]],
            [self.popular.slug, self.quiet.slug],
        )

    def test_default_ordering_is_still_newest_first(self):
        Post.objects.filter(pk=self.popular.pk).update(view_count=9)
        response = self.client.get(self.list_url)
        self.assertEqual(
            [row["slug"] for row in response.data["results"]],
            [self.quiet.slug, self.popular.slug],
        )

    def test_ordering_combines_with_a_category_filter(self):
        book = Post.objects.create(
            title="A Book",
            categories=[Post.Category.BOOKS],
            status=Post.Status.PUBLISHED,
        )
        Post.objects.filter(pk=self.popular.pk).update(view_count=9)
        response = self.client.get(
            self.list_url, {"ordering": "views", "category": "books"}
        )
        self.assertEqual(
            [row["slug"] for row in response.data["results"]], [book.slug]
        )

    def test_unknown_ordering_is_rejected(self):
        response = self.client.get(self.list_url, {"ordering": "most-read"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ordering", response.data)


class ViewDayTests(APITestCase):
    """PostViewDay: the same reads as the counter, filed under the day they happened."""

    @classmethod
    def setUpTestData(cls):
        cls.post = Post.objects.create(
            title="Popular",
            categories=[Post.Category.POSTS],
            status=Post.Status.PUBLISHED,
        )
        cls.other = Post.objects.create(
            title="Also Read",
            categories=[Post.Category.POSTS],
            status=Post.Status.PUBLISHED,
        )
        cls.draft = Post.objects.create(title="Hidden", categories=[Post.Category.POSTS])

    def view_url(self, post):
        return reverse("post-record-view", kwargs={"slug": post.slug})

    def test_a_read_is_filed_under_today(self):
        self.client.post(self.view_url(self.post))
        row = PostViewDay.objects.get(post=self.post)
        self.assertEqual(row.date, timezone.localdate())
        self.assertEqual(row.count, 1)

    def test_further_reads_the_same_day_raise_one_row(self):
        # The insert happens once; every read after it is an UPDATE, which is
        # what keeps a day from becoming a pile of rows.
        for _ in range(4):
            self.client.post(self.view_url(self.post))
        self.assertEqual(PostViewDay.objects.filter(post=self.post).count(), 1)
        self.assertEqual(PostViewDay.objects.get(post=self.post).count, 4)

    def test_each_post_keeps_its_own_row(self):
        self.client.post(self.view_url(self.post))
        self.client.post(self.view_url(self.other))
        self.assertEqual(PostViewDay.objects.count(), 2)

    def test_the_daily_row_matches_the_counter(self):
        for _ in range(3):
            self.client.post(self.view_url(self.post))
        self.post.refresh_from_db()
        self.assertEqual(
            self.post.view_count, PostViewDay.objects.get(post=self.post).count
        )

    def test_a_refused_read_records_nothing(self):
        # Anonymous callers get a 404 on a draft, and a 404 is not a read.
        self.client.post(self.view_url(self.draft))
        self.assertFalse(PostViewDay.objects.filter(post=self.draft).exists())

    def test_deleting_a_post_takes_its_history_with_it(self):
        self.client.post(self.view_url(self.post))
        self.post.delete()
        self.assertEqual(PostViewDay.objects.count(), 0)


class TagTests(APITestCase):
    """Post.tags: a list of labels, tidied in save() and writable through the API."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="zian", password="pw-for-tests")
        cls.list_url = reverse("post-list")

    def detail_url(self, post):
        return reverse("post-detail", kwargs={"slug": post.slug})

    def test_a_post_starts_with_no_tags(self):
        post = Post.objects.create(title="Untagged", categories=[Post.Category.POSTS])
        self.assertEqual(post.tags, [])

    def test_tags_are_trimmed_and_blanks_dropped(self):
        post = Post.objects.create(
            title="Tagged",
            categories=[Post.Category.POSTS],
            tags=["  django ", "", "   ", "postgres"],
        )
        self.assertEqual(post.tags, ["django", "postgres"])

    def test_repeats_are_dropped_case_insensitively_keeping_the_first_spelling(self):
        post = Post.objects.create(
            title="Repeats",
            categories=[Post.Category.POSTS],
            tags=["Django", "django", "DJANGO"],
        )
        self.assertEqual(post.tags, ["Django"])

    def test_order_is_preserved(self):
        post = Post.objects.create(
            title="Ordered",
            categories=[Post.Category.POSTS],
            tags=["zebra", "apple", "mango"],
        )
        self.assertEqual(post.tags, ["zebra", "apple", "mango"])

    def test_tags_are_serialised(self):
        post = Post.objects.create(
            title="Serialised",
            categories=[Post.Category.POSTS],
            status=Post.Status.PUBLISHED,
            tags=["django", "rest"],
        )
        response = self.client.get(self.detail_url(post))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tags"], ["django", "rest"])

    def test_create_with_tags(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url,
            {
                "title": "Created",
                "categories": [Post.Category.POSTS],
                "tags": ["Django", " django ", "postgres"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Cleaned on the way in, so the response is what was actually stored.
        self.assertEqual(response.data["tags"], ["Django", "postgres"])

    def test_patch_replaces_the_whole_list(self):
        post = Post.objects.create(
            title="Replaced", categories=[Post.Category.POSTS], tags=["one", "two"]
        )
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            self.detail_url(post), {"tags": ["three"]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        post.refresh_from_db()
        self.assertEqual(post.tags, ["three"])

    def test_an_unrelated_patch_leaves_tags_alone(self):
        post = Post.objects.create(
            title="Kept", categories=[Post.Category.POSTS], tags=["one", "two"]
        )
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            self.detail_url(post), {"title": "Kept, renamed"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        post.refresh_from_db()
        self.assertEqual(post.tags, ["one", "two"])

    def test_tags_can_be_cleared(self):
        post = Post.objects.create(
            title="Cleared", categories=[Post.Category.POSTS], tags=["one"]
        )
        self.client.force_authenticate(self.user)
        response = self.client.patch(self.detail_url(post), {"tags": []}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        post.refresh_from_db()
        self.assertEqual(post.tags, [])

    def test_an_overlong_tag_is_rejected(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            self.list_url,
            {
                "title": "Too long",
                "categories": [Post.Category.POSTS],
                "tags": ["x" * 51],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tags", response.data)

    def test_anonymous_callers_cannot_write_tags(self):
        post = Post.objects.create(title="Guarded", categories=[Post.Category.POSTS])
        response = self.client.patch(
            self.detail_url(post), {"tags": ["sneaky"]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        post.refresh_from_db()
        self.assertEqual(post.tags, [])


class UpdatedOrderingTests(APITestCase):
    """?ordering=updated -- most recently edited first.

    Every timestamp here is written with queryset.update() rather than save():
    updated_at is auto_now, so a save() would overwrite the value under test
    with "now" and the assertions would pass for the wrong reason.
    """

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="zian", password="pw-for-tests")
        cls.list_url = reverse("post-list")
        now = timezone.now()

        # Published first, but edited most recently -- the two orderings
        # therefore disagree about it, which is the whole point of the option.
        cls.revised = Post.objects.create(
            title="Revised",
            categories=[Post.Category.POSTS],
            status=Post.Status.PUBLISHED,
        )
        cls.newer = Post.objects.create(
            title="Newer",
            categories=[Post.Category.POSTS],
            status=Post.Status.PUBLISHED,
        )
        Post.objects.filter(pk=cls.revised.pk).update(
            published_at=now - datetime.timedelta(days=30),
            updated_at=now - datetime.timedelta(minutes=1),
        )
        Post.objects.filter(pk=cls.newer.pk).update(
            published_at=now - datetime.timedelta(days=1),
            updated_at=now - datetime.timedelta(days=1),
        )

    def slugs(self, **params):
        response = self.client.get(self.list_url, params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return [row["slug"] for row in response.data["results"]]

    def test_most_recently_edited_comes_first(self):
        self.assertEqual(
            self.slugs(ordering="updated"), [self.revised.slug, self.newer.slug]
        )

    def test_it_differs_from_the_default_ordering(self):
        # Same two posts, opposite order: proves the param is doing the work
        # rather than the fixtures happening to agree.
        self.assertEqual(self.slugs(), [self.newer.slug, self.revised.slug])

    def test_editing_a_post_moves_it_to_the_front(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            reverse("post-detail", kwargs={"slug": self.newer.slug}),
            {"title": "Newer, revised"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.force_authenticate(None)
        self.assertEqual(
            self.slugs(ordering="updated"), [self.newer.slug, self.revised.slug]
        )

    def test_recording_a_view_does_not_reorder(self):
        # The counter is an F() UPDATE precisely so it does not touch
        # updated_at; if that ever became a save(), reading a post would
        # silently promote it to the top of Home's feed.
        self.client.post(reverse("post-record-view", kwargs={"slug": self.newer.slug}))
        self.assertEqual(
            self.slugs(ordering="updated"), [self.revised.slug, self.newer.slug]
        )

    def test_drafts_stay_hidden_from_anonymous_callers(self):
        draft = Post.objects.create(title="Hidden", categories=[Post.Category.POSTS])
        Post.objects.filter(pk=draft.pk).update(updated_at=timezone.now())
        self.assertNotIn(draft.slug, self.slugs(ordering="updated"))

    def test_it_combines_with_a_category_filter(self):
        book = Post.objects.create(
            title="A Book",
            categories=[Post.Category.BOOKS],
            status=Post.Status.PUBLISHED,
        )
        self.assertEqual(
            self.slugs(ordering="updated", category="books"), [book.slug]
        )


class DateFilterTests(APITestCase):
    """?published_after= / ?published_before=, both inclusive."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="zian", password="pw-for-tests")
        cls.list_url = reverse("post-list")
        cls.old = cls._post("Old", "2026-01-10")
        cls.middle = cls._post("Middle", "2026-05-20")
        cls.recent = cls._post("Recent", "2026-08-01")
        # No published_at at all: it is filtered by created_at instead, which
        # is what the admin list shows for a draft.
        cls.draft = Post.objects.create(title="Draft", categories=[Post.Category.POSTS])

    @staticmethod
    def _post(title, day):
        post = Post.objects.create(
            title=title,
            categories=[Post.Category.POSTS],
            status=Post.Status.PUBLISHED,
        )
        # save() stamped published_at with now(); pin it to the day under test.
        stamp = datetime.datetime.fromisoformat(f"{day}T12:00:00+00:00")
        Post.objects.filter(pk=post.pk).update(published_at=stamp)
        post.refresh_from_db()
        return post

    def slugs(self, response):
        return {row["slug"] for row in response.data["results"]}

    def test_after_is_inclusive_of_its_own_day(self):
        response = self.client.get(self.list_url, {"published_after": "2026-05-20"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.slugs(response), {self.middle.slug, self.recent.slug})

    def test_before_is_inclusive_of_its_own_day(self):
        response = self.client.get(self.list_url, {"published_before": "2026-05-20"})
        self.assertEqual(self.slugs(response), {self.old.slug, self.middle.slug})

    def test_both_ends_together_are_a_range(self):
        response = self.client.get(
            self.list_url,
            {"published_after": "2026-02-01", "published_before": "2026-07-01"},
        )
        self.assertEqual(self.slugs(response), {self.middle.slug})

    def test_range_with_nothing_in_it_is_empty_not_an_error(self):
        response = self.client.get(
            self.list_url,
            {"published_after": "2026-09-01", "published_before": "2026-09-30"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"], [])

    def test_no_date_params_returns_everything_published(self):
        response = self.client.get(self.list_url)
        self.assertEqual(len(response.data["results"]), 3)

    def test_draft_is_filtered_by_created_at(self):
        self.client.force_authenticate(self.user)
        today = timezone.localdate().isoformat()
        response = self.client.get(self.list_url, {"published_after": today})
        self.assertIn(self.draft.slug, self.slugs(response))

    def test_draft_outside_the_range_drops_out(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(
            self.list_url, {"published_before": "2026-01-01"}
        )
        self.assertNotIn(self.draft.slug, self.slugs(response))

    def test_date_filter_combines_with_category(self):
        book = self._post("A Book", "2026-05-21")
        book.categories = [Post.Category.BOOKS]
        book.save()
        response = self.client.get(
            self.list_url, {"category": "books", "published_after": "2026-05-01"}
        )
        self.assertEqual(self.slugs(response), {book.slug})

    def test_malformed_date_is_rejected(self):
        response = self.client.get(self.list_url, {"published_after": "10-05-2026"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("published_after", response.data)

    def test_impossible_date_is_rejected(self):
        response = self.client.get(self.list_url, {"published_before": "2026-02-31"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("published_before", response.data)

    def test_empty_date_param_is_ignored(self):
        response = self.client.get(self.list_url, {"published_after": ""})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 3)


class PostStatsTests(APITestCase):
    """GET /api/posts/stats/, which backs the admin statistics page."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="zian", password="pw-for-tests")
        cls.url = reverse("post-stats")

        def published(title, when, views):
            post = Post.objects.create(
                title=title,
                categories=[Post.Category.POSTS],
                status=Post.Status.PUBLISHED,
                published_at=datetime.datetime(
                    *when, tzinfo=datetime.timezone.utc
                ),
            )
            # Straight to the column: view_count is editable=False, and a save()
            # would move updated_at for what is meant to be a read.
            Post.objects.filter(pk=post.pk).update(view_count=views)
            return post

        cls.top = published("Most Read", (2026, 3, 4), 300)
        published("Middling", (2026, 3, 20), 100)
        published("Quiet", (2026, 5, 9), 0)
        cls.draft = Post.objects.create(
            title="Unfinished", categories=[Post.Category.POSTS]
        )

    def get(self):
        self.client.force_authenticate(self.user)
        return self.client.get(self.url)

    def test_anonymous_callers_are_refused(self):
        # The draft count and drafts' view counts are the owner's business.
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_totals(self):
        data = self.get().data
        self.assertEqual(data["total"], 4)
        self.assertEqual(data["published"], 3)
        self.assertEqual(data["drafts"], 1)
        self.assertEqual(data["total_views"], 400)

    def test_average_is_per_published_post_not_per_post(self):
        # 400 views over 3 published posts, not over all 4 -- a draft has no
        # public page to be read on.
        self.assertEqual(self.get().data["average_views"], 133.3)

    def test_most_read_is_ranked_and_excludes_unread_posts(self):
        rows = self.get().data["most_read"]
        self.assertEqual([r["view_count"] for r in rows], [300, 100])
        self.assertEqual(rows[0]["slug"], self.top.slug)
        self.assertNotIn("quiet", [r["slug"] for r in rows])

    def test_published_by_month_groups_and_skips_empty_months(self):
        # April has nothing, and the server says so by omission -- filling the
        # gap is the chart's job, since the range to show is a display question.
        self.assertEqual(
            self.get().data["published_by_month"],
            [{"month": "2026-03", "count": 2}, {"month": "2026-05", "count": 1}],
        )

    def test_drafts_are_left_out_of_the_cadence(self):
        months = self.get().data["published_by_month"]
        self.assertEqual(sum(row["count"] for row in months), 3)

    def test_list_filters_do_not_narrow_it(self):
        # An overview of everything: ?category= belongs to the list route, and
        # letting it through here would quietly answer a different question.
        self.client.force_authenticate(self.user)
        response = self.client.get(self.url, {"category": "books"})
        self.assertEqual(response.data["total"], 4)

    def test_an_empty_site_reports_zeroes_rather_than_failing(self):
        Post.objects.all().delete()
        data = self.get().data
        self.assertEqual(data["total"], 0)
        self.assertEqual(data["total_views"], 0)
        self.assertEqual(data["average_views"], 0)
        self.assertEqual(data["views_per_day"], 0)
        self.assertEqual(data["most_read"], [])
        self.assertEqual(data["published_by_month"], [])
        # Still a full window, all of it empty: the chart's x-axis is the last
        # 30 days whether or not anything happened in them.
        self.assertEqual(len(data["views_by_day"]), DAILY_VIEWS_DAYS)
        self.assertEqual({row["count"] for row in data["views_by_day"]}, {0})

    def test_views_by_day_is_a_dense_window_ending_today(self):
        # Dense, unlike published_by_month: the window is anchored to the
        # server's today, which the client has no way to know.
        rows = self.get().data["views_by_day"]
        today = timezone.localdate()
        self.assertEqual(len(rows), DAILY_VIEWS_DAYS)
        self.assertEqual(rows[-1]["date"], today.isoformat())
        self.assertEqual(
            rows[0]["date"],
            (today - datetime.timedelta(days=DAILY_VIEWS_DAYS - 1)).isoformat(),
        )

    def test_views_by_day_sums_every_post_and_drops_older_days(self):
        today = timezone.localdate()
        PostViewDay.objects.create(post=self.top, date=today, count=5)
        PostViewDay.objects.create(post=self.draft, date=today, count=2)
        PostViewDay.objects.create(
            post=self.top, date=today - datetime.timedelta(days=3), count=4
        )
        # Outside the window, so it must not appear anywhere in the series.
        PostViewDay.objects.create(
            post=self.top,
            date=today - datetime.timedelta(days=DAILY_VIEWS_DAYS),
            count=99,
        )

        counts = {row["date"]: row["count"] for row in self.get().data["views_by_day"]}
        self.assertEqual(counts[today.isoformat()], 7)
        self.assertEqual(
            counts[(today - datetime.timedelta(days=3)).isoformat()], 4
        )
        self.assertEqual(sum(counts.values()), 11)

    def test_views_per_day_is_every_view_over_the_days_since_first_publication(self):
        Post.objects.all().delete()
        post = Post.objects.create(
            title="Only One",
            categories=[Post.Category.POSTS],
            status=Post.Status.PUBLISHED,
            published_at=timezone.now() - datetime.timedelta(days=9),
        )
        Post.objects.filter(pk=post.pk).update(view_count=100)
        # Ten days live, both ends counted -- not nine.
        self.assertEqual(self.get().data["views_per_day"], 10.0)

    def test_views_per_day_ignores_reads_a_draft_collected_before_publishing(self):
        # The denominator is the site's public lifetime, so a site with nothing
        # published has no rate at all rather than a divide by zero.
        Post.objects.all().delete()
        draft = Post.objects.create(title="Unfinished", categories=[Post.Category.POSTS])
        Post.objects.filter(pk=draft.pk).update(view_count=12)
        data = self.get().data
        self.assertEqual(data["total_views"], 12)
        self.assertEqual(data["views_per_day"], 0)
