/**
 * Session login for the admin page, against `myapp/auth.py`.
 *
 * The admin page is the only route with any use for a logged-in user, so no
 * public page ever makes a session request it would ignore. `Header` is the one
 * public component importing anything from here, and it takes `useAdminHint` --
 * a localStorage read, not a request -- for exactly that reason.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { ApiError, apiRequest, rememberCsrfToken } from "./api";

/** Mirrors `myapp.auth.SessionStateSerializer`. */
export interface SessionState {
  authenticated: boolean;
  username: string | null;
  csrf_token: string;
}

function adopt(state: SessionState): SessionState {
  // Every one of these three endpoints returns the token that the *next* write
  // has to carry; login and logout rotate it, so this is the only place the
  // cached value should ever come from.
  rememberCsrfToken(state.csrf_token);
  return state;
}

export async function fetchSession(signal?: AbortSignal): Promise<SessionState> {
  return adopt(await apiRequest<SessionState>("/auth/session/", { signal }));
}

export async function login(
  username: string,
  password: string,
): Promise<SessionState> {
  return adopt(
    await apiRequest<SessionState>("/auth/login/", {
      method: "POST",
      body: { username, password },
    }),
  );
}

export async function logout(): Promise<SessionState> {
  return adopt(await apiRequest<SessionState>("/auth/logout/", { method: "POST" }));
}

type Phase = "checking" | "error" | "signed-out" | "signed-in";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Tracks who is logged in, starting from a check on mount so a page reload does
 * not present the login form to someone whose session is still good.
 *
 * `signIn` throws on a bad password rather than storing the message, because the
 * form that called it is where that error belongs.
 */
export function useSession() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [username, setUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped to re-run the check; this is what the retry button drives.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPhase("checking");

    fetchSession(controller.signal)
      .then((state) => {
        setUsername(state.username);
        setPhase(state.authenticated ? "signed-in" : "signed-out");
        setError(null);
        // The header reads this rather than asking the API itself; see
        // `useAdminHint`. Written on the way *out* of a check too, so a session
        // that expired server-side takes the link with it.
        writeAdminHint(state.authenticated);
      })
      .catch((failure: unknown) => {
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setError(message(failure));
        setPhase("error");
      });

    return () => controller.abort();
  }, [attempt]);

  const signIn = useCallback(async (name: string, password: string) => {
    const state = await login(name, password);
    setUsername(state.username);
    setPhase(state.authenticated ? "signed-in" : "signed-out");
    writeAdminHint(state.authenticated);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch (failure: unknown) {
      // The session is gone either way -- an expired one answers this 403 --
      // so the UI should not strand the user on a page they cannot use.
      if (!(failure instanceof ApiError)) throw failure;
    }
    setUsername(null);
    setPhase("signed-out");
    writeAdminHint(false);
  }, []);

  /** Re-check the session, e.g. after a write came back 403. */
  const recheck = useCallback(() => setAttempt((n) => n + 1), []);

  return { phase, username, error, signIn, signOut, recheck };
}

/**
 * The header's "Admin" link, without a session request on every page.
 *
 * `Header` renders on every route, so asking `/auth/session/` from there would
 * put a credentialed round trip on every visitor's first paint to answer a
 * question that is "no" for everyone but the owner -- exactly the cost this
 * module's header comment says the public side does not pay. So the flag is
 * kept in `localStorage` instead: `useSession` writes it whenever it learns
 * whether this browser is signed in, and the header reads it.
 *
 * **It is a hint, not authorisation.** Nothing is unlocked by setting it: every
 * admin route still mounts `Admin`, which checks the real session, and the API
 * refuses an unauthenticated write whatever the browser believes. The worst a
 * forged flag buys is a link to a login form.
 *
 * It can go stale in one direction only -- the cookie expiring server-side
 * while the flag says signed in -- and that heals itself: following the link
 * lands on `/admin`, whose check comes back signed-out and clears the flag on
 * the way to showing the login form.
 */
const ADMIN_HINT_KEY = "admin-session";

// Same-tab updates: `storage` fires in *other* tabs only, so a sign-out here
// would leave this tab's own header advertising a session it just ended.
const hintListeners = new Set<() => void>();

function readAdminHint(): boolean {
  try {
    return localStorage.getItem(ADMIN_HINT_KEY) === "1";
  } catch {
    // Unreadable in some privacy modes. No link is the right degradation: the
    // owner still reaches the page by typing /admin, which is how it worked
    // before this existed.
    return false;
  }
}

function writeAdminHint(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(ADMIN_HINT_KEY, "1");
    else localStorage.removeItem(ADMIN_HINT_KEY);
  } catch {
    // Unwritable; the header simply never offers the link.
  }
  hintListeners.forEach((notify) => notify());
}

function subscribeAdminHint(notify: () => void): () => void {
  hintListeners.add(notify);
  // Signing out in one tab should take the link out of the others too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ADMIN_HINT_KEY) notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    hintListeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether this browser has signed in, for chrome that adapts to the owner. */
export function useAdminHint(): boolean {
  return useSyncExternalStore(subscribeAdminHint, readAdminHint);
}
