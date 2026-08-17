from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Post(models.Model):
    """A single piece of content, filed under one or more of the site's sections.

    Replaces the earlier Book / Project / GarageSale / Update models: those were
    four near-identical title-plus-fields tables, and the site renders them as
    three feeds that differ only by which section you are looking at.
    """

    class Category(models.TextChoices):
        POSTS = "posts", "Posts"
        BOOKS = "books", "Books"
        PROJECTS = "projects", "Projects"
        GARAGE_SALE = "garage_sale", "Garage Sale"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    title = models.CharField(max_length=200)
    # Left blank on create and derived from the title in save(); it is the URL
    # key the API looks posts up by, so it has to stay unique.
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    # A post can sit in more than one section -- a write-up of a book that is
    # also a project belongs on both feeds, and duplicating the post to achieve
    # that would mean two slugs, two view counts and two things to keep in step.
    #
    # An ArrayField for the same reasons as `tags` below: the sections are a
    # fixed enum declared right here, so a Category table would carry no column
    # this does not, and nothing ever reads a category without its post.
    # Membership is a set -- stored order carries no meaning, and nothing may
    # read it as ranking -- but it is deduplicated and kept in the order
    # declared above so two equal posts cannot differ by row order alone.
    categories = ArrayField(
        models.CharField(max_length=20, choices=Category.choices),
        default=list,
    )
    excerpt = models.TextField(blank=True)
    body = models.TextField(blank=True)
    # The post's lead image, shown on its card and above the body. A URL rather
    # than an ImageField because the bytes are uploaded separately, through
    # /api/uploads/images/: the New Post form has to be able to attach an image
    # before the post it belongs to exists, and an ImageField has nothing to
    # hang that upload off until after the first save. It also means a cover and
    # an inline `![](...)` in the body are the same kind of thing -- a URL.
    cover_image_url = models.URLField(max_length=500, blank=True)
    # Falls back to the title at render time; a decorative cover is better
    # described by nothing than by its filename.
    cover_image_alt = models.CharField(max_length=200, blank=True)
    # Free-form labels, kept in the order they were typed. An ArrayField rather
    # than a Tag table and a join: nothing here needs a canonical tag row to
    # hang a description or a count off, and a post's tags are only ever read
    # with the post itself. Postgres is the only database this project supports
    # -- there is deliberately no sqlite fallback -- so it costs no portability.
    tags = ArrayField(models.CharField(max_length=50), default=list, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    published_at = models.DateTimeField(null=True, blank=True)
    # Bumped by POST /api/posts/{slug}/view/ with an F() expression, never by
    # save() -- a read must not touch updated_at, and two readers arriving at
    # once must not each write back the same stale number.
    view_count = models.PositiveIntegerField(default=0, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Newest first, and a post with no publish date yet still sorts
        # sensibly because created_at breaks the tie.
        ordering = ["-published_at", "-created_at"]
        indexes = [
            # GIN, because the section filter is now a containment test
            # (categories @> ['books']) and a btree cannot answer that. The
            # composite ("category", "status") index this replaces has no array
            # equivalent, so status keeps its own.
            GinIndex(fields=["categories"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return self.title

    @staticmethod
    def clean_tags(tags):
        """Trim, drop blanks, and drop repeats without regard to case.

        Here rather than in the serializer, for the same reason slug generation
        is: the admin and the shell write posts too, and a tag list that is
        only tidied on the API path would be tidy only some of the time.
        "Django", " django " and "DJANGO" are one tag; the first spelling seen
        is the one kept, since that is the one the author chose to display.
        """
        seen = set()
        cleaned = []
        for tag in tags or []:
            # split()/join() also collapses runs of spaces inside a tag.
            label = " ".join(str(tag).split())
            key = label.casefold()
            if not label or key in seen:
                continue
            seen.add(key)
            cleaned.append(label)
        return cleaned

    @classmethod
    def clean_categories(cls, categories):
        """Drop repeats and return the rest in the order `Category` declares.

        Membership is a set, so ["books", "posts"] and ["posts", "books"] have
        to be the same post -- otherwise the order someone happened to tick the
        boxes in would leak into the API, and every consumer would have to sort
        it themselves before comparing or displaying. Declaration order rather
        than alphabetical, so the badges on a card come out in the same order as
        the sections in the site's nav.

        Unknown values are left alone for the serializer's ChoiceField to
        reject: silently dropping a typo would answer a bad write with a 201.
        """
        rank = {value: index for index, value in enumerate(cls.Category.values)}
        unique = dict.fromkeys(categories or [])
        return sorted(unique, key=lambda value: rank.get(value, len(rank)))

    def save(self, *args, **kwargs):
        self.tags = self.clean_tags(self.tags)
        self.categories = self.clean_categories(self.categories)
        if not self.slug:
            self.slug = self._unique_slug(slugify(self.title) or "post")
        # Publishing without an explicit date stamps it now, so an ordered feed
        # never has a published post sitting at the bottom with a null date.
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    def _unique_slug(self, base):
        """Return `base`, suffixed with -2, -3, ... if it is already taken."""
        slug = base[:220]
        siblings = Post.objects.exclude(pk=self.pk) if self.pk else Post.objects
        suffix = 2
        while siblings.filter(slug=slug).exists():
            tail = f"-{suffix}"
            slug = f"{base[:220 - len(tail)]}{tail}"
            suffix += 1
        return slug


class PostViewDay(models.Model):
    """How many times one post was read on one day.

    `Post.view_count` is a running total and cannot answer "how did last week
    go" -- a counter has no history to look back at. This table is that history,
    one row per post per day it was read, written alongside the counter by
    `POST /api/posts/{slug}/view/`.

    A row per *post* rather than one global row per day: it costs nothing to sum
    at read time, it cascades cleanly when a post is deleted, and it leaves the
    door open to a per-post trend later. The cascade does mean deleting a post
    rewrites the daily chart's past -- which is the same thing that already
    happens to the `total_views` figure above it, and two numbers on one page
    disagreeing about whether a deleted post ever existed would be worse.

    Days that nothing was read on have no row at all, so the table stays
    proportional to activity rather than to the age of the site.
    """

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="view_days")
    # A date, not a datetime: the unit is the bar on the chart. It is the
    # server's local day (settings.TIME_ZONE), so the boundary between two days
    # is one the site's owner recognises rather than each reader's own midnight.
    date = models.DateField()
    count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-date"]
        constraints = [
            # The pair is the identity of a row -- and the reason recording a
            # view can be a single UPDATE, with the INSERT as the fallback for
            # the first read of the day. Without it two concurrent first reads
            # would each insert a row and the day would count them separately.
            models.UniqueConstraint(
                fields=["post", "date"], name="unique_post_view_day"
            ),
        ]
        indexes = [
            # The stats window asks for a range of days across every post, so
            # date leads; the unique constraint's index is on (post, date) and
            # cannot answer that.
            models.Index(fields=["date"]),
        ]

    def __str__(self):
        return f"{self.post.slug} on {self.date}: {self.count}"
