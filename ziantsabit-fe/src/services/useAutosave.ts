import { useCallback, useEffect, useRef, useState } from "react";

/**
 * What the form is currently doing about the changes in it.
 *
 * `clean` covers both "nothing typed yet" and "everything typed is saved"; the
 * indicator tells them apart by whether a save has ever reported a time.
 */
export type AutosaveState =
  | { phase: "clean" }
  | { phase: "dirty" }
  | { phase: "saving" }
  | { phase: "saved"; at: number }
  | { phase: "failed"; message: string };

/**
 * How long the form has to sit still before a save goes out.
 *
 * Idle time, not an interval: every keystroke restarts it, so a burst of typing
 * costs one request rather than one per second. Three seconds is long enough
 * that a title is usually finished being typed before the post it names is
 * created, and short enough that a crash costs a sentence at most.
 */
export const AUTOSAVE_DELAY_MS = 3000;

/** How long to wait before retrying when the timer fires mid-save. */
const BUSY_RETRY_MS = 250;

/** Why a save is going out, which decides how it is sent. */
type Trigger =
  | /** The idle timer elapsed. Defers to a save already in flight. */ "idle"
  | /** Ctrl+S. Same write as the timer's, just not waiting for it. */ "now"
  | /** The page is going away. Cannot wait, and cannot assume a document. */ "exit";

/** Extra instructions for the write, decided by what triggered it. */
export interface SaveOptions {
  /**
   * Send the request so it survives the document being destroyed.
   *
   * True only on the exit path. On every other save it would buy nothing and
   * spend the browser's shared 64 KiB keepalive budget.
   */
  keepalive: boolean;
}

interface Options<T> {
  /** The live form value. Compared by JSON, so a new object with identical
   *  contents is correctly not a change. */
  value: T;
  /**
   * Whether autosave should be running at all -- false while the form is still
   * loading, while a manual save is in flight, and while the value is not yet
   * savable (a post with no title is a 400, not a draft).
   *
   * Whatever is on screen when this flips to true becomes the baseline, so
   * loading a post into the form is never mistaken for editing it.
   */
  enabled: boolean;
  /** Performs the write. Never called with a value equal to the last one saved. */
  save: (value: T, options: SaveOptions) => Promise<unknown>;
  /** Told about a failed write before it is turned into a message -- the pages
   *  use it to notice a 403 and re-check the session. */
  onError?: (failure: unknown) => void;
  delayMs?: number;
}

/**
 * Saves a form in the background once it has been sitting still for a moment.
 *
 * Deliberately not abortable. The write is the whole point, so leaving flushes
 * what is pending rather than cancelling it -- the same reasoning as
 * `useRecordView`, where the thing being recorded has already happened. Only
 * the state update is skipped once the component is gone.
 *
 * "Leaving" is several different events and an unmount is only one of them: a
 * closed tab, a reload, or a link to another site tears the document down
 * without React running a single cleanup. See the exit effect below.
 */
