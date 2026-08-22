"""The shape of the CV and About page documents, and how one is normalised.

`PageContent.data` is a JSON document rather than a set of columns (see the
model's docstring). This module is what keeps that from meaning "anything at
all": every write goes through `normalise_page_data`, so what is stored is
always the canonical shape for its key, and the SPA can render it without
defending against a key that might not be there.

**It fills defaults rather than rejecting a partial document.** A CV with no
`projects` yet is a CV, not a bad request -- and the alternative, a 400 for
every key the client left out, would mean the editor had to send every field
of both pages on every autosave whether or not it had them. What *is* rejected
is a value of the wrong kind: a string where a list of entries belongs is a
mistake nobody meant, and quietly coercing it would put a rendering error on a
public page rather than a message in front of the person who caused it.

**Unknown keys are dropped, not kept.** They are almost always a typo or a
field from an older shape, and preserving them would mean the stored document
slowly filled with things nothing reads.

Everything Markdown-ish here -- the CV summary, an entry's blurb and bullets,
an About section's body -- is stored as Markdown *source* and rendered by the
SPA's existing `Markdown` component. That is what lets a bullet carry an inline
link, which is exactly what the hardcoded CV used a JSX `<ExternalLink>` for
before this existed.
"""

from rest_framework import serializers

from .models import PageContent


def _reject(field, expected):
    raise serializers.ValidationError({field: [f"Expected {expected}."]})


def _text(value, field):
    """One string field. `None` reads as absent, which is how a form clears one."""
    if value is None:
        return ""
    if not isinstance(value, str):
        _reject(field, "a string")
    return value.strip()


def _text_list(value, field):
    if value is None:
        return []
    if not isinstance(value, list):
        _reject(field, "a list of strings")
    # Blanks dropped rather than stored: an empty bullet renders as a lone
    # marker with nothing beside it, and the editor's "add" button makes one
    # every time it is pressed.
    return [item for item in (_text(item, field) for item in value) if item]


def _records(value, field, normalise):
    if value is None:
        return []
    if not isinstance(value, list):
        _reject(field, "a list of objects")
    out = []
    for item in value:
        if not isinstance(item, dict):
            _reject(field, "a list of objects")
        record = normalise(item, field)
        if record is not None:
            out.append(record)
    return out


def _object(value, field):
    if value is None:
        return {}
    if not isinstance(value, dict):
        _reject(field, "an object")
    return value


# --- CV -------------------------------------------------------------------


def _entry(item, field):
    """One timeline row: a job, a project or a qualification.

    All three render through the SPA's `TimelineItem`, so they share a shape
    rather than having three near-identical ones -- which is also why the CV
    editor can reuse one entry form for all three sections.

    An entry with no title at all is dropped: it is what an "add" button leaves
    behind when the author changes their mind, and a timeline dot with no text
    beside it is not something anyone meant to publish.
    """
    entry = {
        "title": _text(item.get("title"), field),
        "subtitle": _text(item.get("subtitle"), field),
        "subtitle_link": _text(item.get("subtitle_link"), field),
        "location": _text(item.get("location"), field),
        "duration": _text(item.get("duration"), field),
        "blurb": _text(item.get("blurb"), field),
        "points": _text_list(item.get("points"), field),
    }
    return entry if entry["title"] else None


def _skill_group(item, field):
    group = {
        "label": _text(item.get("label"), field),
        "items": _text_list(item.get("items"), field),
    }
    # A group needs a name to head it; an unnamed pile of chips says nothing.
    return group if group["label"] else None


def _link(item, field):
    link = {
        "label": _text(item.get("label"), field),
        "url": _text(item.get("url"), field),
        # The devicon SVGs the CV header has always used. A URL rather than a
        # named icon set, so a link to something with no devicon (an email, a
        # personal site) can carry its own image or none at all.
        "icon_url": _text(item.get("icon_url"), field),
    }
    return link if link["label"] and link["url"] else None


def _section(value, field, heading, **lists):
    """A headed section: its title, plus whichever list it carries.

    The heading is content, not a constant, because the CV's headings carry
    emoji ("💼 Experience") and picking those is exactly the sort of thing the
    owner should not need a deploy for.
    """
    raw = _object(value, field)
    out = {"heading": _text(raw.get("heading"), field) or heading}
    out.update({name: build(raw.get(name), f"{field}.{name}") for name, build in lists.items()})
    return out


def _cv(data):
    return {
        "name": _text(data.get("name"), "name"),
        "location": _text(data.get("location"), "location"),
        "links": _records(data.get("links"), "links", _link),
        "summary": _section(
            data.get("summary"),
            "summary",
            "📄 Summary",
            body=lambda value, field: _text(value, field),
        ),
        "experience": _section(
            data.get("experience"),
            "experience",
            "💼 Experience",
            entries=lambda value, field: _records(value, field, _entry),
        ),
        "projects": _section(
            data.get("projects"),
            "projects",
            "🛠️ Projects",
            entries=lambda value, field: _records(value, field, _entry),
        ),
        "skills": _section(
            data.get("skills"),
            "skills",
            "⚙️ Skills",
            groups=lambda value, field: _records(value, field, _skill_group),
        ),
        "education": _section(
            data.get("education"),
            "education",
            "🎓 Education & Certifications",
            entries=lambda value, field: _records(value, field, _entry),
        ),
    }


# --- About ----------------------------------------------------------------


def _about_section(item, field):
    section = {
        "heading": _text(item.get("heading"), field),
        "body": _text(item.get("body"), field),
    }
    # Either half alone is still worth rendering -- a heading with the prose
    # not written yet, or a paragraph the author has not titled.
    return section if section["heading"] or section["body"] else None


def _about(data):
    return {
        "name": _text(data.get("name"), "name"),
        "headline": _text(data.get("headline"), "headline"),
        "location": _text(data.get("location"), "location"),
        # The two faces of `FlipPhoto`. A back image is optional; with none the
        # portrait simply does not flip.
        "photo_front": _text(data.get("photo_front"), "photo_front"),
        "photo_back": _text(data.get("photo_back"), "photo_back"),
        "photo_alt": _text(data.get("photo_alt"), "photo_alt"),
        # A free list, unlike the CV's fixed sections: About is prose under
        # headings, and a third one ("📚 What I'm reading") is a thing the
        # owner should be able to add without a migration.
        "sections": _records(data.get("sections"), "sections", _about_section),
    }


NORMALISERS = {
    PageContent.Key.CV: _cv,
    PageContent.Key.ABOUT: _about,
}


def normalise_page_data(key, data):
    """The canonical document for `key`, built from whatever was sent."""
    if data is None:
        data = {}
    if not isinstance(data, dict):
        _reject("data", "an object")
    build = NORMALISERS.get(key)
    if build is None:
        # Unreachable through the API -- `key` is a choices field and there is
        # no create route -- but a shell or a future key would land here, and
        # storing an unshaped document is worse than saying so.
        raise serializers.ValidationError({"key": [f"No content shape for '{key}'."]})
    return build(data)


def empty_page_data(key):
    """A fully-shaped but empty document, for a page nobody has filled in yet."""
    return normalise_page_data(key, {})
