import { useCallback, useEffect, useState } from "react";

import {
  fetchPostsPage,
  isAbort,
  PAGE_SIZE,
  VISIBLE_CATEGORIES,
  type Post,
  type PostCategory,
} from "./posts";

type Phase = "loading" | "ready" | "error";

interface PaginatedPostsState {
  posts: Post[];
  count: number;
  phase: Phase;
  error: string | null;
}

const INITIAL: PaginatedPostsState = {
  posts: [],
  count: 0,
  phase: "loading",
  error: null,
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Loads one numbered page of posts, for the Posts page's category filter and
 * Prev/Next pagination. `category` of `undefined` asks for every category.
 *
 * That "every category" case filters out `garage_sale` client-side (see
 * `VISIBLE_CATEGORIES`), since it has no public page to link to -- so `count`
 * (and the page count derived from it) can run slightly high if any exist.
 * Not worth a backend change for a category the site no longer surfaces.
 */
export function usePaginatedPosts(category: PostCategory | undefined, page: number) {
  const [state, setState] = useState<PaginatedPostsState>(INITIAL);
  // Bumping this re-runs the effect below; it is what the retry button drives.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(INITIAL);

    fetchPostsPage({ category, page }, controller.signal)
      .then((result) =>
        setState({
          posts: category
            ? result.results
            : result.results.filter((post) => VISIBLE_CATEGORIES.includes(post.category)),
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
  }, [category, page, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const totalPages = Math.max(1, Math.ceil(state.count / PAGE_SIZE));

  return { ...state, totalPages, retry };
}
