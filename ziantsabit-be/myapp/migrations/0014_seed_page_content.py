"""Fill the two page rows with the content the pages shipped with.

`0013` creates an empty table, and the SPA's CV and About pages read from it
from this commit onwards -- so without this migration deploying the change
would replace a finished CV with a blank one. What follows is a transcription
of the arrays and JSX that were hardcoded at the top of `CV.tsx` and
`About.tsx`, which this replaces.

Two things changed shape in the move, both because the destination is data
rather than JSX:

- **Inline links became Markdown.** The Bamtren bullet used an `<ExternalLink>`
  component and the About prose used `<Box component="a">`; both are now
  `[text](url)` and render through the SPA's `Markdown`. That is the whole
  reason the bullets and prose are Markdown and not plain strings.
- **The CV's section headings became content**, emoji included, since picking
  those was never worth a deploy.
- **The one `$` in the text is escaped as `\\$`.** `Markdown` reads `$` as the
  start of an inline equation, so `~$2,000` and any later `$` on the same line
  would be swallowed into one. CLAUDE.md notes that nothing published contained
  a `$` when maths shipped, which is what made single-dollar syntax safe; this
  CV does, and escaping it is what the site's own convention says to do. It
  renders as a plain `$`.

`update_or_create` rather than `create`: a database where somebody has already
saved a page through the admin should keep what they wrote, but one that ran
`0013` and got an empty row from `PageContentViewSet.get_object` should be
filled in. So an untouched or empty row is seeded and a written one is left
alone -- see `seed` below.
"""

from django.db import migrations

