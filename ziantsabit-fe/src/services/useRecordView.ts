import { useEffect, useState } from "react";

import { recordPostView, type Post } from "./posts";

const STORAGE_PREFIX = "viewed:";

/** sessionStorage throws outright in some privacy modes, so every touch of it
 *  is guarded: failing to remember a view is not worth breaking the page for. */
function alreadyCounted(slug: string): boolean {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + slug) !== null;
  } catch {
    return false;
  }
}

function remember(slug: string): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + slug, "1");
  } catch {
    // Nothing to do: the view still counted server-side, it just may count
    // again if this tab reopens the same post.
  }
}

/**
 * Count one read of `post`, at most once per browser session, and return the
 * total to display.
 *
 * The guard is sessionStorage rather than anything server-side: re-reading a
 * post, or bouncing back to it from a link, should not inflate the number, but
 * a returning visitor tomorrow is a genuine second read. It is a counter, not
 * analytics -- nothing here tries to defeat a determined refresher.
 *
 * The count is recorded *after* the post has loaded, so the number the GET
 * returned is one behind; the endpoint answers with the new total and that is
 * what replaces it. A failed record is swallowed: the page has a post to show,
 * and an error banner about a counter would be noise.
 */
export function useRecordView(post: Post | null): number | null {
  const slug = post?.slug ?? null;
  const [recorded, setRecorded] = useState<number | null>(null);

  useEffect(() => {
    setRecorded(null);
    if (!slug) return;
    if (alreadyCounted(slug)) return;

    // Written before the request is even sent, so React's double-invoked effect
    // in development -- and a fast remount -- cannot count the same read twice.
    remember(slug);

    // Not cancelled on unmount, unlike every other request in this app: the
    // read already happened, so navigating away mid-flight should still count
    // it. Only the state update is skipped, since there is nothing left to
    // render it into.
    let live = true;
    recordPostView(slug)
      .then((total) => {
        if (live) setRecorded(total);
      })
      .catch(() => {
        // A counter that failed to increment is not worth telling anyone about.
      });

    return () => {
      live = false;
    };
  }, [slug]);

  return recorded ?? post?.view_count ?? null;
}
