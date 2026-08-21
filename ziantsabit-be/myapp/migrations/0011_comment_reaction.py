"""The two tables behind the blog's comment thread and its reaction bar.

Both hang off `Post` with `on_delete=CASCADE`, so deleting a post takes its
comments and reactions with it -- the same trade `PostViewDay` makes, and for
the same reason: a thread with no post to be under is not a thing anyone can
read, and leaving orphans behind so a count somewhere stays flattering would be
worse than the history moving.

Purely additive. Reversing this drops both tables and everything visitors left
in them, which is the one thing here that cannot be undone -- there is no
column elsewhere that a comment could be reconstructed from.
"""


import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('myapp', '0010_drop_posts_tag'),
    ]

    operations = [
        migrations.CreateModel(
            name='Comment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('author_name', models.CharField(max_length=80)),
                ('body', models.TextField(max_length=2000)),
                ('status', models.CharField(choices=[('published', 'Published'), ('hidden', 'Hidden')], default='published', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('post', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='myapp.post')),
            ],
            options={
                'ordering': ['created_at', 'id'],
                'indexes': [models.Index(fields=['post', 'status', 'created_at'], name='myapp_comme_post_id_6797eb_idx')],
            },
        ),
        migrations.CreateModel(
            name='Reaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('emoji', models.CharField(max_length=32)),
                ('visitor', models.CharField(max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('post', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reactions', to='myapp.post')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
                'indexes': [models.Index(fields=['post', 'emoji'], name='myapp_react_post_id_a79821_idx')],
                'constraints': [models.UniqueConstraint(fields=('post', 'emoji', 'visitor'), name='unique_post_emoji_visitor')],
            },
        ),
    ]
