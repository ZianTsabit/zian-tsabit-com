/**
 * Client for the Django posts API.
 *
 * One endpoint, /api/posts/, browsed by tag. The fixed four-category enum this
 * used to mirror was dropped in the backend's `0009`: tags did the same job
 * without needing a migration to grow, and every consumer had to understand
 * both mechanisms.
 */

/** One post, mirroring `myapp.serializers.PostSerializer`. */
export interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  /** Lead image, shown on the card and above the body. Empty string, never
   *  null, when the post has none -- it is a blank CharField on the model. */
  cover_image_url: string;
  /** Alt text for the cover. Blank falls back to the title at render time. */
  cover_image_alt: string;
  /** Free-form labels in the order they were typed. The API trims them, drops
   *  blanks and drops case-insensitive repeats, so this is already tidy.
   *  Possibly empty: an untagged post is a perfectly good post. */
  tags: string[];
  status: "draft" | "published";
  /** Null only on drafts, which an unauthenticated caller never receives. */
  published_at: string | null;
  /** Reads recorded so far. Server-owned: a write to the post never sets it,
   *  only `recordPostView` does. */
  view_count: number;
  created_at: string;
  updated_at: string;
}

/** DRF's PageNumberPagination envelope. */
export interface PostPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Post[];
}

/** One row of `GET /api/posts/tags/`: a label and how many posts carry it. */
export interface TagCount {
  name: string;
  count: number;
}

// Matches REST_FRAMEWORK.PAGE_SIZE in settings.py.
export const PAGE_SIZE = 20;

// Trailing slashes are stripped so a value of "http://host/api/" cannot produce
// a double slash, which Django's APPEND_SLASH handling answers with a redirect.
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api"
).replace(/\/+$/, "");

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** A slug with no matching published post -- distinct from a network/server error. */
export class PostNotFoundError extends Error {
  constructor(slug: string) {
    super(`No post found with slug "${slug}".`);
    this.name = "PostNotFoundError";
  }
}

/**
 * Shared by every call below: turns a dead backend/CORS failure into one
 * message.
 *
 * Exported because `books.ts` is the same kind of client against the same API
 * -- a credential-free GET whose only two failure modes are "the server said
 * no" and "the server said nothing" -- and a second copy of this would be a
 * second place for that message to be worded differently.
 */
export async function publicRequest(
  url: string,
  signal?: AbortSignal,
  init: RequestInit = {},
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    // A cancelled request is not a failure, so it has to stay distinguishable
    // from the backend being unreachable -- which is the other reason fetch
    // rejects, and which it reports only as "Failed to fetch".
    if (isAbort(error)) throw error;
    throw new Error(
      `Could not reach the API at ${API_BASE_URL}. Is the backend running?`,
    );
  }
}

/** A YYYY-MM-DD day, or "" for "no bound". Both ends are inclusive, and a post
 *  is dated by its `published_at` -- or `created_at` when it has none. */
export interface DateRange {
  after?: string;
  before?: string;
}

/** Fetch one numbered page of posts, optionally filtered by tag and by date --
 *  for the Blog page's filters + numbered pagination. `page` omitted or 1 asks
 *  for the first page: DRF's PageNumberPagination treats a `page` param of "1"
 *  the same as no param, so leaving it out for that case avoids a meaningless
 *  `?page=1` in the URL. */
export async function fetchPostsPage(
  {
    tag,
    page,
    after,
    before,
  }: { tag?: string; page?: number } & DateRange,
  signal?: AbortSignal,
): Promise<PostPage> {
  const params = new URLSearchParams();
  // The entries show their last-edited date, so that is what they are sorted
  // by. Note the date *filter* below is
  // still on published_at (or created_at for a draft) -- "edited recently" and
  // "published in this range" are different questions, and the filter answers
  // the one its labels ask.
  params.set("ordering", "updated");
  // An empty value would be sent as `?tag=` and match nothing, so "no
  // filter" has to mean "no parameter".
  if (tag) params.set("tag", tag);
  if (page && page > 1) params.set("page", String(page));
  // An empty string would be sent as `?published_after=` and, unlike a bad
  // date, is simply ignored by the API -- but there is no reason to send it.
  if (after) params.set("published_after", after);
  if (before) params.set("published_before", before);
  const query = params.toString();
  return fetchPostPage(`${API_BASE_URL}/posts/${query ? `?${query}` : ""}`, signal);
}

/**
 * Fetch an arbitrary page URL. Pass the `next` link from a previous page to
 * paginate; DRF returns it absolute, so it needs no rebuilding.
 */
export async function fetchPostPage(
  url: string,
  signal?: AbortSignal,
): Promise<PostPage> {
  const response = await publicRequest(url, signal);

  if (!response.ok) {
    throw new Error(
      `The API returned ${response.status} ${response.statusText}.`,
    );
  }

  return (await response.json()) as PostPage;
}

/** Fetch one post by slug, for a detail page. Anonymous callers 404 on a draft
 *  slug exactly as they do on a nonexistent one -- the route never confirms a
 *  draft exists. */
export async function fetchPost(slug: string, signal?: AbortSignal): Promise<Post> {
  const url = `${API_BASE_URL}/posts/${encodeURIComponent(slug)}/`;
  const response = await publicRequest(url, signal);

  if (response.status === 404) throw new PostNotFoundError(slug);
  if (!response.ok) {
    throw new Error(
      `The API returned ${response.status} ${response.statusText}.`,
    );
  }

  return (await response.json()) as Post;
}

/**
 * Record one read of a post and return its new total.
 *
 * Deliberately credential-free like every other call in this file: the endpoint
 * is open to anonymous callers, and DRF only enforces CSRF on a request it
 * authenticated by session -- so sending no cookie is what keeps this a plain
 * POST with no token to fetch first.
 */
export async function recordPostView(
  slug: string,
  signal?: AbortSignal,
): Promise<number> {
  const url = `${API_BASE_URL}/posts/${encodeURIComponent(slug)}/view/`;
  const response = await publicRequest(url, signal, { method: "POST" });

  if (response.status === 404) throw new PostNotFoundError(slug);
  if (!response.ok) {
    throw new Error(
      `The API returned ${response.status} ${response.statusText}.`,
    );
  }

  const body = (await response.json()) as { view_count: number };
  return body.view_count;
}

export { isAbort };

/**
 * Every tag in use, commonest first.
 *
 * Fetched rather than derived from the posts on screen: tags are free text, so
 * there is no enum to read them off, and building the list from one page of
 * results would offer only the tags that happened to land on page one. This is
 * what the fixed `CATEGORY_ORDER` used to give the client for nothing.
 */
export async function fetchTags(signal?: AbortSignal): Promise<TagCount[]> {
  const response = await publicRequest(`${API_BASE_URL}/posts/tags/`, signal);
  if (!response.ok) {
    throw new Error(`The API returned ${response.status} ${response.statusText}.`);
  }
  return (await response.json()) as TagCount[];
}
