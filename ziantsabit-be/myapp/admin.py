from django.contrib import admin

from .models import Post


class CategoryFilter(admin.SimpleListFilter):
    """Sidebar filter over `categories`.

    Hand-written because `list_filter = ("categories",)` cannot work on an
    ArrayField: Django builds an exact-match filter from it, so the sidebar
    would offer whole combinations ("books, projects") as if they were single
    values and match nothing else. This asks the question that actually makes
    sense -- is this section one of the post's -- which is the same containment
    test `?category=` performs on the API.
    """

    title = "category"
    parameter_name = "category"

    def lookups(self, request, model_admin):
        return Post.Category.choices

    def queryset(self, request, queryset):
        value = self.value()
        if not value:
            return queryset
        return queryset.filter(categories__contains=[value])


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "category_list", "status", "published_at", "updated_at")
    list_filter = (CategoryFilter, "status")
    search_fields = ("title", "excerpt", "body")
    # Blank is allowed here too: Post.save() fills it in from the title.
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "created_at"

    @admin.display(description="Categories")
    def category_list(self, post):
        # Labels rather than the stored values, matching what every other
        # column shows. Post.save() has already put them in declaration order.
        labels = dict(Post.Category.choices)
        return ", ".join(labels.get(value, value) for value in post.categories)
