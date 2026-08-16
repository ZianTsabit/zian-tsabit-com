import { useCallback, useRef } from "react";

/**
 * Runs writes one at a time, in the order they were asked for.
 *
 * The post editor now has two things writing to the same post: the Save and
 * Publish buttons, and autosave. Left to race, the loser is whichever request
 * the server happens to finish last -- and an autosave carrying `status:
 * "draft"` landing after a Publish would quietly unpublish the post the user
 * just published. Serialising them makes "last asked for" and "last written"
 * the same thing.
 *
 * It also keeps `persist`'s bookkeeping honest: both pages remember the slug
 * the post currently lives at, and two overlapping writes would each read that
 * ref before the other updated it -- on the new-post page, that means two
 * POSTs and two posts.
 */
export function useWriteQueue() {
  const tail = useRef<Promise<unknown>>(Promise.resolve());

  return useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    // Same task in both arms: a write that failed must not stall the queue, and
    // the next one is still worth attempting.
    const next = tail.current.then(task, task);
    // Swallowed here only, so an unhandled rejection cannot come from the
    // queue's own bookkeeping copy. The caller keeps `next` itself and still
    // sees the rejection.
    tail.current = next.catch(() => undefined);
    return next;
  }, []);
}
