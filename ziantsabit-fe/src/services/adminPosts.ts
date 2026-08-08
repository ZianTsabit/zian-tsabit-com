/**
 * Writes against `/api/posts/`, for the admin page only.
 *
 * These go through `apiRequest`, so they carry the session cookie and a CSRF
 * token; the reads here do too, which is what makes drafts visible. The public
 * pages keep using `posts.ts` and see published posts exactly as a visitor does.
 */

import { apiRequest } from "./api";
import type { Post, PostCategory, PostPage } from "./posts";

export type PostStatus = Post["status"];

export const CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "books", label: "Books" },
  { value: "projects", label: "Projects" },
  { value: "garage_sale", label: "Garage Sale" },
];

export const STATUSES: { value: PostStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

/** The editable half of a post: what the form collects and the API accepts. */
export interface PostDraft {
  title: string;
  /** Blank means "generate from the title" on create, "leave alone" on update. */
  slug: string;
  category: PostCategory;
  status: PostStatus;
  excerpt: string;
  body: string;
  published_at: string | null;
}

export function draftFrom(post: Post): PostDraft {
  return {
    title: post.title,
    slug: post.slug,
    category: post.category,
    status: post.status,
    excerpt: post.excerpt,
    body: post.body,
    published_at: post.published_at,
  };
}

export function emptyDraft(category: PostCategory = "books"): PostDraft {
  return {
    title: "",
    slug: "",
    category,
    status: "draft",
    excerpt: "",
    body: "",
    published_at: null,
  };
}

function payload(draft: PostDraft) {
  const { slug, ...rest } = draft;
  // A blank slug is left out rather than sent as "": the serializer rejects an
  // empty one (it would pass the unique check and then collide inside
  // Post.save()), and omitting the key is how both of its meanings are asked for.
  const trimmed = slug.trim();
  return trimmed ? { ...rest, slug: trimmed } : rest;
}

function query(filters: { category?: string; status?: string }): string {
  const params = new URLSearchParams();
  // An empty value would be sent as `?category=` and rejected as an unknown
  // category, so "no filter" has to mean "no parameter".
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** First page of posts, drafts included. */
export function fetchAdminPosts(
  filters: { category?: string; status?: string },
  signal?: AbortSignal,
): Promise<PostPage> {
  return apiRequest<PostPage>(`/posts/${query(filters)}`, { signal });
}

/** A later page, from a previous page's absolute `next` link. */
export function fetchAdminPostPage(
  url: string,
  signal?: AbortSignal,
): Promise<PostPage> {
  return apiRequest<PostPage>(url, { signal });
}

/** One post by slug, drafts included -- for the edit page when it's reached
 *  without the post already in hand (a direct link, or a page reload). The
 *  common path (clicking "Edit" from the list) skips this and passes the post
 *  through router state instead, since the list already has it in memory. */
export function fetchAdminPost(slug: string, signal?: AbortSignal): Promise<Post> {
  return apiRequest<Post>(`/posts/${encodeURIComponent(slug)}/`, { signal });
}

export function createPost(draft: PostDraft): Promise<Post> {
  return apiRequest<Post>("/posts/", { method: "POST", body: payload(draft) });
}

/**
 * PATCH rather than PUT: an omitted slug then means "keep the current URL",
 * where PUT would treat the missing field as a request to regenerate it.
 */
export function updatePost(slug: string, draft: PostDraft): Promise<Post> {
  return apiRequest<Post>(`/posts/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    body: payload(draft),
  });
}

/** Publish or unpublish in one click, without opening the editor. */
export function setPostStatus(slug: string, status: PostStatus): Promise<Post> {
  return apiRequest<Post>(`/posts/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    body: { status },
  });
}

export function deletePost(slug: string): Promise<void> {
  return apiRequest<void>(`/posts/${encodeURIComponent(slug)}/`, {
    method: "DELETE",
  });
}
