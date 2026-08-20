/**
 * Writes against `/api/books/`, for the admin page only.
 *
 * The public catalogue keeps using `books.ts` and sees published entries
 * exactly as a visitor does; these go through `apiRequest`, so they carry the
 * session cookie and a CSRF token -- which is also what makes drafts visible.
 * Mirrors `adminPosts.ts` deliberately: the two consoles are the same shape,
 * and a book editor that diverged in how it saves would be a second set of
 * autosave bugs to find.
 */

import { apiRequest } from "./api";
import type { Book, BookPage } from "./books";

export type BookStatus = Book["status"];

export const BOOK_STATUSES: { value: BookStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

/** The editable half of a book: what the form collects and the API accepts. */
export interface BookDraft {
  title: string;
  /** Blank means "generate from the title" on create, "leave alone" on update. */
  slug: string;
  author: string;
  genres: string[];
  /** Sent as typed; the API strips the separators and checks the check digit. */
  isbn: string;
  /** The form holds a string because an `<input>` does -- "" is "no year", and
   *  `payload()` is what turns it into the `null` the API wants. */
  release_year: string;
  review: string;
  /** Already-uploaded URL, not a File: the picker uploads on selection, so by
   *  the time this is set the bytes are in the bucket and saving the entry is
   *  still a plain JSON write. */
  cover_image_url: string;
  cover_image_alt: string;
}

export function draftFrom(book: Book): BookDraft {
  return {
    title: book.title,
    slug: book.slug,
    author: book.author,
    genres: book.genres,
    isbn: book.isbn,
    release_year: book.release_year === null ? "" : String(book.release_year),
    review: book.review,
    cover_image_url: book.cover_image_url,
    cover_image_alt: book.cover_image_alt,
  };
}

export function emptyDraft(): BookDraft {
  return {
    title: "",
    slug: "",
    author: "",
    genres: [],
    isbn: "",
    release_year: "",
    review: "",
    cover_image_url: "",
    cover_image_alt: "",
  };
}

function payload(draft: BookDraft, status: BookStatus) {
  const { slug, release_year, ...rest } = draft;
  // A blank slug is left out rather than sent as "": the serializer rejects an
  // empty one (it would pass the unique check and then collide inside
  // Book.save()), and omitting the key is how both of its meanings are asked
  // for -- "derive it" on create, "keep it" on update.
  const trimmed = slug.trim();
  const year = release_year.trim();
  return {
    ...rest,
    status,
    // Explicitly null rather than omitted: on a PATCH, leaving the key out
    // means "keep the year you have", so clearing the field would silently do
    // nothing at all.
    release_year: year === "" ? null : Number(year),
    ...(trimmed ? { slug: trimmed } : {}),
  };
}

/**
 * The slug Django's `slugify` would derive from a title.
 *
 * Same reasoning as the post editor's: `Book.save()` generates a slug once and
 * never again, so an entry created by autosave from a half-typed title would
 * keep the half-typed URL forever. Re-deriving it on each save lets the URL
 * catch up until the author pins one by hand.
 */
export function deriveSlug(title: string): string {
  return (
    title
      .normalize("NFKD")
      // NFKD splits an accent off its letter; dropping the accents is what
      // Django's ascii-encode step does.
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

export interface AdminBookFilters {
  genre?: string;
  search?: string;
  status?: string;
  /** "" or omitted means the API's default ordering, most recently added. */
  ordering?: string;
  /** 1-based. Omitted or 1 asks for the first page. */
  page?: number;
}

function query(filters: AdminBookFilters): string {
  const params = new URLSearchParams();
  // An empty value would be sent as `?status=` and rejected as an unknown
  // status, so "no filter" has to mean "no parameter".
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.ordering) params.set("ordering", filters.ordering);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** One page of the catalogue, drafts included. */
export function fetchAdminBooks(
  filters: AdminBookFilters,
  signal?: AbortSignal,
): Promise<BookPage> {
  return apiRequest<BookPage>(`/books/${query(filters)}`, { signal });
}

/** One book by slug, drafts included -- for the edit page reached by a direct
 *  link or a reload. Clicking "Edit" from the list passes the book through
 *  router state instead, since the list already has it in memory. */
export function fetchAdminBook(slug: string, signal?: AbortSignal): Promise<Book> {
  return apiRequest<Book>(`/books/${encodeURIComponent(slug)}/`, { signal });
}

/** How to send one write, as opposed to what to send. Only autosave passes
 *  anything, and only on its way out. */
export interface WriteOptions {
  keepalive?: boolean;
}

export function createBook(
  draft: BookDraft,
  status: BookStatus,
  options: WriteOptions = {},
): Promise<Book> {
  return apiRequest<Book>("/books/", {
    method: "POST",
    body: payload(draft, status),
    ...options,
  });
}

/**
 * PATCH rather than PUT: an omitted slug then means "keep the current URL",
 * where PUT would treat the missing field as a request to regenerate it.
 */
export function updateBook(
  slug: string,
  draft: BookDraft,
  status: BookStatus,
  options: WriteOptions = {},
): Promise<Book> {
  return apiRequest<Book>(`/books/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    body: payload(draft, status),
    ...options,
  });
}

/** Publish or unpublish in one click, without opening the editor. */
export function setBookStatus(slug: string, status: BookStatus): Promise<Book> {
  return apiRequest<Book>(`/books/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    body: { status },
  });
}

export function deleteBook(slug: string): Promise<void> {
  return apiRequest<void>(`/books/${encodeURIComponent(slug)}/`, {
    method: "DELETE",
  });
}
