import { useCallback, useEffect, useState } from "react";

import { fetchPost, isAbort, PostNotFoundError, type Post } from "./posts";

type Phase = "loading" | "ready" | "error" | "not-found";

interface PostState {
  post: Post | null;
  phase: Phase;
  error: string | null;
}

const INITIAL: PostState = { post: null, phase: "loading", error: null };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Loads a single post by slug, exposing the four states a detail page has to
 * render: loading, error, not-found and populated.
 */
export function usePost(slug: string) {
  const [state, setState] = useState<PostState>(INITIAL);
  // Bumping this re-runs the effect below; it is what the retry button drives.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(INITIAL);

    fetchPost(slug, controller.signal)
      .then((post) => setState({ post, phase: "ready", error: null }))
      .catch((error: unknown) => {
        // Aborted because the component unmounted or the slug changed -- there
        // is no state left worth updating.
        if (isAbort(error)) return;
        if (error instanceof PostNotFoundError) {
          setState({ post: null, phase: "not-found", error: null });
          return;
        }
        setState({ post: null, phase: "error", error: message(error) });
      });

    return () => controller.abort();
  }, [slug, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, retry };
}
