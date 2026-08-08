/**
 * Session login for the admin page, against `myapp/auth.py`.
 *
 * Nothing on the public side of the site imports this: the admin page is the
 * only route that has any use for a logged-in user, so the rest of the app never
 * pays for a session request it would ignore.
 */

import { useCallback, useEffect, useState } from "react";

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
  }, []);

  /** Re-check the session, e.g. after a write came back 403. */
  const recheck = useCallback(() => setAttempt((n) => n + 1), []);

  return { phase, username, error, signIn, signOut, recheck };
}
