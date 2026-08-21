/**
 * Client for the comment thread under a post.
 *
 * Public and credential-free, like `posts.ts` and `books.ts` -- and that is
 * what keeps posting a comment a plain POST with no token to fetch first: DRF
 * enforces CSRF only on a request it authenticated by session, so sending no
 * cookie is what makes an anonymous write one round trip. The admin's
 * moderation calls are the credentialed half and live in `adminComments.ts`.
 */

import { API_BASE_URL, publicRequest } from "./posts";

/** One comment, mirroring `myapp.serializers.CommentSerializer`. */
export interface Comment {
  id: number;
  /** The slug of the post it is on, not a numeric id -- the client already has
   *  the slug and has no reason to look an id up. */
  post: string;
  /** The post's title, for the admin's list; a thread already knows its post. */
  post_title: string;
  /** What the commenter typed. Not an account and not verified in any way, so
   *  it is display text and nothing else. */
  author_name: string;
  /** Plain text, deliberately not Markdown -- rendering a stranger's markup is
   *  how a comment box becomes an injection surface. Newlines are the
   *  commenter's paragraphs and are preserved with `whiteSpace: pre-line`. */
  body: string;
  /** "hidden" is the moderated state, and an anonymous caller never sees one. */
  status: "published" | "hidden";
  created_at: string;
  updated_at: string;
}

/** DRF's PageNumberPagination envelope. */
export interface CommentPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Comment[];
}

/** What the form collects. `post` is the slug it is being left on. */
export interface CommentDraft {
  post: string;
  author_name: string;
  body: string;
}

/** The longest comment the API will take, mirroring `Comment.body`'s
 *  max_length. Checked in the form as a courtesy -- the server re-checks, and
 *  that is the check that counts. */
export const MAX_COMMENT_LENGTH = 2000;

/** The longest name, mirroring `Comment.author_name`. */
export const MAX_NAME_LENGTH = 80;

async function readOrThrow(response: Response): Promise<unknown> {
  if (response.ok) return response.json();

  // A 429 is the rate limit, and it is the one refusal a visitor can actually
  // do something about -- so it says so, rather than arriving as a bare
  // "the API returned 429".
  if (response.status === 429) {
    throw new Error(
      "That is a lot of comments in a short time. Try again in a little while.",
    );
  }

  // DRF answers a failed write with per-field messages; the first one is what
  // the commenter needs to read, since the form has two fields and both of
  // their problems are self-explanatory in the API's own wording.
  const body = await response.json().catch(() => null);
  const detail = firstMessage(body);
  throw new Error(
    detail ?? `The API returned ${response.status} ${response.statusText}.`,
  );
}

function firstMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  for (const value of Object.values(body as Record<string, unknown>)) {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return null;
}

/**
 * One numbered page of a post's visible comments, oldest first.
 *
 * Oldest first because a thread is read top to bottom -- the API's default
 * ordering, so there is no parameter for it here.
 */
export async function fetchComments(
  slug: string,
  page: number,
  signal?: AbortSignal,
): Promise<CommentPage> {
  const params = new URLSearchParams({ post: slug });
  // DRF treats `?page=1` as no param, so leaving it out keeps the URL honest.
  if (page > 1) params.set("page", String(page));
  const response = await publicRequest(
    `${API_BASE_URL}/comments/?${params}`,
    signal,
  );
  return (await readOrThrow(response)) as CommentPage;
}

/** Leave a comment. Anonymous, so the API decides the status -- see
 *  `CommentViewSet.perform_create`. */
export async function createComment(
  draft: CommentDraft,
  signal?: AbortSignal,
): Promise<Comment> {
  const response = await publicRequest(`${API_BASE_URL}/comments/`, signal, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  return (await readOrThrow(response)) as Comment;
}
