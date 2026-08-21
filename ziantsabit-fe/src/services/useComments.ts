import { useCallback, useEffect, useRef, useState } from "react";

import {
  createComment,
  fetchComments,
  type Comment,
  type CommentDraft,
} from "./comments";
import { isAbort, PAGE_SIZE } from "./posts";

type Phase = "loading" | "ready" | "error";

interface State {
  comments: Comment[];
  count: number;
  phase: Phase;
  error: string | null;
}

const INITIAL: State = { comments: [], count: 0, phase: "loading", error: null };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * One post's thread, plus the submit that adds to it.
 *
 * Reading and writing live in one hook rather than two because they share the
 * one thing the page has to get right: a successful post has to make the new
 * comment appear. That is a re-fetch, not a local splice -- the comment the
 * API stored may differ from what was typed (the name is collapsed, the body
 * trimmed), and a thread that showed the draft rather than the stored row
 * would disagree with itself on the next load.
 *
 * `slug` is empty while the post itself is still loading; the effect does
 * nothing until there is one, so the thread does not fetch a URL with a blank
 * filter and get every comment on the site.
 */
export function useComments(slug: string) {
  const [state, setState] = useState<State>(INITIAL);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Set by a successful submit and cleared by the fetch that follows it. A ref
  // rather than state because nothing renders from it -- flipping it must not
  // itself cause a render, or it would re-run the effect it is read inside.
  const jumpToLast = useRef(false);

  // A different post means a different thread, and page 3 of the last one is
  // usually past the end of this one.
  useEffect(() => {
    setPage(1);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setState(INITIAL);

    fetchComments(slug, page, controller.signal)
      .then((result) => {
        setState({
          comments: result.results,
          count: result.count,
          phase: "ready",
          error: null,
        });
        // A comment just landed, and the thread reads oldest first -- so it is
        // on the *last* page, which on a long thread is not the one being
        // shown. Working the page out here rather than in `submit` is what
        // makes it right: the count it needs is the one this response
        // carries, and before the fetch there was no way to know it. Costs a
        // second request only when the thread actually spans pages.
        if (!jumpToLast.current) return;
        jumpToLast.current = false;
        const last = Math.max(1, Math.ceil(result.count / PAGE_SIZE));
        if (last !== page) setPage(last);
      })
      .catch((error: unknown) => {
        // Aborted because the page changed or the component went away.
        if (isAbort(error)) return;
        setState({ comments: [], count: 0, phase: "error", error: message(error) });
      });

    return () => controller.abort();
  }, [slug, page, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  /**
   * Post a comment, then show the thread it landed in.
   *
   * Deliberately **not** aborted on unmount, the same call as `useRecordView`
   * makes: the comment is a write the visitor asked for, and cancelling it
   * because they navigated a moment too early would throw away what they
   * wrote. Only the state updates are skipped.
   *
   * Resolves to whether it worked, so the form knows whether to clear itself.
   */
  const submit = useCallback(
    async (draft: CommentDraft): Promise<boolean> => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        await createComment(draft);
        // Re-fetch, and land the reader on the page their comment is actually
        // on -- see the effect above, which is where the page number can first
        // be known.
        jumpToLast.current = true;
        setAttempt((n) => n + 1);
        return true;
      } catch (error: unknown) {
        setSubmitError(message(error));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const totalPages = Math.max(1, Math.ceil(state.count / PAGE_SIZE));

  return {
    ...state,
    page,
    totalPages,
    setPage,
    reload,
    submit,
    submitting,
    submitError,
    dismissSubmitError: useCallback(() => setSubmitError(null), []),
  };
}
