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
