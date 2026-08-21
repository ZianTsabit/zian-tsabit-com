"""Drop `Post.categories`, keeping what it held as tags.

The fixed enum and the free-form list beside it were doing the same job, and
the enum was doing it worse: adding a section meant a migration, a post could
only ever be filed under one of four things, and every consumer -- the API, the
admin sidebar, the SPA's filter bar, the post form -- had to know both
mechanisms. One list of labels does everything the enum did.

Nothing is thrown away: each post's sections are copied into its tags first, so
a post that was in "projects" is now tagged "Projects" and is still found by
`?tag=projects` (the filter is case-insensitive).
"""

import django.contrib.postgres.indexes
from django.db import migrations

# The enum as it stood at `0008`, with the labels the admin displayed. Copied
# rather than imported: `Post.Category` no longer exists, and a migration that
# reaches into the current models breaks the moment they move on again.
CATEGORY_LABELS = {
    "posts": "Posts",
    "books": "Books",
    "projects": "Projects",
    "garage_sale": "Garage Sale",
}


def to_tags(apps, schema_editor):
    """Append each post's sections to its tags, as display labels.

    Appended rather than prepended, so the tags an author actually typed keep
    leading the list -- these are the machine's contribution and belong after.

    Matches `Post.clean_tags`: a section whose label the post already carries as
    a tag, in any casing, is not added twice. An unknown value (there should be
    none) keeps its stored form rather than being dropped.
    """
    Post = apps.get_model("myapp", "Post")
    changed = []
    for post in Post.objects.all().only("id", "tags", "categories"):
        tags = list(post.tags or [])
        seen = {tag.casefold() for tag in tags}
        for value in post.categories or []:
            label = CATEGORY_LABELS.get(value, value)
            if label.casefold() in seen:
                continue
            seen.add(label.casefold())
            tags.append(label)
        if tags != post.tags:
            post.tags = tags
            changed.append(post)
    # bulk_update rather than save(): the historical model has no save()
    # override, but this is also one statement instead of one per post.
    if changed:
        Post.objects.bulk_update(changed, ["tags"], batch_size=500)


def to_categories(apps, schema_editor):
    """Rebuild `categories` from whatever tags look like section labels.

    Deliberately imperfect, and the one place this migration is: going forward
    is lossless, coming back cannot be. Nothing records which tags were the
    author's and which this migration added, so the reverse **leaves the tags
    alone** -- reversing and re-applying is idempotent (the labels are already
    there and are not added twice) rather than clean.

    A post matching no section label gets `["posts"]`. An empty list was never
    a valid value: filed under nothing, a post appeared on no page at all, and
    the column is about to be `NOT NULL` again.
    """
    Post = apps.get_model("myapp", "Post")
    by_label = {label.casefold(): value for value, label in CATEGORY_LABELS.items()}
    # A tag typed as the raw stored value ("garage_sale") counts too.
    by_label.update({value.casefold(): value for value in CATEGORY_LABELS})

    changed = []
    for post in Post.objects.all().only("id", "tags", "categories"):
        values = []
        for tag in post.tags or []:
            value = by_label.get(tag.casefold())
            if value and value not in values:
                values.append(value)
        # Declaration order, as `Post.clean_categories` guaranteed.
        order = list(CATEGORY_LABELS)
        post.categories = sorted(values, key=order.index) or ["posts"]
        changed.append(post)
    if changed:
        Post.objects.bulk_update(changed, ["categories"], batch_size=500)


class Migration(migrations.Migration):

    dependencies = [
        ('myapp', '0008_book'),
    ]

    operations = [
        # The index names the column, so it has to go before the field does.
        migrations.RemoveIndex(
            model_name='post',
            name='myapp_post_categor_b314ed_gin',
        ),
        # Tags are what the site filters by now, so tags are what needs the GIN
        # index -- a btree cannot answer a containment test.
        migrations.AddIndex(
            model_name='post',
            index=django.contrib.postgres.indexes.GinIndex(fields=['tags'], name='myapp_post_tags_aa0585_gin'),
        ),
        # Before the drop, obviously: this is the step that reads the column.
        # On the way back it runs *after* RemoveField has re-added it, which is
        # exactly the order needed -- operations reverse in reverse.
        migrations.RunPython(to_tags, to_categories),
        migrations.RemoveField(
            model_name='post',
            name='categories',
        ),
    ]
