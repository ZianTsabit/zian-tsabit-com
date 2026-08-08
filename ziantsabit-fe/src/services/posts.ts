/**
 * Client for the Django posts API.
 *
 * There is one endpoint for all four sections -- /api/posts/ filtered by
 * category -- which is why this replaced the per-section service stubs.
 */

export type PostCategory = "posts" | "books" | "projects" | "garage_sale";

/** One post, mirroring `myapp.serializers.PostSerializer`. */
export interface Post {
  id: number;
  title: string;
  slug: string;
  category: PostCategory;
  excerpt: string;
  body: string;
  status: "draft" | "published";
  /** Null only on drafts, which an unauthenticated caller never receives. */
  published_at: string | null;
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

/** Display label for a category, e.g. on the detail page's badge. */
export const CATEGORY_LABELS: Record<PostCategory, string> = {
  posts: "Posts",
  books: "Books",
  projects: "Projects",
  garage_sale: "Garage Sale",
};

/** Route each category's list page lives at. Every other caller already knows
 *  its own category statically; this exists for Home's "Latest Updates" feed
 *  and the Posts page's "all categories" view, which mix posts from more than
 *  one category and so have to look the route up per post.
 *
 *  `garage_sale` has no page of its own -- the category is still valid on the
 *  backend, just with nothing public to browse it on -- so `VISIBLE_CATEGORIES`
 *  filters those posts out of both feeds before this map is ever consulted for
 *  one. The entry below only exists to keep this a total map over
 *  `PostCategory`; it should never actually be reached.
 */
export const CATEGORY_BASE_PATHS: Record<PostCategory, string> = {
  posts: "/posts",
  books: "/books",
  projects: "/projects",
  garage_sale: "/posts",
};

/** Categories with a public page to browse them on -- everything except
 *  `garage_sale`. Cross-category views (Home's "Latest Updates", the Posts
 *  page's "all categories" filter) filter to this list so they never link to
 *  the now-removed Garage Sale page. */
export const VISIBLE_CATEGORIES: PostCategory[] = ["posts", "books", "projects"];

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

/** Shared by every call below: turns a dead backend/CORS failure into one message. */
async function request(url: string, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, { signal, headers: { Accept: "application/json" } });
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

/** Fetch one page of posts. `signal` lets a caller cancel an in-flight request. */
export async function fetchPosts(
  category: PostCategory,
  signal?: AbortSignal,
): Promise<PostPage> {
  const url = `${API_BASE_URL}/posts/?category=${encodeURIComponent(category)}`;
  return fetchPostPage(url, signal);
}

/** Fetch the newest posts across every category, unfiltered -- for Home's
 *  "Latest Updates" feed. The API's default ordering is already newest-first,
 *  so the first page is exactly what a caller wants to take the top few from. */
export async function fetchLatestPosts(signal?: AbortSignal): Promise<PostPage> {
  return fetchPostPage(`${API_BASE_URL}/posts/`, signal);
}

/** Fetch one numbered page of posts, optionally filtered by category -- for
 *  the Posts page's category filter + Prev/Next pagination. `page` omitted or
 *  1 asks for the first page: DRF's PageNumberPagination treats a `page` param
 *  of "1" the same as no param, so leaving it out for that case avoids a
 *  meaningless `?page=1` in the URL. */
export async function fetchPostsPage(
  { category, page }: { category?: PostCategory; page?: number },
  signal?: AbortSignal,
): Promise<PostPage> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (page && page > 1) params.set("page", String(page));
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
  const response = await request(url, signal);

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
  const response = await request(url, signal);

  if (response.status === 404) throw new PostNotFoundError(slug);
  if (!response.ok) {
    throw new Error(
      `The API returned ${response.status} ${response.statusText}.`,
    );
  }

  return (await response.json()) as Post;
}

export { isAbort };
