import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";

import type { AdminOutletContext } from "../components/admin/AdminOutletContext";
import { ApiError } from "./api";
import { fetchAdminPage, savePage } from "./adminPages";
import type { PageData, PageKey } from "./pages";
import { isAbort } from "./posts";
import { useAutosave } from "./useAutosave";
import { useWriteQueue } from "./useWriteQueue";

type Phase = "loading" | "ready" | "error";

/**
 * Load, edit and save one editable page, for `AdminCV` and `AdminAbout`.
 *
 * The two editors differ only in which fields they draw, so everything about
 * *saving* one lives here rather than being written twice -- the same reasoning
 * that keeps `useAutosave` and `useWriteQueue` shared between the post and book
 * editors.
 *
 * Simpler than either of those editors in three ways, all for the same reason:
 * a page is a single fixed document rather than one row among many.
 *
 * - **No status and no publish button.** There is no draft copy of a page and
 *   no URL for one to live at, so every save is live. The editors say so on the
 *   page rather than leaving it to be discovered.
 * - **No slug, so nothing a save can rename** -- which is the one thing the post
 *   and book editors have to keep autosave away from.
 * - **Saving does not navigate.** The post editors return to a console listing
 *   the thing they just saved; there is no list of pages to return to, and being
 *   thrown out of the CV every time it saved would be the wrong end of the
 *   trade.
 *
 * Autosave is enabled as soon as the document has loaded: unlike a post, which
 * needs a title before the API will take it, any shape of page is savable --
 * the server normalises it.
 */
export function useAdminPage<K extends PageKey>(key: K) {
  const { onSessionSuspect } = useOutletContext<AdminOutletContext>();
  const enqueue = useWriteQueue();

  const [draft, setDraft] = useState<PageData[K] | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Set by the first edit. The load is not a reset button: if a slow response
  // lands after someone has started typing, what they typed outranks it.
  const touched = useRef(false);

  const suspectSession = useCallback(
    (failure: unknown) => {
      if (failure instanceof ApiError && failure.status === 403) onSessionSuspect();
    },
    [onSessionSuspect],
  );

  useEffect(() => {
    if (phase === "error") return;
    const controller = new AbortController();

    fetchAdminPage(key, controller.signal)
      .then((page) => {
        if (!touched.current) setDraft(page.data);
        setPhase("ready");
      })
      .catch((failure: unknown) => {
        if (isAbort(failure)) return;
        suspectSession(failure);
        setLoadError(
          failure instanceof Error ? failure.message : "Could not load this page.",
        );
        setPhase("error");
      });

    return () => controller.abort();
  }, [key, phase, suspectSession]);

  /** Edit the document. An updater rather than a value, because every field on
   *  these pages is nested -- a bullet lives in an entry inside a section. */
  const update = useCallback((change: (current: PageData[K]) => PageData[K]) => {
    touched.current = true;
    setDraft((current) => (current ? change(current) : current));
  }, []);

  const persist = useCallback(
    (snapshot: PageData[K], keepalive = false) =>
      enqueue(() => savePage(key, snapshot, { keepalive })),
    [enqueue, key],
  );

  const autosave = useAutosave({
    value: draft,
    // Off until the document has arrived, so the API's own copy is what the
    // baseline is taken from and loading a page is never read as editing it.
    enabled: phase === "ready" && !saving && draft !== null,
    save: (snapshot, options) =>
      snapshot ? persist(snapshot, options.keepalive) : Promise.resolve(),
    onError: suspectSession,
  });

  /** Write now, from the Save button. Same request autosave makes. */
  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      await persist(draft);
    } catch (failure: unknown) {
      suspectSession(failure);
      setSaveError(failure instanceof Error ? failure.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }, [draft, persist, suspectSession]);

  const retry = useCallback(() => {
    setLoadError(null);
    setPhase("loading");
  }, []);

  return { draft, phase, loadError, retry, update, save, saving, saveError, autosave };
}
