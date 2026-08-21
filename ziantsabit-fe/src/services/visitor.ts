/**
 * The browser's own opaque token, used to tell whose reaction is whose.
 *
 * There are no accounts on this site, so a reaction bar that has to answer
 * "did *you* already pick this one" needs something to key on. This is that
 * something: a random string generated once and kept in `localStorage`.
 *
 * **It is not identity and is not meant to be.** It says nothing about who the
 * visitor is, it is never displayed, and defeating it is trivial -- clear site
 * data, or open the post in another browser, and you get another reaction.
 * That is the same bargain the view counter already makes with its
 * `sessionStorage` guard (see `useRecordView`): the alternative is exactly the
 * identification a one-tap emoji is not worth.
 *
 * `localStorage` rather than `sessionStorage`, unlike the view guard, because
 * the two answer different questions. A view should count again tomorrow; a
 * reaction you left should still be *yours* tomorrow, or the bar would offer to
 * add a second one and the count would drift up with every visit.
 */

const STORAGE_KEY = "visitor-token";

function randomToken(): string {
  // randomUUID needs a secure context, which localhost and https both are --
  // but a site opened over plain http on a LAN address is not, and there it is
  // simply undefined rather than throwing. The fallback is not cryptography:
  // it only has to make a collision between two visitors unlikely.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// Read once and kept, so a page rendering the bar twice cannot generate two.
let cached: string | null = null;

/**
 * This browser's token, creating one on first use.
 *
 * Every touch of `localStorage` is guarded: it throws outright in some privacy
 * modes, and a reaction bar is not worth breaking a post page over. When it is
 * unavailable the token still works for the life of the page -- reactions
 * toggle as expected -- and is simply forgotten on reload, which is the honest
 * degradation rather than a broken control.
 */
export function visitorToken(): string {
  if (cached) return cached;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
  } catch {
    // Unreadable; fall through and mint one for this page only.
  }

  const token = randomToken();
  cached = token;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Unwritable. The token lives as long as this page does.
  }
  return token;
}