export function useAutosave<T>({
  value,
  enabled,
  save,
  onError,
  delayMs = AUTOSAVE_DELAY_MS,
}: Options<T>): AutosaveState {
  const [state, setState] = useState<AutosaveState>({ phase: "clean" });

  const fingerprint = JSON.stringify(value);

  // What the server was last told. A string rather than the object, so the
  // comparison does not depend on the form handing back the same reference.
  const savedRef = useRef(fingerprint);
  const wasEnabled = useRef(enabled);
  const mounted = useRef(true);
  // A count rather than a flag: the exit path starts a save without waiting for
  // one already running, and a flag would be cleared by whichever finished
  // first, reporting the other as done.
  const inFlight = useRef(0);

  // Read by the timer and by the unmount flush, both of which run long after
  // the render that last set them.
  const valueRef = useRef(value);
  valueRef.current = value;
  const fingerprintRef = useRef(fingerprint);
  fingerprintRef.current = fingerprint;
  const saveRef = useRef(save);
  saveRef.current = save;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const flush = useCallback(async (trigger: Trigger = "idle") => {
    // Nothing to send. Worth checking here and not only at each call site: an
    // exit flush leaves the idle timer armed behind it, and this is what stops
    // that timer from writing the same value a second time.
    if (fingerprintRef.current === savedRef.current) return;

    // A save is already going out; the timer re-arms and tries again. The exit
    // path has no later attempt to defer to, so it goes anyway and the page's
    // write queue is what keeps the two in order.
    if (inFlight.current > 0 && trigger !== "exit") return;

    const snapshot = valueRef.current;
    const stamp = fingerprintRef.current;
    inFlight.current += 1;
    if (mounted.current) setState({ phase: "saving" });

    try {
      await saveRef.current(snapshot, { keepalive: trigger === "exit" });
      // The value that was *sent*, not what came back: the API trims tags and
      // fills in a slug, and baselining against its answer would leave the
      // form looking permanently unsaved.
      savedRef.current = stamp;
      if (mounted.current) setState({ phase: "saved", at: Date.now() });
    } catch (failure: unknown) {
      onErrorRef.current?.(failure);
      if (mounted.current) {
        setState({
          phase: "failed",
          message:
            failure instanceof Error ? failure.message : "Could not autosave.",
        });
      }
    } finally {
      inFlight.current -= 1;
    }
  }, []);

  // Re-baseline whenever autosave is off, and on the render that turns it on.
  // Without the second half, a post arriving from the API would read as an
  // edit and be saved straight back over itself; without the first, a manual
  // save's own changes would be autosaved again on its way out.
  //
  // The cost is that a manual save which *failed* leaves the form looking
  // clean, so nothing is retried until the next keystroke. That is the error
  // alert's job to report, and it is the same amount of saving the page did
  // before autosave existed.
  useEffect(() => {
    if (!enabled || !wasEnabled.current) {
      savedRef.current = fingerprint;
      setState((prev) => (prev.phase === "dirty" ? { phase: "clean" } : prev));
    }
    wasEnabled.current = enabled;
  }, [enabled, fingerprint]);

  // Declared after the baseline effect on purpose: effects run in order within
  // a commit, so this one reads a `savedRef` that is already current.
  useEffect(() => {
    if (!enabled || fingerprint === savedRef.current) return;

    // Same object when already dirty, so React bails out of the re-render
    // rather than one landing per keystroke.
    setState((prev) => (prev.phase === "dirty" ? prev : { phase: "dirty" }));

    let timer = setTimeout(function attempt() {
      if (inFlight.current > 0) {
        timer = setTimeout(attempt, BUSY_RETRY_MS);
        return;
      }
      void flush();
    }, delayMs);

    return () => clearTimeout(timer);
  }, [fingerprint, enabled, delayMs, flush]);

  /**
   * Flush when the document itself is going away.
   *
   * The unmount below covers a click on a link inside the app, and nothing
   * else: closing the tab, reloading, or navigating off-site destroys the
   * document without React running a cleanup, so up to `delayMs` of typing
   * used to go with it -- the one case autosave existed to prevent.
   *
   * Two events, because neither is reliable alone. `pagehide` is the one that
   * means "this document is being torn down", and it fires for a bfcache
   * navigation too, where `unload` does not. But a backgrounded tab can be
   * discarded on mobile without any unload-family event ever firing, and
   * `visibilitychange` to `hidden` is the last thing guaranteed to run before
   * that. Whichever arrives first does the write; the other finds the
   * fingerprint already saved and returns.
   *
   * Flushing on `hidden` also means switching tabs saves, which is a
   * side effect worth having rather than one to work around.
   */
  useEffect(() => {
    const leave = () => {
      if (enabledRef.current) void flush("exit");
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") leave();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
    };
  }, [flush]);

  /**
   * Ctrl+S (Cmd+S) writes what is on screen now instead of waiting out the
   * timer, and stays on the page.
   *
   * Deliberately not the same thing as the Save buttons, which write *and*
   * navigate back to the console: the reflex this key serves is "keep what I
   * have written and let me carry on", so it saves exactly what autosave would
   * have -- a draft on the new-post page, the post's existing status on the
   * edit page. Neither can publish or unpublish, which stays a button's job.
   *
   * Bound on the window rather than on the body textarea, so it also works
   * from the title, the tags field and the full-screen editor. Since the hook
   * is only ever mounted by the two editor pages, that is the whole scope.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s") return;
      // Shift and Alt are other browsers' shortcuts (Firefox's screenshot tool
      // among them), so only the bare combination is ours to take.
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;

      // Before any decision about whether there is something to write: the
      // reason for catching the key at all is that "Save page as..." is never
      // what someone editing a post meant by it, and that dialog would block
      // the tab whether or not the form happened to be dirty.
      event.preventDefault();
      if (event.repeat) return;

      // A no-op when the form is clean or not yet savable. `flush` reports the
      // rest: "Saving..." then a time, or the failure. Held-down keys aside,
      // pressing it during a save is fine too -- that save is already carrying
      // the value, and the idle timer re-arms for anything typed since.
      if (enabledRef.current) void flush("now");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flush]);

  useEffect(() => {
    // Set here rather than only at declaration, because React's development
    // double-mount tears the first one down and this ref would stay false.
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Leaving the page is exactly when the last few seconds of typing would
      // otherwise be lost, so it is the one moment worth not waiting out.
      if (enabledRef.current) void flush("exit");
    };
  }, [flush]);

  return state;
}
