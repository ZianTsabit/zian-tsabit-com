"""Strip the blanket "Posts" tag that `0009` copies onto every post.

`0009` turned each post's sections into tags, and `posts` was the section
almost everything carried -- it was the default, and the one the feed at `/`
was named after. As a tag it says nothing: a label that is on every post is not
a way to tell posts apart, and it sat at the top of the filter dropdown
offering to narrow the feed down to the whole feed.

**A migration rather than a one-off UPDATE**, because the tag mostly does not
exist yet. It only appears where `0009` has run, and a database that has not
been migrated yet -- production, at the time of writing -- would gain it on the
next deploy and then keep it. Running right after `0009` is what makes the pair
correct everywhere: databases already carrying the tag are cleaned, and ones
that are about to gain it never keep it.

The add-then-remove on a fresh database is deliberate rather than squashed into
`0009`. `0009` is a faithful record of what the categories held, and editing an
applied migration to rewrite that history would make the two databases disagree
about what has already run.
"""

from django.db import migrations

# Exactly the label `0009` derives from the `posts` category. Matched without
# regard to case, since a post tagged "posts" by hand before any of this is the
# same blanket label and equally useless as a filter.
BLANKET_TAG = "Posts"


def drop_posts_tag(apps, schema_editor):
    """Remove the blanket tag, leaving every other tag in place and in order."""
    Post = apps.get_model("myapp", "Post")
    changed = []
    for post in Post.objects.all().only("id", "tags"):
        kept = [
            tag
            for tag in (post.tags or [])
            if tag.casefold() != BLANKET_TAG.casefold()
        ]
        if kept != post.tags:
            post.tags = kept
            changed.append(post)
    # One statement rather than one per post -- and the historical model has no
    # save() override to lose by not calling it.
    if changed:
        Post.objects.bulk_update(changed, ["tags"], batch_size=500)


class Migration(migrations.Migration):

    dependencies = [
        ('myapp', '0009_drop_post_categories'),
    ]

    operations = [
        # No reverse: nothing records which posts carried the tag, so putting it
        # back on all of them would be inventing data rather than restoring it.
        # A noop rather than a refusal, so migrating back past this for some
        # unrelated reason is still possible -- and it round-trips acceptably
        # anyway, since `0009`'s own reverse defaults a post with no section
        # label to `["posts"]`, which is exactly what this stripped.
        migrations.RunPython(drop_posts_tag, migrations.RunPython.noop),
    ]
