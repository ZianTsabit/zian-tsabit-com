import { useCallback, useEffect, useState } from "react";

import { fetchPostStats, type PostStats } from "./adminStats";
import { isAbort } from "./posts";

type Phase = "loading" | "ready" | "error";

interface State {
  stats: PostStats | null;
  phase: Phase;
  error: string | null;
}

const INITIAL: State = { stats: null, phase: "loading", error: null };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Site-wide post aggregates, for the overview and statistics pages.
 *
 * One request rather than a walk over the paginated list: the totals cover
 * every post, and a client adding up its own would be wrong the moment there
 * were more posts than it had fetched.
 *
 * `reload` is what the retry button drives, and it is stable across renders so
 * a caller can pass it straight to a handler.
 */
export function useAdminStats() {
  const [state, setState] = useState<State>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(INITIAL);

    fetchPostStats(controller.signal)
      .then((stats) => setState({ stats, phase: "ready", error: null }))
      .catch((error: unknown) => {
        // A cancelled request is not a failure: the effect aborts on unmount,
        // and reporting that would flash an error on the way out of the page.
        if (isAbort(error)) return;
        setState({ stats: null, phase: "error", error: message(error) });
      });

    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
