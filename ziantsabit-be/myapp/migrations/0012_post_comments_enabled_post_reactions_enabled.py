"""Per-post switches for the two things visitors can leave.

Both default True, so every post already in the table keeps behaving exactly as
it did -- this adds a way to say no, it does not change the answer anywhere.

Reversible without loss of anything but the switches themselves: dropping the
columns turns comments and reactions back on for every post, which is the
default they were added with. Nothing else records that a thread was closed, so
a post whose thread was shut would silently reopen -- worth knowing before
migrating backwards on a live database.
"""


from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('myapp', '0011_comment_reaction'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='comments_enabled',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='post',
            name='reactions_enabled',
            field=models.BooleanField(default=True),
        ),
    ]
