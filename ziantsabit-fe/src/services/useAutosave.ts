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
  save: (value: T) => Promise<unknown>;
  /** Told about a failed write before it is turned into a message -- the pages
   *  use it to notice a 403 and re-check the session. */
  onError?: (failure: unknown) => void;
  delayMs?: number;
}

/**
 * Saves a form in the background once it has been sitting still for a moment.
 *
 * Deliberately not abortable. The write is the whole point, so an unmount
 * flushes what is pending rather than cancelling it -- the same reasoning as
 * `useRecordView`, where the thing being recorded has already happened. Only
 * the state update is skipped once the component is gone.
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
  const busy = useRef(false);

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

  const flush = useCallback(async (force = false) => {
    // A save is already going out; the timer re-arms and tries again. `force`
    // is the unmount path, where there is no later attempt to defer to and the
    // page's write queue is what keeps the two in order.
    if (busy.current && !force) return;

    const snapshot = valueRef.current;
    const stamp = fingerprintRef.current;
    busy.current = true;
    if (mounted.current) setState({ phase: "saving" });

    try {
      await saveRef.current(snapshot);
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
      busy.current = false;
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
      if (busy.current) {
        timer = setTimeout(attempt, BUSY_RETRY_MS);
        return;
      }
      void flush();
    }, delayMs);

    return () => clearTimeout(timer);
  }, [fingerprint, enabled, delayMs, flush]);

  useEffect(() => {
    // Set here rather than only at declaration, because React's development
    // double-mount tears the first one down and this ref would stay false.
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Leaving the page is exactly when the last few seconds of typing would
      // otherwise be lost, so it is the one moment worth not waiting out.
      if (enabledRef.current && fingerprintRef.current !== savedRef.current) {
        void flush(true);
      }
    };
  }, [flush]);

  return state;
}
