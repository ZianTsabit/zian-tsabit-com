import { useCallback, useEffect, useState } from "react";

import { fetchAdminComments } from "./adminComments";
import type { Comment } from "./comments";
import { isAbort, PAGE_SIZE } from "./posts";

type Phase = "loading" | "ready" | "error";

interface State {
  comments: Comment[];
  count: number;
  phase: Phase;
  error: string | null;
}

const INITIAL: State = { comments: [], count: 0, phase: "loading", error: null };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * The admin's comment list: one numbered page, hidden ones included.
 *
 * Filters are separate strings rather than an object, for the same reason as
 * `useAdminPosts` and `useAdminBooks` -- a fresh object literal every render
 * would re-trigger the effect forever.
 *
 * `reload` re-fetches the page currently shown, and every moderation call uses
 * it: hiding a comment can move it out of the filter being viewed, so patching
 * the row in place would leave a list the API disagrees with.
 */
export function useAdminComments(
  post: string,
  status: string,
  search: string,
  ordering: string,
  page: number,
) {
  const [state, setState] = useState<State>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(INITIAL);

    fetchAdminComments(
      { post, status, search, ordering, page },
      controller.signal,
    )
      .then((result) =>
        setState({
          comments: result.results,
          count: result.count,
          phase: "ready",
          error: null,
        }),
      )
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setState({ comments: [], count: 0, phase: "error", error: message(error) });
      });

    return () => controller.abort();
  }, [post, status, search, ordering, page, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const totalPages = Math.max(1, Math.ceil(state.count / PAGE_SIZE));

  return { ...state, totalPages, reload };
}