CV = {
    "name": "Ghazian Tsabit Alkamil",
    "location": "Jakarta, Indonesia",
    "links": [
        {
            "label": "LinkedIn",
            "url": "https://www.linkedin.com/in/ghaziantsabitalkamil/",
            "icon_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linkedin/linkedin-original.svg",
        },
        {
            "label": "GitHub",
            "url": "https://github.com/ZianTsabit",
            "icon_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg",
        },
        # No icon: the mail link has always been the emoji in its own label,
        # which is why `icon_url` is optional rather than required.
        {"label": "✉️ Email", "url": "mailto:tsabitghazian@gmail.com", "icon_url": ""},
    ],
    "summary": {
        "heading": "📄 Summary",
        "body": (
            "Data Engineer with experience architecting high-throughput data platforms "
            "across GCP, Azure, and on-premise environments. Proven track record of "
            "leading event tracking services handling ~2,500 RPS and ~500 GB of daily "
            "data, achieving significant cloud cost reductions of ~30% for BigQuery and "
            "~35% for Dataflow and Pub/Sub. Expertise spans the full data lifecycle, "
            "including implementing Medallion Architecture, orchestrating 800+ DBT "
            "models with Apache Airflow, and deploying AI-driven RAG pipelines using "
            "Gemma 3. Proficient in building scalable infrastructure and implementing "
            "observability infrastructure."
        ),
    },
    "experience": {
        "heading": "💼 Experience",
        "entries": [
            {
                "title": "Software Engineer - Data",
                "subtitle": "Cermati Fintech Group",
                "subtitle_link": "https://www.cermati.group/",
                "location": "Jakarta, Indonesia",
                "duration": "June 2025 - Present",
                "blurb": (
                    "Cermati Fintech Group (CFG) is a fintech company founded in 2015, "
                    "consisting of five entities. I am part of the Data Platform Team, "
                    "supporting all entities under CFG (officially under the Indodana "
                    "entity)."
                ),
                "points": [
                    "Owned a high-scale event tracking service adopted by the engineering team across the group company, managing ~2,500 RPS and ~500 GB of daily throughput. Redesigned data pipelines to slash Pub/Sub and Dataflow costs by ~35% (yielding ~\\$2,000 USD in monthly savings) and implemented a strict data retention strategy of the event's BigQuery table that successfully optimized the BigQuery costs by ~30% for several events.",
                    "Implemented Snowflake ID generation inside that same event tracking service to eliminate event ID collisions, improving data integrity at scale.",
                    "Maintained and enhanced a large-scale DBT project consisting of 800+ models, streamlined through the orchestration of 186+ Apache Airflow DAGs to assist the Business Intelligence team building and architecting the group company data warehouse and data mart.",
                    "Maintained and managed group company-wide Apache Airflow infrastructure and successfully solved a critical memory leak in the Airflow Triggerer component thus removing the whole on-call routine related to that case.",
                ],
            },
            {
                "title": "Data Engineer (Infrastructure)",
                "subtitle": "Intiva",
                "subtitle_link": "https://intiva.id/",
                "location": "Jakarta, Indonesia",
                "duration": "Sept 2024 - June 2025",
                "blurb": (
                    "Intiva is an IT consulting and services company specializing in "
                    "software development, automation, machine learning, and big data "
                    "analytics."
                ),
                "points": [
                    # Was an <ExternalLink> in JSX; Markdown is what carries it now.
                    "Engineered the [Bamtren](https://bamtren.com/) MVP, a news analytics platform using Gemma 3 for RAG-driven content generation and sentiment analysis, processing hundreds of thousands of daily messages via a robust pipeline of Airflow, MongoDB, RabbitMQ, and Celery.",
                    "Built internal LLM infrastructure and FastAPI services utilized by 5+ engineers and data scientists, integrating Ollama and LangChain while implementing a full-stack monitoring suite (Grafana, Prometheus, Loki) to track on-premise performance.",
                    "Standardized DevOps and security protocols by establishing monorepo CI/CD pipelines and implementing HashiCorp Vault secret management, successfully adopted across two production projects to enhance deployment security and efficiency.",
                ],
            },
            {
                "title": "Data Governance (Intern)",
                "subtitle": "Sinar Mas Land",
                "subtitle_link": "https://www.sinarmasland.com/",
                "location": "Tangerang, Indonesia",
                "duration": "April - July 2024",
                "blurb": (
                    "Sinar Mas Land is one of Indonesia's largest real estate "
                    "developers, part of the Sinarmas Group conglomerate."
                ),
                "points": [
                    "Designed and managed metadata-driven ingestion pipelines to the Bronze layer in Medallion Architecture using Microsoft Azure Data Fabric, streamlining the integration of diverse data sources into a centralized environment.",
                ],
            },
        ],
    },
    "projects": {
        "heading": "🛠️ Projects",
        "entries": [
            {
                "title": "HomeLab Infrastructure Project",
                "subtitle": "",
                "subtitle_link": "",
                "location": "",
                "duration": "Oct 2025 - Present",
                "blurb": "",
                "points": [
                    "Constructed self-hosted Kubernetes cluster on Proxmox virtualization, configured a multi-node architecture (1 control plane, 2 worker nodes) to master service orchestration and infrastructure management, also implemented observability across multi-node and across the homelab using Grafana and Prometheus, providing real-time monitoring and health metrics for the entire cluster lifecycle.",
                    "Hosts this website: the site you are reading runs on that homelab rather than on a managed platform, with its frontend, Django API, PostgreSQL and object storage deployed as Docker Compose stacks on a Proxmox VM and reached only through a Cloudflare Zero Trust tunnel — no port forwarding, no reverse proxy, no certificate to renew.",
                ],
            },
        ],
    },
    "skills": {
        "heading": "⚙️ Skills",
        "groups": [
            {"label": "Programing Language", "items": ["Python", "Java", "JavaScript"]},
            {
                "label": "Data Engineering & Orchestration",
                "items": ["Apache Airflow", "DBT", "Apache Beam"],
            },
            {
                "label": "Database & Data Platforms",
                "items": [
                    "PostgreSQL",
                    "Google BigQuery",
                    "MongoDB",
                    "Redis",
                    "Elasticsearch",
                    "Redash",
                ],
            },
            {
                "label": "Cloud & Infrastructure",
                "items": [
                    "Google Cloud Platform",
                    "Microsoft Azure",
                    "Docker",
                    "Kubernetes",
                ],
            },
            {"label": "Messaging & Streaming", "items": ["RabbitMQ", "Google Pub/Sub"]},
            {
                "label": "Monitoring, Logging, & Observability",
                "items": ["Grafana", "Prometheus", "Loki", "Promtail"],
            },
            {
                "label": "Security & DevOps",
                "items": [
                    "Keycloak",
                    "HashiCorp Vault",
                    "GitLab CI",
                    "GitLab Runner",
                ],
            },
            {
                "label": "Machine Learning & LLM",
                "items": ["LangChain", "Ollama", "Langfuse"],
            },
        ],
    },
    "education": {
        "heading": "🎓 Education & Certifications",
        "entries": [
            {
                "title": "B.Sc. Computer Science",
                "subtitle": "Bandung Institute of Technology",
                "subtitle_link": "https://stei.itb.ac.id/",
                "location": "",
                "duration": "",
                "blurb": "",
                "points": [
                    "CGPA: 3.54 / 4.00",
                    "Thesis: Development of a Transformation Mechanism from Document-Oriented NoSQL Database to Relational Database.",
                ],
            },
            {
                "title": "Associate Cloud Engineer",
                "subtitle": "Google Cloud Platform",
                "subtitle_link": "",
                "location": "",
                "duration": "2024 - 2027",
                "blurb": "",
                "points": [],
            },
        ],
    },
}

