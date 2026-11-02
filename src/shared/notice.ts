/**
 * What the app tells the user, and where it shows. A caller says what happened (kind, text,
 * optional buttons); the policy here, not the caller, picks the surface, so the same kind of
 * message looks the same everywhere. Pure, so it is unit tested without a UI.
 */

export type NoticeKind = 'success' | 'info' | 'warning' | 'error'

/** `toast` pops over the app and waits to be read; `bar` is the quiet status strip. */
export type NoticeSurface = 'toast' | 'bar'

/** The facts the policy needs; the renderer's notice carries more (id, buttons' handlers). */
export interface NoticeFacts {
  kind: NoticeKind
  actions?: readonly unknown[]
}

/**
 * Errors and warnings need attention, and buttons (Undo, links) need a target that lasts, so all
 * three are toasts. Plain results and hints are ambient, so they go to the bar. (A running operation is
 * not a notice: the bar reads the repository's busy state itself.)
 */
export function routeNotice(n: NoticeFacts): NoticeSurface {
  if (n.actions && n.actions.length > 0) return 'toast'
  return n.kind === 'error' || n.kind === 'warning' ? 'toast' : 'bar'
}
