/** Marks a ref badge as the target of an open menu until the menu closes. */
export function markBadgeMenu(badge: HTMLElement | null | undefined, menu: Promise<unknown>) {
  if (!badge) return
  badge.dataset.menuOpen = ''
  void menu.finally(() => delete badge.dataset.menuOpen)
}

/** Identifies a badge in the DOM, so a keyboard-opened menu can anchor to it. */
export const refBadgeKey = (ref: { type: string; name: string }) => `${ref.type}:${ref.name}`

/** More badges than this never fit the subject cell, and each one costs a tooltip, so the rest fold into "+N". */
export const MAX_REF_BADGES = 6
const TIP_NAMES = 20

/** The refs to draw as badges and the ones folded into the "+N" chip. The checked-out ref always stays visible. */
export function capRefs<T extends { current?: boolean; type: string }>(refs: T[], max = MAX_REF_BADGES) {
  if (refs.length <= max) return { shown: refs, hidden: [] as T[] }
  const keep = (r: T, i: number) => i < max || r.current || r.type === 'head'
  return { shown: refs.filter(keep), hidden: refs.filter((r, i) => !keep(r, i)) }
}

/** Tooltip text for the "+N" chip: the first names, then how many more. */
export function hiddenRefsLabel(hidden: { name: string }[]) {
  const names = hidden.slice(0, TIP_NAMES).map((r) => r.name)
  const more = hidden.length - names.length
  return more > 0 ? `${names.join(', ')} and ${more} more` : names.join(', ')
}