ABOUT = {
    "name": "Ghazian Tsabit Alkamil",
    "headline": "Software Engineer — Data Platform",
    "location": "Jakarta, Indonesia",
    "photo_front": "/pp-github.png",
    "photo_back": "/professional-photo.jpeg",
    "photo_alt": "Ghazian Tsabit Alkamil",
    "sections": [
        {
            "heading": "👋 About Me",
            "body": (
                "Hi, I’m Ghazian Tsabit Alkamil, living in Jakarta, Indonesia. I work "
                "as a Software Engineer on the Data Platform team at "
                "[Cermati Fintech Group](https://www.cermati.group/). I studied "
                "Computer Science at the [School of Electrical Engineering and "
                "Informatics](https://stei.itb.ac.id/), Bandung Institute of "
                "Technology. I have a strong passion for data, software, and "
                "infrastructure engineering, and I enjoy exploring how these areas "
                "connect and support each other. This site is where I put myself on "
                "the internet: I share my projects here, and write about the things "
                "that I find interesting."
            ),
        },
        {
            "heading": "🎧 Outside of Work",
            "body": (
                "I love spending time with books—especially Indonesian novels, with "
                "Eka Kurniawan as my favorite author—watching movies, and swimming, "
                "which I usually do about four times a week. Music is also a big part "
                "of my life, and I’m a huge fan of The Beatles and Bob Dylan. I enjoy "
                "learning new things, and recently I’ve started learning to play the "
                "guitar, inspired by the anime *Bocchi the Rock!*"
            ),
        },
    ],
}

SEED = {"cv": CV, "about": ABOUT}


def seed(apps, schema_editor):
    PageContent = apps.get_model("myapp", "PageContent")
    for key, data in SEED.items():
        page, created = PageContent.objects.get_or_create(key=key, defaults={"data": data})
        # A row that already exists but is empty came from
        # `PageContentViewSet.get_object` creating one on a first read, not
        # from anybody editing -- so it is still safe to fill. A row with
        # content in it is somebody's work and is left exactly as it is.
        if not created and not _has_content(page.data):
            page.data = data
            page.save(update_fields=["data"])


def _has_content(data):
    """Whether a stored document has anything in it worth not overwriting.

    An empty document is not `{}` -- the normaliser fills every key -- so this
    asks whether any value is non-empty rather than whether any key is present.
    """
    if not isinstance(data, dict):
        return bool(data)
    return any(_has_content(value) for value in data.values())


def unseed(apps, schema_editor):
    """Drop both rows.

    Reversible outright, unlike `0009`/`0010`: nothing here was derived from
    other data, so removing the rows puts the database back exactly as `0013`
    left it. The pages then read from the hardcoded arrays again only if the
    frontend is rolled back too -- a database reversed without that shows two
    empty pages, which is the honest result of reversing a content migration.
    """
    PageContent = apps.get_model("myapp", "PageContent")
    PageContent.objects.filter(key__in=SEED).delete()


class Migration(migrations.Migration):
    dependencies = [("myapp", "0013_pagecontent")]

    operations = [migrations.RunPython(seed, unseed)]
