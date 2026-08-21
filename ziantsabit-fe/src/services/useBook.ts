import { useCallback, useEffect, useState } from "react";

import { BookNotFoundError, fetchBook, type Book } from "./books";
import { isAbort } from "./posts";

/** `not-found` on top of the usual three, so a dead link can say so rather
 *  than showing the same "could not reach the API" a real failure gets. */
type Phase = "loading" | "ready" | "not-found" | "error";

interface State {
  book: Book | null;
  phase: Phase;
  error: string | null;
}

const INITIAL: State = { book: null, phase: "loading", error: null };

/** One book by slug, for `BookDetail`. Mirrors `usePost`. */
export function useBook(slug: string) {
  const [state, setState] = useState<State>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(INITIAL);

    fetchBook(slug, controller.signal)
      .then((book) => setState({ book, phase: "ready", error: null }))
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        if (error instanceof BookNotFoundError) {
          setState({ book: null, phase: "not-found", error: null });
          return;
        }
        setState({
          book: null,
          phase: "error",
          error: error instanceof Error ? error.message : "Something went wrong.",
        });
      });

    return () => controller.abort();
  }, [slug, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, retry };
}
