/**
 * Credentialed request helper, used by everything behind the admin page.
 *
 * The public read client in `posts.ts` deliberately stays credential-free: a
 * plain `fetch` with no cookies is all a visitor needs, and sending the owner's
 * session on the public pages would quietly start showing drafts there.
 *
 * Two things every write here has to get right:
 *
 * 1. `credentials: "include"`, or the browser drops the session cookie on a
 *    cross-origin request and the API sees an anonymous caller.
 * 2. An `X-CSRFToken` header. The token comes from the API's own response body
 *    rather than the `csrftoken` cookie, because JavaScript on this origin
 *    cannot read a cookie that the API's origin set.
 */

import { API_BASE_URL, isAbort } from "./posts";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Per-field messages from a DRF 400, keyed so a form can hang them off inputs. */
export type FieldErrors = Record<string, string>;

/** A response the API refused, or a request that never arrived. */
export class ApiError extends Error {
  /** 0 when the request never reached the server. */
  readonly status: number;
  readonly fieldErrors: FieldErrors;

  constructor(message: string, status: number, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// Cached for the lifetime of the page. A reload starts empty and the admin page
// re-fetches it on mount anyway, as part of asking whether it is still logged in.
let csrfToken: string | null = null;

/** Store the token an auth response handed back. */
export function rememberCsrfToken(token: string): void {
  csrfToken = token;
}

/** Ask the API for a token, priming the matching cookie as a side effect. */
async function refreshCsrfToken(signal?: AbortSignal): Promise<string> {
  const state = await apiRequest<{ csrf_token: string }>("/auth/session/", {
    signal,
  });
  rememberCsrfToken(state.csrf_token);
  return state.csrf_token;
}

function url(pathOrUrl: string): string {
  // DRF returns its pagination `next` link absolute, so it arrives here whole.
  return /^https?:\/\//.test(pathOrUrl)
    ? pathOrUrl
    : `${API_BASE_URL}${pathOrUrl}`;
}

async function readBody(response: Response): Promise<unknown> {
  // 204 on DELETE, and an error page is not always JSON.
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value.filter((item): item is string => typeof item === "string");
    return parts.length ? parts.join(" ") : null;
  }
  return null;
}

/**
 * Turn a DRF error body into one headline message plus per-field messages.
 *
 * DRF answers a failed write in two shapes: `{"detail": "..."}` for auth and
 * permission problems, and `{"field": ["...", "..."]}` for validation. Both end
 * up in front of the user, so both have to read as English.
 */
function describe(
  status: number,
  body: unknown,
): { message: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};

  if (body && typeof body === "object" && !Array.isArray(body)) {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      const text = textOf(value);
      if (text) fieldErrors[key] = text;
    }

    // Not tied to an input, so it becomes the headline instead.
    for (const key of ["detail", "non_field_errors"]) {
      const text = fieldErrors[key];
      if (text) {
        delete fieldErrors[key];
        return { message: text, fieldErrors };
      }
    }

    const [field, text] = Object.entries(fieldErrors)[0] ?? [];
    if (field && text) return { message: `${field}: ${text}`, fieldErrors };
  }

  return { message: `The API returned ${status}.`, fieldErrors };
}

interface RequestOptions {
  method?: string;
  /** Serialised as JSON, unless it is `FormData` -- which is sent as-is, for
   *  the one endpoint that takes a file. Omit for GET and DELETE. */
  body?: unknown;
  signal?: AbortSignal;
  /**
   * Let the request outlive the page that started it.
   *
   * For a write issued while the document is going away -- autosave's flush on
   * `pagehide`, where an ordinary `fetch` is cancelled along with the document.
   * Only worth setting where nothing reads the response, since on that path
   * there is no longer anywhere to read it.
   */
  keepalive?: boolean;
}

/**
 * Body size above which the `keepalive` flag is dropped rather than set.
 *
 * The browser rejects a keepalive request outright once the bodies of all
 * in-flight ones exceed 64 KiB, and that rejection would surface as "Autosave
 * failed" on exactly the long posts the flush matters most for. Sending such a
 * body as an ordinary request instead is no worse than not trying: it is the
 * behaviour every write had before keepalive existed. Under the limit for
 * headroom, since a page can have more than one write leaving at once.
 */
const KEEPALIVE_MAX_BYTES = 60_000;

const encoder = new TextEncoder();

async function send(
  pathOrUrl: string,
  { method = "GET", body, signal, keepalive = false }: RequestOptions,
  token: string | null,
): Promise<Response> {
  // FormData sets its own Content-Type, and it has to: the header carries the
  // multipart boundary, which only the browser knows. Naming it here at all --
  // even as "multipart/form-data" -- produces a boundary-less header that
  // Django parses as an empty request.
  const isFormData = body instanceof FormData;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["X-CSRFToken"] = token;

  const payload =
    body === undefined ? undefined : isFormData ? body : JSON.stringify(body);

  try {
    return await fetch(url(pathOrUrl), {
      method,
      headers,
      signal,
      keepalive:
        keepalive &&
        (typeof payload !== "string" ||
          encoder.encode(payload).byteLength <= KEEPALIVE_MAX_BYTES),
      // The session cookie lives on the API's origin, which is not this one.
      credentials: "include",
      body: payload,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    // fetch reports a dead backend and a CORS rejection identically, as the
    // useless "Failed to fetch"; name the likelier cause.
    throw new ApiError(
      `Could not reach the API at ${API_BASE_URL}. Is the backend running?`,
      0,
    );
  }
}

function isCsrfFailure(status: number, body: unknown): boolean {
  if (status !== 403) return false;
  const detail =
    body && typeof body === "object"
      ? textOf((body as Record<string, unknown>).detail)
      : null;
  return Boolean(detail && detail.toUpperCase().includes("CSRF"));
}

/**
 * Send a request with the session cookie attached, returning its parsed body.
 *
 * Throws `ApiError` for anything the API refused, and re-throws an
 * `AbortError` untouched -- a cancelled request is not a failure.
 */
export async function apiRequest<T>(
  pathOrUrl: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const needsToken = UNSAFE_METHODS.has(method);

  // A `keepalive` write depends on this being the cached branch: fetching a
  // token needs its *response*, which a document being torn down will never
  // read. In the admin editor it always is -- the shell asks for the session on
  // mount -- so the flush is one request, not two.
  let token = needsToken
    ? csrfToken ?? (await refreshCsrfToken(options.signal))
    : null;

  let response = await send(pathOrUrl, options, token);
  let body = await readBody(response);

  // One retry with a fresh token: Django rotates the CSRF secret on login and
  // logout, so a token cached before either -- in this tab or another one --
  // is refused exactly once before this recovers.
  if (needsToken && isCsrfFailure(response.status, body)) {
    token = await refreshCsrfToken(options.signal);
    response = await send(pathOrUrl, options, token);
    body = await readBody(response);
  }

  if (!response.ok) {
    const { message, fieldErrors } = describe(response.status, body);
    throw new ApiError(message, response.status, fieldErrors);
  }

  return body as T;
}
