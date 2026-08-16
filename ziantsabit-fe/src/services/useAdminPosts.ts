import { useCallback, useEffect, useState } from "react";

import { fetchAdminPosts } from "./adminPosts";
import { isAbort, PAGE_SIZE, type Post } from "./posts";

type Phase = "loading" | "ready" | "error";

interface State {
  posts: Post[];
  count: number;
  phase: Phase;
  error: string | null;
}

const INITIAL: State = { posts: [], count: 0, phase: "loading", error: null };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * The admin page's post list: one numbered page, every category by default,
 * drafts included.
 *
 * Filters are passed as separate strings rather than an object so that a caller
 * can build them inline -- a fresh object literal every render would re-trigger
 * the effect forever. An empty string means "no filter", an empty `ordering`
 * means the API's default (newest first), and `after`/`before` are inclusive
 * YYYY-MM-DD bounds.
 *
 * `reload` re-fetches the page currently shown, and every mutation calls it: a
 * create or a status change moves rows around under the API's ordering, so
 * patching one row in place would leave the list in an order the API disagrees
 * with. Note a mutation can empty the last page -- delete the only row on page
 * 3 and page 3 stops existing -- which is why the caller watches for a ready
 * page with no rows and steps back.
 */
export function useAdminPosts(
  category: string,
  status: string,
  ordering: string,
  page: number,
  after = "",
  before = "",
) {
  const [state, setState] = useState<State>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(INITIAL);

    fetchAdminPosts(
      { category, status, ordering, page, after, before },
      controller.signal,
    )
      .then((result) =>
        setState({
          posts: result.results,
          count: result.count,
          phase: "ready",
          error: null,
        }),
      )
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setState({ posts: [], count: 0, phase: "error", error: message(error) });
      });

    return () => controller.abort();
  }, [category, status, ordering, page, after, before, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const totalPages = Math.max(1, Math.ceil(state.count / PAGE_SIZE));

  return { ...state, totalPages, reload };
}
