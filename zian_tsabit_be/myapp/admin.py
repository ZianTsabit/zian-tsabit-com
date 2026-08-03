from django.contrib import admin

from .models import Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "status", "published_at", "updated_at")
    list_filter = ("category", "status")
    search_fields = ("title", "excerpt", "body")
    # Blank is allowed here too: Post.save() fills it in from the title.
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "created_at"
