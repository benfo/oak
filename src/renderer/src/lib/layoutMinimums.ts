/**
 * The smallest each side-by-side pane may get, in CSS px: one place so the splits, their nested splits and the zoom limit
 * agree. The content pane (diff, preview, commit details) is the one that must stay usable, so the others give way first.
 */
export const SIDEBAR_MIN = 180
export const FILES_MIN = 260
export const CONTENT_MIN = 320
/** Height the commit details (message, file list, diff) keep under the history graph, so they are never squeezed to a header. */
export const DETAILS_MIN = 280
/** Room for the dividers between the three panes. */
const DIVIDERS = 24

/** Below this width the three panes cannot all keep their minimums. */
export const MIN_LAYOUT_WIDTH = SIDEBAR_MIN + FILES_MIN + CONTENT_MIN + DIVIDERS

/**
 * The zoom that keeps the layout at least `MIN_LAYOUT_WIDTH` wide: zooming in shrinks the width the page sees, so a
 * small window can't take the largest steps. `viewportWidth` is what the page sees now, at `appliedZoom`.
 */
export function zoomThatFits(requested: number, viewportWidth: number, appliedZoom: number): number {
  const windowWidth = viewportWidth * appliedZoom
  return Math.min(requested, windowWidth / MIN_LAYOUT_WIDTH)
}
