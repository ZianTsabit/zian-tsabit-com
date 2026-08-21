/**
 * Client for the emoji bar under a post.
 *
 * Credential-free like the rest of the public API. The `visitor` token is not
 * a credential -- see `visitor.ts` -- it only tells the server which of the
 * counts are this browser's.
 */

import { API_BASE_URL, publicRequest } from "./posts";

/** One button of the bar, mirroring `myapp.serializers.ReactionCountSerializer`. */
export interface ReactionCount {
  emoji: string;
  /** The accessible name, e.g. "Celebrate". Comes from the server rather than
   *  a copy of the list kept here, so the set and its wording live in one
   *  place and adding an emoji is one edit. */
  label: string;
  count: number;
  /** Whether this browser's token has this one. */
  reacted: boolean;
}

/** The whole bar for one post. */
export interface ReactionSummary {
  slug: string;
  /** Every reaction on the post, summed across the emoji currently offered. */
  total: number;
  /** Dense: every emoji the API offers, zeros included, in its order. The
   *  client renders this rather than holding its own list. */
  reactions: ReactionCount[];
}

async function readOrThrow(response: Response): Promise<ReactionSummary> {
  if (!response.ok) {
    throw new Error(
      `The API returned ${response.status} ${response.statusText}.`,
    );
  }
  return (await response.json()) as ReactionSummary;
}

/** The bar as it stands, with `reacted` answered for this browser. */
export async function fetchReactions(
  slug: string,
  visitor: string,
  signal?: AbortSignal,
): Promise<ReactionSummary> {
  const params = new URLSearchParams({ visitor });
  return readOrThrow(
    await publicRequest(
      `${API_BASE_URL}/posts/${encodeURIComponent(slug)}/reactions/?${params}`,
      signal,
    ),
  );
}

/**
 * Add this browser's reaction, or take it away if it is already there, and get
 * the whole bar back.
 *
 * One call for both directions rather than a POST and a DELETE: the button is
 * one control with two meanings, and making the client work out which it is
 * about to do would mean trusting a count that may be seconds stale.
 */
export async function toggleReaction(
  slug: string,
  emoji: string,
  visitor: string,
  signal?: AbortSignal,
): Promise<ReactionSummary> {
  return readOrThrow(
    await publicRequest(
      `${API_BASE_URL}/posts/${encodeURIComponent(slug)}/reactions/`,
      signal,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, visitor }),
      },
    ),
  );
}
