import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAdminPostPage, fetchAdminPosts } from "./adminPosts";
import { isAbort, type Post } from "./posts";

type Phase = "loading" | "ready" | "error";

interface State {
  posts: Post[];
  next: string | null;
  phase: Phase;
  error: string | null;
}

const INITIAL: State = { posts: [], next: null, phase: "loading", error: null };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * The admin page's post list: every category by default, drafts included.
 *
 * Filters are passed as two strings rather than an object so that a caller can
 * build them inline -- a fresh object literal every render would re-trigger the
 * effect forever. An empty string means "no filter".
 *
 * `reload` re-fetches from the first page, and every mutation calls it: a create
 * or a status change moves rows around under `-published_at` ordering, so
 * patching one row in place would leave the list in an order the API disagrees
 * with.
 */
export function useAdminPosts(category: string, status: string) {
  const [state, setState] = useState<State>(INITIAL);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const moreController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // Any load-more still in flight belongs to the previous filter, and its rows
    // would be appended to the list that replaced them.
    moreController.current?.abort();
    setLoadingMore(false);
    setState(INITIAL);

    fetchAdminPosts({ category, status }, controller.signal)
      .then((page) =>
        setState({
          posts: page.results,
          next: page.next,
          phase: "ready",
          error: null,
        }),
      )
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setState({ posts: [], next: null, phase: "error", error: message(error) });
      });

    return () => controller.abort();
  }, [category, status, attempt]);

  useEffect(() => () => moreController.current?.abort(), []);

  const loadMore = useCallback(() => {
    const url = state.next;
    if (!url || loadingMore) return;

    const controller = new AbortController();
    moreController.current = controller;
    setLoadingMore(true);

    fetchAdminPostPage(url, controller.signal)
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
        // The rows on screen stay: only the extra page failed.
        setState((current) => ({ ...current, error: message(error) }));
        setLoadingMore(false);
      });
  }, [state.next, loadingMore]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, loadingMore, loadMore, reload };
}
