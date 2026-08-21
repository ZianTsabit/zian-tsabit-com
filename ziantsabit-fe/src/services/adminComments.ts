/**
 * Moderation calls against `/api/comments/`, for the admin page only.
 *
 * The public thread keeps using `comments.ts` and sees published comments
 * exactly as a visitor does; these go through `apiRequest`, so they carry the
 * session cookie and a CSRF token -- which is also what makes hidden comments
 * visible. Same split as `posts.ts` / `adminPosts.ts` and `books.ts` /
 * `adminBooks.ts`.
 *
 * **There is no create and no update of the text.** A comment is the
 * visitor's; the only thing the owner has over it is whether it is shown, and
 * whether it stays at all. Editing what somebody wrote while leaving their name
 * on it is the one thing a comment box must not make easy -- the Django admin
 * marks the same fields read-only for the same reason.
 */

import { apiRequest } from "./api";
import type { Comment, CommentPage } from "./comments";

export type CommentStatus = Comment["status"];

export const COMMENT_STATUSES: { value: CommentStatus; label: string }[] = [
  { value: "published", label: "Published" },
  { value: "hidden", label: "Hidden" },
];

/** What the console's Sort control offers. "" is the API's default. */
export const COMMENT_SORTS: { value: string; label: string }[] = [
  // Newest leads here, the opposite of the public thread: what the owner opens
  // this page for is whatever arrived while nobody was looking.
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

export interface AdminCommentFilters {
  /** A post slug. */
  post?: string;
  status?: string;
  search?: string;
  ordering?: string;
  /** 1-based. Omitted or 1 asks for the first page. */
  page?: number;
}

function query(filters: AdminCommentFilters): string {
  const params = new URLSearchParams();
  // An empty value would be sent as `?status=` and rejected as an unknown
  // status, so "no filter" has to mean "no parameter".
  if (filters.post) params.set("post", filters.post);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.ordering) params.set("ordering", filters.ordering);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** One page of comments across every post, hidden ones included. */
export function fetchAdminComments(
  filters: AdminCommentFilters,
  signal?: AbortSignal,
): Promise<CommentPage> {
  return apiRequest<CommentPage>(`/comments/${query(filters)}`, { signal });
}

/** Hide a comment, or put it back. A PATCH of one field, like `setBookStatus`. */
export function setCommentStatus(
  id: number,
  status: CommentStatus,
): Promise<Comment> {
  return apiRequest<Comment>(`/comments/${id}/`, {
    method: "PATCH",
    body: { status },
  });
}

export function deleteComment(id: number): Promise<void> {
  return apiRequest<void>(`/comments/${id}/`, { method: "DELETE" });
}
