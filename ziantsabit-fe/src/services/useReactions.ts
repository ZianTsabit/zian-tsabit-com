import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchReactions,
  toggleReaction,
  type ReactionSummary,
} from "./reactions";
import { visitorToken } from "./visitor";

/**
 * The reaction bar for one post: its counts, and what this browser picked.
 *
 * `summary` is null until the first fetch lands, which is what the bar renders
 * its skeleton from -- there is no separate phase, because a bar that failed
 * to load and a bar that has not loaded yet should look identical. **A failure
 * is swallowed rather than reported**, the same call `useTags` and `useGenres`
 * make: an error banner over a post that loaded perfectly well, because seven
 * emoji did not, would be the wrong thing to put on the page.
 *
 * `slug` is empty while the post is still loading, and the effect waits for it.
 */
export function useReactions(slug: string) {
  const [summary, setSummary] = useState<ReactionSummary | null>(null);
  // Which emoji has a write in flight, so its button can be held while the
  // server decides. One at a time: two toggles of the *same* emoji racing
  // would toggle it twice and land back where they started.
  const [pending, setPending] = useState<string | null>(null);
  // Read lazily rather than at module scope, so a token is only minted for a
  // visitor who actually reaches a post page -- and held in a ref so it is the
  // same string for the life of the component without being a dependency of
  // anything.
  const visitor = useRef("");
  if (!visitor.current) visitor.current = visitorToken();

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setSummary(null);

    fetchReactions(slug, visitor.current, controller.signal)
      .then(setSummary)
      .catch(() => undefined);

    return () => controller.abort();
  }, [slug]);

  /**
   * Toggle one emoji and replace the bar with what the server says it is.
   *
   * The response is the whole summary, so there is nothing to reconcile: a
   * count that moved because someone else reacted while this page was open
   * comes back corrected by the same request. Deliberately not optimistic --
   * a bar that flips instantly and then flips back on a failure is worse than
   * one that takes a moment, and the button is disabled meanwhile so it cannot
   * be double-tapped.
   *
   * Not aborted on unmount: the tap already happened, exactly like a recorded
   * view. Only the state update is skipped.
   */
  const toggle = useCallback(
    async (emoji: string) => {
      if (!slug || pending) return;
      setPending(emoji);
      try {
        setSummary(await toggleReaction(slug, emoji, visitor.current));
      } catch {
        // Deliberately nothing: the bar goes on showing what the last fetch
        // said, which is what it showed a moment ago, and a failed tap is not
        // worth an error banner on somebody else's post.
      } finally {
        setPending(null);
      }
    },
    [slug, pending],
  );

  return { summary, pending, toggle };
}
