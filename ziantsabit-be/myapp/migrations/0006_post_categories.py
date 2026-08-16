"""Move `category` (one section) to `categories` (one or more).

Three steps in one migration, and the order matters: the new column has to
exist before the data can be copied into it, and the old one cannot be dropped
until it has been. The RunPython is reversible, so `migrate myapp 0005` puts
every post back -- a post filed under several sections keeps whichever comes
first in Category's declaration order, since a single column has room for one.
"""

import django.contrib.postgres.fields
import django.contrib.postgres.indexes
from django.db import migrations, models


def to_categories(apps, schema_editor):
    Post = apps.get_model("myapp", "Post")
    # A plain UPDATE per row rather than bulk_update: the table is small, and
    # this way the migration reads as what it is. F()-style array construction
    # would need raw SQL for no gain at this size.
    for post in Post.objects.all().iterator():
        post.categories = [post.category] if post.category else []
        post.save(update_fields=["categories"])


def to_category(apps, schema_editor):
    Post = apps.get_model("myapp", "Post")
    # Historical models carry no methods, so the declaration order this has to
    # agree with is spelled out rather than read off Post.Category.
    order = ["posts", "books", "projects", "garage_sale"]
    for post in Post.objects.all().iterator():
        chosen = sorted(
            post.categories or [],
            key=lambda value: order.index(value) if value in order else len(order),
        )
        post.category = chosen[0] if chosen else "posts"
        post.save(update_fields=["category"])


class Migration(migrations.Migration):

    dependencies = [
        ("myapp", "0005_post_tags"),
    ]

    operations = [
        # The composite index goes first: it names `category`, so the column
        # cannot be dropped while it still exists.
        migrations.RemoveIndex(
            model_name="post",
            name="myapp_post_categor_f3c795_idx",
        ),
        migrations.AddField(
            model_name="post",
            name="categories",
            field=django.contrib.postgres.fields.ArrayField(
                base_field=models.CharField(
                    choices=[
                        ("posts", "Posts"),
                        ("books", "Books"),
                        ("projects", "Projects"),
                        ("garage_sale", "Garage Sale"),
                    ],
                    max_length=20,
                ),
                default=list,
                size=None,
            ),
        ),
        # Relaxing `category` to nullable before the copy is what makes this
        # migration reversible. Going backwards, Django re-adds the column in
        # whatever state it held just before RemoveField -- and a NOT NULL
        # CharField with no default cannot be added to a table that already has
        # rows. Nullable here means the reverse adds an empty column, then
        # `to_category` fills it, and only then does this step's own reverse
        # tighten it back to NOT NULL, by which point every row has a value.
        migrations.AlterField(
            model_name="post",
            name="category",
            field=models.CharField(
                choices=[
                    ("posts", "Posts"),
                    ("books", "Books"),
                    ("projects", "Projects"),
                    ("garage_sale", "Garage Sale"),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.RunPython(to_categories, to_category),
        migrations.RemoveField(
            model_name="post",
            name="category",
        ),
        migrations.AddIndex(
            model_name="post",
            index=django.contrib.postgres.indexes.GinIndex(
                fields=["categories"], name="myapp_post_categor_b314ed_gin"
            ),
        ),
        migrations.AddIndex(
            model_name="post",
            index=models.Index(fields=["status"], name="myapp_post_status_5a87b3_idx"),
        ),
    ]
