from django.contrib import admin

from .models import Book, Comment, Post, Reaction


class ArrayFieldFilter(admin.SimpleListFilter):
    """Sidebar filter over an `ArrayField` of free-text labels.

    Hand-written because `list_filter = ("tags",)` cannot work on one: Django
    builds an exact-match filter from it, so the sidebar would offer whole
    combinations ("django, postgres") as if they were single values and match
    nothing else. This asks the question that actually makes sense -- is this
    label one of the row's -- which is the same containment test the API's
    `?tag=` and `?genre=` perform.

    Subclasses set `field`, `title` and `parameter_name`; the options come from
    the rows themselves, since there is no enum to read them off.
    """

    field = None

    def lookups(self, request, model_admin):
        labels = sorted(
            {
                label
                for row in model_admin.model.objects.values_list(self.field, flat=True)
                for label in row
            },
            key=str.casefold,
        )
        return [(label, label) for label in labels]

    def queryset(self, request, queryset):
        value = self.value()
        if not value:
            return queryset
        return queryset.filter(**{f"{self.field}__contains": [value]})


class TagFilter(ArrayFieldFilter):
    field = "tags"
    title = "tag"
    parameter_name = "tag"


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "tag_list",
        "status",
        "comments_enabled",
        "reactions_enabled",
        "published_at",
        "updated_at",
    )
    # Both switches are filterable, so "which posts did I close" is a question
    # the sidebar answers rather than one that needs a shell.
    list_filter = (TagFilter, "status", "comments_enabled", "reactions_enabled")
    search_fields = ("title", "excerpt", "body")
    # Blank is allowed here too: Post.save() fills it in from the title.
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "created_at"

    @admin.display(description="Tags")
    def tag_list(self, post):
        # In the order they were typed, which Post.save() preserves.
        return ", ".join(post.tags)


class GenreFilter(ArrayFieldFilter):
    field = "genres"
    title = "genre"
    parameter_name = "genre"


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "release_year", "genre_list", "status", "updated_at")
    list_filter = (GenreFilter, "status")
    search_fields = ("title", "author", "isbn", "review")
    # Blank is allowed: Book.save() derives it, falling back to the author when
    # the title alone is already taken.
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "created_at"

    @admin.display(description="Genres")
    def genre_list(self, book):
        return ", ".join(book.genres)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("author_name", "post", "short_body", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("author_name", "body")
    # The comment itself is the visitor's; only its moderation state is the
    # owner's to change. Editing what someone wrote and leaving their name on it
    # is the one thing a comment box must not make easy.
    readonly_fields = ("post", "author_name", "body", "created_at", "updated_at")
    date_hierarchy = "created_at"
    actions = ("hide", "publish")

    @admin.display(description="Comment")
    def short_body(self, comment):
        # One line in a table, so a long comment is cut rather than allowed to
        # set the row height for every other one.
        text = " ".join(comment.body.split())
        return text if len(text) <= 80 else f"{text[:79]}\u2026"

    @admin.action(description="Hide selected comments")
    def hide(self, request, queryset):
        queryset.update(status=Comment.Status.HIDDEN)

    @admin.action(description="Publish selected comments")
    def publish(self, request, queryset):
        queryset.update(status=Comment.Status.PUBLISHED)


@admin.register(Reaction)
class ReactionAdmin(admin.ModelAdmin):
    list_display = ("emoji", "post", "created_at")
    list_filter = ("emoji",)
    search_fields = ("post__title", "post__slug")
    date_hierarchy = "created_at"
    # Every field of a reaction is either the visitor's tap or the server's
    # clock; there is nothing here to edit, only rows to look at and delete.
    readonly_fields = ("post", "emoji", "visitor", "created_at")

    def has_add_permission(self, request):
        # A reaction is something that happened, not something to author.
        return False
