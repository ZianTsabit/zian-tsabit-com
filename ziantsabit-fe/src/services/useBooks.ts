import { useCallback, useEffect, useState } from "react";

import {
  BOOKS_PAGE_SIZE,
  fetchBooksPage,
  fetchGenres,
  type Book,
  type GenreCount,
} from "./books";
import { isAbort } from "./posts";

type Phase = "loading" | "ready" | "error";

interface State {
  books: Book[];
  count: number;
  phase: Phase;
  error: string | null;
}

const INITIAL: State = { books: [], count: 0, phase: "loading", error: null };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * One numbered page of the catalogue, filtered.
 *
 * Filters are separate string arguments rather than one object, the same as
 * `usePaginatedPosts` and `useAdminPosts`: a fresh object literal built inline
 * every render would re-trigger the effect forever.
 */
export function useBooks(
  genre: string,
  search: string,
  ordering: string,
  page: number,
) {
  const [state, setState] = useState<State>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(INITIAL);

    fetchBooksPage({ genre, search, ordering, page }, controller.signal)
      .then((result) =>
        setState({
          books: result.results,
          count: result.count,
          phase: "ready",
          error: null,
        }),
      )
      .catch((error: unknown) => {
        // A cancelled request is not a failure: the effect aborts on every
        // filter change, and a keystroke in the search box is one of those.
        if (isAbort(error)) return;
        setState({ books: [], count: 0, phase: "error", error: message(error) });
      });

    return () => controller.abort();
  }, [genre, search, ordering, page, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // The catalogue's own page size, not the site-wide one -- see
  // BOOKS_PAGE_SIZE. Counting with the wrong number here offers pages the
  // API has nothing to put on.
  const totalPages = Math.max(1, Math.ceil(state.count / BOOKS_PAGE_SIZE));

  return { ...state, totalPages, retry };
}

/**
 * The genre vocabulary, for the catalogue's filter.
 *
 * Fetched once on mount and deliberately never refreshed: the list only moves
 * when a book is added or edited, which is not something happening while a
 * visitor is reading the page. A failure is swallowed into an empty list
 * rather than reported -- the filter is a convenience, and losing it is not
 * worth an error banner over a catalogue that loaded perfectly well.
 */
export function useGenres(): GenreCount[] {
  const [genres, setGenres] = useState<GenreCount[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchGenres(controller.signal)
      .then(setGenres)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return genres;
}
