/**
 * What `Admin.tsx` hands its nested routes (the post list, the new-post page)
 * via `<Outlet context={...} />`, once a session is confirmed signed-in.
 *
 * Session-checking itself only ever needs to happen once, in `Admin.tsx`; a
 * nested route just needs to react to a write coming back 403.
 */
export interface AdminOutletContext {
  username: string | null;
  onSignOut: () => void;
  onSessionSuspect: () => void;
}
