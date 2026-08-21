import { useCallback, useEffect, useState } from "react";

import {
  fetchPostsPage,
  fetchTags,
  isAbort,
  PAGE_SIZE,
  type Post,
  type TagCount,
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
 * Loads one numbered page of posts, for the Blog page's filters and numbered
 * pagination. An empty `tag` asks for every post, and `after` / `before` are
 * YYYY-MM-DD days (either may be "" for an open-ended range).
 *
 * Every filter is a separate string argument rather than one object so a
 * caller can pass them inline: a fresh object literal every render would
 * re-trigger the effect forever.
 *
 * `count` is now exactly what the API reports. It used to be able to run
 * slightly high, because the unfiltered case dropped garage-sale-only posts
 * client-side after the server had already counted them -- categories are gone,
 * so there is nothing left to hide and nothing to be wrong about.
 */
export function usePaginatedPosts(
  tag: string,
  page: number,
  after = "",
  before = "",
) {
  const [state, setState] = useState<PaginatedPostsState>(INITIAL);
  // Bumping this re-runs the effect below; it is what the retry button drives.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(INITIAL);

    fetchPostsPage({ tag, page, after, before }, controller.signal)
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
  }, [tag, page, after, before, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const totalPages = Math.max(1, Math.ceil(state.count / PAGE_SIZE));

  return { ...state, totalPages, retry };
}

/**
 * The tag vocabulary, for the feed's filter control.
 *
 * Fetched once on mount and deliberately never refreshed: the list only moves
 * when a post is written or retagged, which is not something happening while a
 * visitor is reading the page. A failure is swallowed into an empty list rather
 * than reported -- the filter is a convenience, and losing it is not worth an
 * error banner over a feed that loaded perfectly well. Mirrors `useGenres`.
 */
export function useTags(): TagCount[] {
  const [tags, setTags] = useState<TagCount[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTags(controller.signal)
      .then(setTags)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return tags;
}
