/**
 * Writes against `/api/pages/`, for the admin editors only.
 *
 * Mirrors `adminPosts.ts` / `adminBooks.ts`: the read here goes through
 * `apiRequest` too, so the editor and the public page cannot end up looking at
 * different things through different clients.
 *
 * There is no create and no delete, because the API has neither -- the two
 * pages are fixed. So a "draft" of a page does not exist either: unlike a post,
 * a page has no second copy to preview against and no URL for an unpublished
 * one to live at, which is why these editors have a Save button and no publish
 * control.
 */

import { apiRequest } from "./api";
import type { WriteOptions } from "./adminPosts";
import type { PageContent, PageData, PageKey } from "./pages";

export async function fetchAdminPage<K extends PageKey>(
  key: K,
  signal?: AbortSignal,
): Promise<PageContent<K>> {
  return apiRequest<PageContent<K>>(`/pages/${key}/`, { signal });
}

/**
 * Save one page's content.
 *
 * A PATCH carrying the whole document rather than a PUT: `key` and
 * `updated_at` are read-only, so a PUT would be sending two fields the server
 * ignores in order to say the same thing.
 */
export async function savePage<K extends PageKey>(
  key: K,
  data: PageData[K],
  options: WriteOptions = {},
): Promise<PageContent<K>> {
  return apiRequest<PageContent<K>>(`/pages/${key}/`, {
    method: "PATCH",
    body: { data },
    keepalive: options.keepalive,
  });
}
