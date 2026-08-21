from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

# The earliest year worth accepting as a publication date. Gutenberg's press is
# the floor rather than 0: a catalogue of printed books has no use for a year in
# three digits, and a bare typo ("19" for "1985") is far likelier than a
# genuinely medieval entry.
EARLIEST_RELEASE_YEAR = 1450


def max_release_year():
    """The latest year a book may claim, one ahead of the server's own.

    A callable rather than a constant because a hardcoded ceiling starts
    rejecting valid entries the moment the year turns. One ahead of now, since
    a book bought in December can carry the next year on its title page.

    Referenced by name from a migration, so it has to stay a module-level
    function -- inlining it as a lambda would make the field unserialisable.
    """
    return timezone.localdate().year + 1


def clean_labels(labels):
    """Trim, drop blanks, and drop repeats without regard to case.

    Shared by a post's tags and a book's genres, which are the same idea twice:
    a short list of free-form labels the author typed, where "Sci-Fi", " sci-fi "
    and "SCI-FI" have to be one label rather than three. The first spelling seen
    is the one kept, since that is the one the author chose to display.

    Called from `save()` on both models rather than from a serializer, so the
    Django admin and the shell get the same tidying the API path does.
    """
    seen = set()
    cleaned = []
    for label in labels or []:
        # split()/join() also collapses runs of spaces inside a label.
        text = " ".join(str(label).split())
        key = text.casefold()
        if not text or key in seen:
            continue
        seen.add(key)
        cleaned.append(text)
    return cleaned


def unique_slug(model, instance, base):
    """Return `base`, suffixed with -2, -3, ... if that slug is already taken.

    Takes the model explicitly because both content models generate slugs and
    each has to dedupe against its own table only: a book and a post may share
    a title without either having to live at a stuttered URL.
    """
    max_length = model._meta.get_field("slug").max_length
    slug = base[:max_length]
    siblings = model.objects.exclude(pk=instance.pk) if instance.pk else model.objects
    suffix = 2
    while siblings.filter(slug=slug).exists():
        tail = f"-{suffix}"
        slug = f"{base[:max_length - len(tail)]}{tail}"
        suffix += 1
    return slug


def normalise_isbn(value):
    """An ISBN as it is stored: no separators, an upper-case check digit.

    ISBNs are written with hyphens in some places and spaces in others, and the
    grouping is not fixed, so two people copying the same number off the same
    book produce different strings. Stripping the separators makes the stored
    value the number itself, which is what a search for one has to match.
    """
    return "".join(str(value or "").split()).replace("-", "").replace("\u2013", "").upper()


def isbn_is_valid(compact):
    """Whether a separator-free ISBN passes its own check digit.

    Length alone would accept a transposed pair of digits, which is the typo
    that makes an ISBN useless for a lookup while still looking right. Both
    schemes are checked because both are in print: ISBN-10 on anything before
    2007, ISBN-13 on everything since.
    """
    if len(compact) == 10:
        if not (compact[:9].isdigit() and (compact[9].isdigit() or compact[9] == "X")):
            return False
        total = sum((10 - index) * int(digit) for index, digit in enumerate(compact[:9]))
        total += 10 if compact[9] == "X" else int(compact[9])
        return total % 11 == 0
    if len(compact) == 13:
        if not compact.isdigit():
            return False
        total = sum(
            int(digit) * (1 if index % 2 == 0 else 3)
            for index, digit in enumerate(compact)
        )
        return total % 10 == 0
    return False


