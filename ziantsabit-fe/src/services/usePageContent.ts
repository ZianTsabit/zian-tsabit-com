import { useCallback, useEffect, useState } from "react";

import { fetchPage, type PageData, type PageKey } from "./pages";
import { isAbort } from "./posts";

type Phase = "loading" | "ready" | "error";

interface State<K extends PageKey> {
  data: PageData[K] | null;
  phase: Phase;
  error: string | null;
}

/**
 * One editable page's content, for the public CV and About pages.
 *
 * No `not-found` phase, unlike `usePost` and `useBook`: the API creates a row
 * for a known key rather than 404ing, so the only two outcomes are the content
 * and a genuine failure to reach the API. A page that has never been edited
 * comes back empty, which the pages render as empty sections rather than as an
 * error -- an unfilled CV is a real state, not a broken one.
 */
export function usePageContent<K extends PageKey>(key: K) {
  const [state, setState] = useState<State<K>>({
    data: null,
    phase: "loading",
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, phase: "loading", error: null });

    fetchPage(key, controller.signal)
      .then((page) => setState({ data: page.data, phase: "ready", error: null }))
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setState({
          data: null,
          phase: "error",
          error: error instanceof Error ? error.message : "Something went wrong.",
        });
      });

    return () => controller.abort();
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, retry };
}
