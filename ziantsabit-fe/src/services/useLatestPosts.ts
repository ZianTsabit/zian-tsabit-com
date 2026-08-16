import { useCallback, useEffect, useState } from "react";

import { fetchLatestPosts, isAbort, VISIBLE_CATEGORIES, type Post } from "./posts";

type Phase = "loading" | "ready" | "error";

interface LatestPostsState {
  posts: Post[];
  phase: Phase;
  error: string | null;
}

const INITIAL: LatestPostsState = { posts: [], phase: "loading", error: null };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Loads the `limit` most recently edited posts across every category, for
 * Home's "Latest Updates" feed -- ordered by updated_at, not by publication
 * date. No pagination: it's a fixed-size teaser, not a full list, unlike the
 * section lists it links into.
 */
export function useLatestPosts(limit: number) {
  const [state, setState] = useState<LatestPostsState>(INITIAL);
  // Bumping this re-runs the effect below; it is what the retry button drives.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(INITIAL);

    fetchLatestPosts(controller.signal)
      .then((page) =>
        setState({
          // garage_sale has no public page to link to -- see VISIBLE_CATEGORIES.
          posts: page.results
            .filter((post) => VISIBLE_CATEGORIES.includes(post.category))
            .slice(0, limit),
          phase: "ready",
          error: null,
        }),
      )
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setState({ posts: [], phase: "error", error: message(error) });
      });

    return () => controller.abort();
  }, [limit, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, retry };
}
