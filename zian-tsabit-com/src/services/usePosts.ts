import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchPostPage,
  fetchPosts,
  isAbort,
  type Post,
  type PostCategory,
} from "./posts";

type Phase = "loading" | "ready" | "error";

interface PostsState {
  posts: Post[];
  next: string | null;
  phase: Phase;
  error: string | null;
}

const INITIAL: PostsState = {
  posts: [],
  next: null,
  phase: "loading",
  error: null,
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Loads one category's posts, exposing the four states a page has to render:
 * loading, error, empty and populated.
 *
 * `loadMore` appends the next page -- the API returns 20 per page, so without it
 * a long section would silently stop at twenty entries.
 */
export function usePosts(category: PostCategory) {
  const [state, setState] = useState<PostsState>(INITIAL);
  const [loadingMore, setLoadingMore] = useState(false);
  // Bumping this re-runs the effect below; it is what the retry button drives.
  const [attempt, setAttempt] = useState(0);
  const moreController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // Abort any load-more still running for the previous category, or its rows
    // would be appended to the list that replaced them.
    moreController.current?.abort();
    setLoadingMore(false);
    setState(INITIAL);

    fetchPosts(category, controller.signal)
      .then((page) =>
        setState({
          posts: page.results,
          next: page.next,
          phase: "ready",
          error: null,
        }),
      )
      .catch((error: unknown) => {
        // Aborted because the component unmounted or the category changed --
        // there is no state left worth updating.
        if (isAbort(error)) return;
        setState({
          posts: [],
          next: null,
          phase: "error",
          error: message(error),
        });
      });

    return () => controller.abort();
  }, [category, attempt]);

  useEffect(() => () => moreController.current?.abort(), []);

  const loadMore = useCallback(() => {
    const url = state.next;
    if (!url || loadingMore) return;

    const controller = new AbortController();
    moreController.current = controller;
    setLoadingMore(true);

    fetchPostPage(url, controller.signal)
      .then((page) => {
        setState((current) => ({
          ...current,
          posts: [...current.posts, ...page.results],
          next: page.next,
        }));
        setLoadingMore(false);
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        // The rows already on screen stay: only the extra page failed, so
        // dropping them would be a worse outcome than a message.
        setState((current) => ({ ...current, error: message(error) }));
        setLoadingMore(false);
      });
  }, [state.next, loadingMore]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, loadingMore, loadMore, retry };
}
