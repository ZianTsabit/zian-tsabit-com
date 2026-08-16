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

/** What `?ordering=` accepts, mirroring ORDERINGS in myapp/views.py. "recent"
 *  is the API's default, so it is sent as an empty value and left off the URL. */
export const SORTS: { value: string; label: string }[] = [
  { value: "", label: "Newest first" },
  // The one the rows are dated by: each shows its last edit, so this is the
  // order in which those dates run downwards.
  { value: "updated", label: "Recently updated" },
  { value: "views", label: "Most read" },
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
  /** Already-uploaded URL, not a File: the picker uploads on selection, so by
   *  the time this is set the bytes are in the bucket and saving the post is
   *  still a plain JSON write. Empty string means "no cover". */
  cover_image_url: string;
  cover_image_alt: string;
  /** Sent as a list; the API is what trims, dedupes and drops blanks, so the
   *  form does not have to be the place that guarantees it. */
  tags: string[];
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
    cover_image_url: post.cover_image_url,
    cover_image_alt: post.cover_image_alt,
    tags: post.tags,
    published_at: post.published_at,
  };
}

export function emptyDraft(category: PostCategory = "posts"): PostDraft {
  return {
    title: "",
    slug: "",
    category,
    status: "draft",
    excerpt: "",
    body: "",
    cover_image_url: "",
    cover_image_alt: "",
    tags: [],
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

/**
 * The slug Django's `slugify` would derive from a title.
 *
 * Needed only by autosave on the new-post page. A post's slug is generated once,
 * by `Post.save()`, and never regenerated -- so a post created from a
 * half-finished title keeps the half-finished URL forever. Re-deriving it on
 * each autosave lets the URL follow the title until the author either types
 * their own slug or leaves the page.
 *
 * A mismatch with Django's version costs nothing worse than a `-2` suffix: the
 * server dedupes against every post *but this one*, so re-sending a slug the
 * post already holds is a no-op.
 */
export function deriveSlug(title: string): string {
  return (
    title
      .normalize("NFKD")
      // NFKD splits an accent off its letter; this drops the accent, which is
      // what Django's ascii-encode step does to it.
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, "")
      .trim()
      .replace(/[\s-]+/g, "-")
      // 220 is the model's max_length; trimming can leave a trailing hyphen, so
      // the strip comes after it.
      .slice(0, 220)
      .replace(/^[-_]+|[-_]+$/g, "")
  );
}

export interface AdminFilters {
  category?: string;
  status?: string;
  /** "" or omitted means the API's default ordering. */
  ordering?: string;
  /** 1-based. Omitted or 1 asks for the first page: DRF treats `?page=1` the
   *  same as no param, so leaving it off keeps that URL clean. */
  page?: number;
  /** Inclusive YYYY-MM-DD bounds; "" or omitted leaves that end open. A draft
   *  is dated by its created_at, which is the date the list shows for it. */
  after?: string;
  before?: string;
}

function query(filters: AdminFilters): string {
  const params = new URLSearchParams();
  // An empty value would be sent as `?category=` and rejected as an unknown
  // category, so "no filter" has to mean "no parameter".
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.ordering) params.set("ordering", filters.ordering);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  if (filters.after) params.set("published_after", filters.after);
  if (filters.before) params.set("published_before", filters.before);
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** First page of posts, drafts included. */
export function fetchAdminPosts(
  filters: AdminFilters,
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

/**
 * How to send one write, as opposed to what to send.
 *
 * Only autosave passes anything here, and only on its way out: `keepalive` is
 * what lets the write survive the document that started it. Structurally the
 * same shape as `SaveOptions` in `useAutosave`, so a page can hand the hook's
 * argument straight down.
 */
export interface WriteOptions {
  keepalive?: boolean;
}

export function createPost(
  draft: PostDraft,
  options: WriteOptions = {},
): Promise<Post> {
  return apiRequest<Post>("/posts/", {
    method: "POST",
    body: payload(draft),
    ...options,
  });
}

/**
 * PATCH rather than PUT: an omitted slug then means "keep the current URL",
 * where PUT would treat the missing field as a request to regenerate it.
 */
export function updatePost(
  slug: string,
  draft: PostDraft,
  options: WriteOptions = {},
): Promise<Post> {
  return apiRequest<Post>(`/posts/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    body: payload(draft),
    ...options,
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
