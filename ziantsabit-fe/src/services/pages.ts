/**
 * The CV and About pages' content, from `/api/pages/`.
 *
 * These two pages are the site's only ones whose copy is the owner's own
 * rather than a feed of things they published, and until this module they were
 * arrays and JSX at the top of `CV.tsx` and `About.tsx` -- so keeping a CV
 * current meant editing a component and redeploying. The admin editors at
 * `/admin/cv` and `/admin/about` are what this exists for.
 *
 * **The types here mirror `myapp/pages.py` and nothing else guarantees that.**
 * The API normalises every write into the canonical shape, so a reader never
 * has to defend against a missing key -- which is exactly why these are plain
 * required fields rather than a pile of optionals. Change one side and change
 * the other.
 *
 * Everything Markdown-ish -- the CV summary, an entry's blurb and bullets, an
 * About section's body -- is Markdown *source*, rendered through the site's
 * existing `Markdown` component. That is what carries an inline link inside a
 * CV bullet, which the hardcoded version needed a JSX component for.
 */

import { API_BASE_URL, publicRequest } from "./posts";

/** One timeline row: a job, a project or a qualification. All three render
 *  through `TimelineItem`, so they share a shape rather than having three. */
export interface PageEntry {
  title: string;
  subtitle: string;
  subtitle_link: string;
  location: string;
  duration: string;
  /** Markdown. */
  blurb: string;
  /** Markdown, one per bullet. */
  points: string[];
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface PageLink {
  label: string;
  url: string;
  /** Optional: the mail link has always been an emoji in its own label. */
  icon_url: string;
}

interface Headed {
  heading: string;
}

export interface CvContent {
  name: string;
  location: string;
  links: PageLink[];
  summary: Headed & { body: string };
  experience: Headed & { entries: PageEntry[] };
  projects: Headed & { entries: PageEntry[] };
  skills: Headed & { groups: SkillGroup[] };
  education: Headed & { entries: PageEntry[] };
}

export interface AboutSection {
  heading: string;
  /** Markdown. */
  body: string;
}

export interface AboutContent {
  name: string;
  headline: string;
  location: string;
  photo_front: string;
  photo_back: string;
  photo_alt: string;
  sections: AboutSection[];
}

/** Maps a page key to the document shape it carries. */
export interface PageData {
  cv: CvContent;
  about: AboutContent;
}

export type PageKey = keyof PageData;

export interface PageContent<K extends PageKey> {
  key: K;
  data: PageData[K];
  updated_at: string;
}

/** A blank but fully-shaped document, mirroring `pages.py`'s own defaults.
 *
 * Used as the form's value while a page is still loading, so the editor's
 * fields are never briefly uncontrolled -- and as the fallback if the API ever
 * hands back something older than the current shape. The headings match the
 * server's defaults so a page nobody has filled in still reads as a CV. */
export function emptyCv(): CvContent {
  return {
    name: "",
    location: "",
    links: [],
    summary: { heading: "📄 Summary", body: "" },
    experience: { heading: "💼 Experience", entries: [] },
    projects: { heading: "🛠️ Projects", entries: [] },
    skills: { heading: "⚙️ Skills", groups: [] },
    education: { heading: "🎓 Education & Certifications", entries: [] },
  };
}

export function emptyAbout(): AboutContent {
  return {
    name: "",
    headline: "",
    location: "",
    photo_front: "",
    photo_back: "",
    photo_alt: "",
    sections: [],
  };
}

export function emptyEntry(): PageEntry {
  return {
    title: "",
    subtitle: "",
    subtitle_link: "",
    location: "",
    duration: "",
    blurb: "",
    points: [],
  };
}

/**
 * One page's content.
 *
 * Through `publicRequest` rather than `apiRequest`: these back two public
 * pages, so the read must work for a visitor with no session -- and sending
 * the owner's cookie on a public page is what `api.ts` exists to avoid.
 */
export async function fetchPage<K extends PageKey>(
  key: K,
  signal?: AbortSignal,
): Promise<PageContent<K>> {
  const response = await publicRequest(`${API_BASE_URL}/pages/${key}/`, signal);
  if (!response.ok) {
    throw new Error(`Could not load the ${key} page (${response.status}).`);
  }
  return (await response.json()) as PageContent<K>;
}
