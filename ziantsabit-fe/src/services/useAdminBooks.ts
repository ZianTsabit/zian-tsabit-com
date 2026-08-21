import { useCallback, useEffect, useState } from "react";

import { fetchAdminBooks } from "./adminBooks";
import { BOOKS_PAGE_SIZE, type Book } from "./books";
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
 * The admin's book list: one numbered page, drafts included.
 *
 * Filters are separate strings rather than an object, for the same reason as
 * `useAdminPosts` -- a fresh object literal every render would re-trigger the
 * effect forever.
 *
 * `reload` re-fetches the page currently shown, and every mutation calls it: a
 * create or a status change moves rows around under the API's ordering, so
 * patching one row in place would leave the list in an order the API disagrees
 * with. A mutation can also empty the last page, which is why the caller
 * watches for a ready page with no rows and steps back.
 */
export function useAdminBooks(
  genre: string,
  search: string,
  status: string,
  ordering: string,
  page: number,
) {
  const [state, setState] = useState<State>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(INITIAL);

    fetchAdminBooks(
      { genre, search, status, ordering, page },
      controller.signal,
    )
      .then((result) =>
        setState({
          books: result.results,
          count: result.count,
          phase: "ready",
          error: null,
        }),
      )
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setState({ books: [], count: 0, phase: "error", error: message(error) });
      });

    return () => controller.abort();
  }, [genre, search, status, ordering, page, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  // The catalogue's own page size, not the site-wide one -- see
  // BOOKS_PAGE_SIZE. Counting with the wrong number here offers pages the
  // API has nothing to put on.
  const totalPages = Math.max(1, Math.ceil(state.count / BOOKS_PAGE_SIZE));

  return { ...state, totalPages, reload };
}
