from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Post(models.Model):
    """A single piece of content, filed under one of the site's sections.

    Replaces the earlier Book / Project / GarageSale / Update models: those were
    four near-identical title-plus-fields tables, and the site renders them as
    three feeds that differ only by which section you are looking at.
    """

    class Category(models.TextChoices):
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
    category = models.CharField(max_length=20, choices=Category.choices)
    excerpt = models.TextField(blank=True)
    body = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Newest first, and a post with no publish date yet still sorts
        # sensibly because created_at breaks the tie.
        ordering = ["-published_at", "-created_at"]
        indexes = [
            models.Index(fields=["category", "status"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
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