class Post(models.Model):
    """A single piece of writing, labelled with free-form tags.

    Replaces the earlier Book / Project / GarageSale / Update models: those were
    four near-identical title-plus-fields tables for what is one feed.

    **There is no `categories` column any more** -- `0009` dropped it and copied
    every post's sections into `tags`. The fixed enum was doing the same job as
    the free-form list beside it, badly: adding a section meant a migration, a
    post could only ever be filed under one of four things, and every consumer
    had to know both mechanisms. One list of labels, filtered case-insensitively
    by `?tag=`, does everything the enum did and does not need a code change to
    grow.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    title = models.CharField(max_length=200)
    # Left blank on create and derived from the title in save(); it is the URL
    # key the API looks posts up by, so it has to stay unique.
    slug = models.SlugField(max_length=220, unique=True, blank=True)
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
    # What visitors may leave on this post, decided per post rather than
    # site-wide: a piece on something contentious can have its thread closed
    # without turning comments off everywhere, and a short note nobody is meant
    # to argue with can go up with neither.
    #
    # **Both default to True**, so nothing already published changes behaviour
    # when this ships and a new post behaves like every existing one.
    #
    # **Turning either off is about what can be *added*, not about what is
    # already there.** Closing a thread leaves its comments visible -- a switch
    # that also hid them would be a bulk-hide with no way to see what it hid,
    # and `Comment.status` is the control for that. Turning reactions off does
    # hide the bar, since a row of counts nobody may change is furniture, but
    # the rows stay in the table: a reaction someone left is a thing that
    # happened, and flipping the switch back brings the counts with it.
    comments_enabled = models.BooleanField(default=True)
    reactions_enabled = models.BooleanField(default=True)
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
            # GIN, because browsing is now a containment test over `tags`
            # (tags @> ['Django']) and a btree cannot answer that. It moved
            # here from `categories` when that column was dropped in `0009`:
            # tags are what the site filters by now, so tags are what needs the
            # index. `status` keeps its own, having no array equivalent.
            GinIndex(fields=["tags"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return self.title

    @staticmethod
    def clean_tags(tags):
        """Trim, drop blanks, and drop repeats without regard to case.

        Delegates to `clean_labels`, which a book's genres share: they are the
        same idea, and one of the two silently growing a different notion of
        what counts as a duplicate is exactly the drift worth preventing.
        """
        return clean_labels(tags)

    def save(self, *args, **kwargs):
        self.tags = self.clean_tags(self.tags)
        if not self.slug:
            self.slug = self._unique_slug(slugify(self.title) or "post")
        # Publishing without an explicit date stamps it now, so an ordered feed
        # never has a published post sitting at the bottom with a null date.
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    def _unique_slug(self, base):
        """Return `base`, suffixed with -2, -3, ... if it is already taken."""
        return unique_slug(Post, self, base)


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


class Book(models.Model):
    """One book in the owner's catalogue.

    Deliberately its own table rather than another `Post.Category`. A post is a
    piece of writing with a title, a body and a publication date; a book is a
    *thing that exists in the world* -- it has an author who is not the site's
    owner, a year it was released, an ISBN that identifies it globally, and a
    review that is the owner's writing *about* it rather than the entry itself.
    Filing those on `Post` would mean five columns that every non-book post
    leaves null, and a `/books` page that could not sort by author or year
    because neither is a thing a post has.

    The `books` category on `Post` still exists and still means something
    different: an essay that happens to be about reading. This is the shelf.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    title = models.CharField(max_length=200)
    # Derived from title (and author, when the title alone is taken) in save().
    # Writable, so an entry's URL can be pinned by hand.
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    # One free-text field rather than an Author table and a join. A catalogue
    # this size never needs to hang anything off an author -- no biography, no
    # count that a filter cannot produce -- and "Le Guin, Ursula K." vs "Ursula
    # K. Le Guin" would immediately become two rows in a table that promised to
    # prevent exactly that. Several authors go in as one string, as they read
    # on the cover.
    author = models.CharField(max_length=200)
    # Free-form labels, not an enum: genre is argued about rather than agreed
    # on, and a fixed list would be wrong for the first book that needed a term
    # nobody thought of. An ArrayField for the same reasons as `Post.tags` --
    # nothing reads a genre without its book, and Postgres is the only database
    # this project supports.
    genres = ArrayField(models.CharField(max_length=50), default=list, blank=True)
    # Stored without separators (see `normalise_isbn`), so a search for the
    # number matches however it was written on the copy in hand.
    #
    # Deliberately *not* unique: two editions of one book are two catalogue
    # entries with two ISBNs, but a re-read noted twice, or a book held in both
    # paperback and hardback, are cases where the same number legitimately
    # appears again -- and a unique constraint over a field that is usually
    # blank is a trap in any case.
    isbn = models.CharField(max_length=17, blank=True)
    # A year, not a date: what a catalogue records is the edition's year, which
    # is what the copyright page gives you. Nullable because plenty of books
    # arrive without one and refusing the entry over it would be absurd.
    release_year = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[
            MinValueValidator(EARLIEST_RELEASE_YEAR),
            # A callable, so the ceiling follows the calendar. See above.
            MaxValueValidator(max_release_year),
        ],
    )
    # The owner's writing about the book. Markdown, rendered by the same
    # `Markdown` component a post body goes through -- there is one renderer on
    # the site and this is not the place to grow a second.
    review = models.TextField(blank=True)
    # The jacket. A URL rather than an ImageField for exactly the reasons
    # `Post.cover_image_url` is one: the bytes are uploaded separately through
    # /api/uploads/images/, so a cover can be attached before the entry exists,
    # and a cover from a bookseller's own site is a URL somebody already has.
    cover_image_url = models.URLField(max_length=500, blank=True)
    cover_image_alt = models.CharField(max_length=200, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Most recently added first: a catalogue is added to over time, and the
        # last thing shelved is the thing the owner is likeliest to be looking
        # for. `-id` breaks the tie, so a page boundary cannot land in the
        # middle of two rows created in the same instant and show one twice.
        ordering = ["-created_at", "-id"]
        indexes = [
            # Containment (`genres @> ['fiction']`), which a btree cannot answer.
            GinIndex(fields=["genres"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.title} by {self.author}"

    @staticmethod
    def clean_genres(genres):
        """Trim, drop blanks and drop case-insensitive repeats."""
        return clean_labels(genres)

    def save(self, *args, **kwargs):
        self.genres = self.clean_genres(self.genres)
        self.isbn = normalise_isbn(self.isbn)
        if not self.slug:
            self.slug = unique_slug(Book, self, self._slug_base())
        super().save(*args, **kwargs)

    def _slug_base(self):
        """The slug to derive, title first and author as the tie-breaker.

        Two different books sharing a title is ordinary -- there are a dozen
        called "Ulysses" -- and `/dune-2` says nothing about which one it is
        while `/dune-frank-herbert` does. The author is only reached for when
        the plain title is already taken, so the common case stays short.
        """
        base = slugify(self.title) or "book"
        taken = Book.objects.exclude(pk=self.pk) if self.pk else Book.objects
        if not taken.filter(slug=base).exists():
            return base
        author = slugify(self.author)
        return f"{base}-{author}" if author else base


# The emoji a visitor may react with, in the order the bar shows them, each
# with the name a screen reader reads out.
#
# **A fixed set, not free text**, which is the whole difference between this and
# `tags`: a reaction is a one-tap gesture, so the vocabulary has to be small
# enough to sit in a row and identical on every post -- otherwise the counts
# fragment across a hundred spellings of "nice" and there is nothing to compare.
# It lives here rather than on the client because the client is not the thing
# that decides what may be stored; the API sends the list back with the counts
# (see `PostViewSet.reactions`), so there is exactly one place either can drift
# from.
#
# Adding one is a code change and no migration: `emoji` is a plain CharField
# validated against this tuple, not a `choices` enum, precisely so that
# extending the set does not mean a schema change for something with no schema.
# Removing one leaves its rows in place, and they simply stop being offered --
# which is the honest outcome, since a reaction someone left is a thing that
# happened.
REACTION_EMOJI = (
    ("\N{THUMBS UP SIGN}", "Like"),
    ("\N{PARTY POPPER}", "Celebrate"),
    ("\N{FIRE}", "Fire"),
    # The variation selector is load-bearing: U+2764 alone is a *text*
    # character and renders as a small monochrome heart in the page font, while
    # every other glyph here is emoji by default. Without it one button in the
    # row looks like a typo.
    ("\N{HEAVY BLACK HEART}\N{VARIATION SELECTOR-16}", "Love"),
    ("\N{FACE WITH TEARS OF JOY}", "Funny"),
    ("\N{ASTONISHED FACE}", "Surprising"),
    ("\N{THINKING FACE}", "Thinking"),
)

# Just the glyphs, for the containment test a write does.
REACTION_EMOJI_VALUES = tuple(emoji for emoji, _label in REACTION_EMOJI)


class Comment(models.Model):
    """One visitor's comment on one post.

    **Comments are published on arrival and moderated afterwards.** A queue
    would mean every comment sits invisible until the owner happens to look,
    which on a personal site is days -- and a commenter who sees nothing appear
    assumes it was lost and writes it again. The trade is that something
    unpleasant is briefly visible; `status` is what takes it down, and it is a
    hide rather than a delete so the row is still there to look at afterwards.

    The rate limit that stops this being a spam target is not here but on the
    endpoint -- see `CommentViewSet` and `DEFAULT_THROTTLE_RATES` in settings.

    **There is deliberately no email field.** A comment box asking for one
    collects personal data the site has no use for: nothing here sends mail, so
    the address would exist only to be leaked. A name and the comment is the
    whole record. (The same instinct that took the CV PDF down over a phone
    number.)
    """

    class Status(models.TextChoices):
        PUBLISHED = "published", "Published"
        HIDDEN = "hidden", "Hidden"

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    # What the commenter typed as their name. Not a user account and not
    # verified in any way -- there are no accounts on this site -- so it is
    # display text, and the API never treats it as identity.
    author_name = models.CharField(max_length=80)
    # Plain text, deliberately **not** Markdown: the body of a post is the
    # owner's and goes through the site's one renderer, but a comment is a
    # stranger's and rendering their markup is how a comment box becomes an
    # injection surface. It is displayed with `whiteSpace: pre-line`, so
    # paragraphs survive and nothing else is interpreted.
    body = models.TextField(max_length=2000)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PUBLISHED
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Oldest first, the opposite of every other list here: a comment thread
        # is read top to bottom, and a reply above the thing it replies to is
        # nonsense. `id` breaks the tie so two comments posted in the same
        # instant cannot swap places between pages.
        ordering = ["created_at", "id"]
        indexes = [
            # The one query the public page makes: this post's visible
            # comments, in order.
            models.Index(fields=["post", "status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.author_name} on {self.post.slug}"


class Reaction(models.Model):
    """One visitor's one-tap reaction to one post.

    A row per (post, emoji, visitor) rather than a counter per emoji, because
    the bar has to answer two questions and a counter only answers one: how
    many people reacted, *and* whether you are one of them -- which is what
    makes the button a toggle rather than a thing you can press forever.

    `visitor` is not a user. There are no accounts here, so it is an opaque
    random token the browser generates once and keeps in `localStorage`; the
    server never learns anything from it beyond "this is the same browser that
    reacted before". That makes the uniqueness a convenience, not a guarantee:
    clearing site data, or opening the post in another browser, buys another
    reaction. Defeating that would need exactly the identification this feature
    is not worth -- and the counter beside it has always had the same property
    (see `useRecordView`).
    """

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="reactions")
    # A plain CharField validated against `REACTION_EMOJI_VALUES` in the view,
    # rather than `choices`: extending the set is then a code change with no
    # migration behind it. Long enough for a multi-codepoint emoji (a ZWJ
    # sequence runs to several characters) even though none of the current set
    # is one -- a max_length that fits only today's list is a trap for the day
    # somebody adds 🤷‍♀️.
    emoji = models.CharField(max_length=32)
    # Opaque, client-generated, and never displayed. Indexed as part of the
    # unique constraint below, which is also the lookup the toggle does.
    visitor = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            # The identity of a row, and what makes the toggle a
            # get-or-delete rather than a read-then-write: two taps racing each
            # other cannot both insert.
            models.UniqueConstraint(
                fields=["post", "emoji", "visitor"], name="unique_post_emoji_visitor"
            ),
        ]
        indexes = [
            # The summary: every reaction on one post, grouped by emoji.
            models.Index(fields=["post", "emoji"]),
        ]

    def __str__(self):
        return f"{self.emoji} on {self.post.slug}"


# Module-level aliases of the two `status` choice sets, for
# SPECTACULAR_SETTINGS' ENUM_NAME_OVERRIDES.
#
# They exist only because that setting resolves its values with Django's
# `import_string`, which walks modules and one attribute -- it cannot reach
# `Post.Status.choices` through the nested class. Three models now carry a
# `status` field and only two of them mean the same thing by it, so without
# these the generator names one of the enums `Status68aEnum`: meaningless in a
# generated client, and unstable, since the suffix is a hash of the choice set.
PUBLICATION_STATUS_CHOICES = Post.Status.choices
COMMENT_STATUS_CHOICES = Comment.Status.choices
