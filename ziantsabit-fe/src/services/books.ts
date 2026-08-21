/**
 * Client for the Django book-catalogue API.
 *
 * Deliberately its own resource rather than a slice of `posts.ts`. A book is a
 * thing in the world -- it has an author who is not the site's owner, a year,
 * an ISBN and a review written *about* it -- and `/books` is a shelf rather
 * than a feed. Writing about reading is still a post, tagged however its author
 * likes, and lives in the blog with everything else.
 *
 * Credential-free like the post client, and for the same reason: a visitor
 * needs no cookie, and sending the owner's session on a public page would
 * quietly start showing unpublished entries there. The admin's writes go
 * through `adminBooks.ts` instead.
 */

import { API_BASE_URL, publicRequest } from "./posts";

/** One book, mirroring `myapp.serializers.BookSerializer`. */
export interface Book {
  id: number;
  title: string;
  slug: string;
  /** As it reads on the cover. Several authors arrive as one string -- the
   *  backend stores a line, not a list, on purpose. */
  author: string;
  /** Free-form labels, already trimmed and deduped by the API. */
  genres: string[];
  /** Stored without separators, so it is 10 or 13 characters or "". */
  isbn: string;
  /** Null when the edition carries no year, which is common enough that the
   *  catalogue has to render around it rather than treat it as missing data. */
  release_year: number | null;
  /** The owner's write-up. Markdown, rendered by the same component post
   *  bodies go through. */
  review: string;
  /** The jacket. Empty string, never null. */
  cover_image_url: string;
  cover_image_alt: string;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
}

/** DRF's PageNumberPagination envelope, for books. */
export interface BookPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Book[];
}

/** One row of `GET /api/books/genres/`: a label and how many books carry it. */
export interface GenreCount {
  name: string;
  count: number;
}

/** What `?ordering=` accepts, mirroring BOOK_ORDERINGS in myapp/views.py.
 *  "recent" is the API's default, so it is sent as "" and left off the URL. */
export const BOOK_SORTS: { value: string; label: string }[] = [
  { value: "", label: "Recently added" },
  { value: "title", label: "Title A–Z" },
  { value: "author", label: "Author A–Z" },
  { value: "year", label: "Newest release" },
];

/** A slug with no matching published book -- distinct from a network error. */
export class BookNotFoundError extends Error {
  constructor(slug: string) {
    super(`No book found with slug "${slug}".`);
    this.name = "BookNotFoundError";
  }
}

async function readPage(url: string, signal?: AbortSignal): Promise<BookPage> {
  const response = await publicRequest(url, signal);
  if (!response.ok) {
    throw new Error(`The API returned ${response.status} ${response.statusText}.`);
  }
  return (await response.json()) as BookPage;
}

/** The filters the catalogue page offers. Each is optional and each is left
 *  off the URL when empty -- an empty `?genre=` would be a filter matching
 *  nothing rather than the absence of one. */
export interface BookQuery {
  genre?: string;
  /** Matched against title, author and ISBN by the API. */
  search?: string;
  ordering?: string;
  page?: number;
}

/** Fetch one numbered page of the catalogue. */
export function fetchBooksPage(
  { genre, search, ordering, page }: BookQuery,
  signal?: AbortSignal,
): Promise<BookPage> {
  const params = new URLSearchParams();
  if (genre) params.set("genre", genre);
  if (search) params.set("search", search);
  if (ordering) params.set("ordering", ordering);
  // DRF treats `?page=1` the same as no param, so leaving it off keeps the
  // first page's URL clean.
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return readPage(`${API_BASE_URL}/books/${query ? `?${query}` : ""}`, signal);
}

/** Fetch one book by slug, for its detail page. An unpublished entry 404s for
 *  an anonymous caller exactly as a nonexistent one does. */
export async function fetchBook(slug: string, signal?: AbortSignal): Promise<Book> {
  const url = `${API_BASE_URL}/books/${encodeURIComponent(slug)}/`;
  const response = await publicRequest(url, signal);

  if (response.status === 404) throw new BookNotFoundError(slug);
  if (!response.ok) {
    throw new Error(`The API returned ${response.status} ${response.statusText}.`);
  }
  return (await response.json()) as Book;
}

/**
 * Every genre in the catalogue, commonest first.
 *
 * Fetched rather than derived from the books on screen: genres are free text,
 * so there is no enum to read them off, and building the list from one page of
 * results would offer only the genres that happened to land on page one.
 */
export async function fetchGenres(signal?: AbortSignal): Promise<GenreCount[]> {
  const response = await publicRequest(`${API_BASE_URL}/books/genres/`, signal);
  if (!response.ok) {
    throw new Error(`The API returned ${response.status} ${response.statusText}.`);
  }
  return (await response.json()) as GenreCount[];
}

/** How a book's year is written wherever one is shown. Undated books say so
 *  rather than rendering a gap the reader has to interpret. */
export function formatYear(year: number | null): string {
  return year === null ? "Year unknown" : String(year);
}

/**
 * An ISBN put back into its readable, hyphenated shape -- roughly.
 *
 * The stored value has no separators, and 13 undifferentiated digits are hard
 * to check against a book in your hand. The real grouping depends on the
 * registration authority and is not derivable without a lookup table, so this
 * only splits off the prefix and the check digit: enough to make the number
 * scannable, and honest about not being the official hyphenation.
 */
export function formatIsbn(isbn: string): string {
  if (isbn.length === 13) return `${isbn.slice(0, 3)}-${isbn.slice(3, 12)}-${isbn.slice(12)}`;
  if (isbn.length === 10) return `${isbn.slice(0, 9)}-${isbn.slice(9)}`;
  return isbn;
}
