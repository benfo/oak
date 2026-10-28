/** Marks a ref badge as the target of an open menu until the menu closes. */
export function markBadgeMenu(badge: HTMLElement | null | undefined, menu: Promise<unknown>) {
  if (!badge) return
  badge.dataset.menuOpen = ''
  void menu.finally(() => delete badge.dataset.menuOpen)
}

/** Identifies a badge in the DOM, so a keyboard-opened menu can anchor to it. */
export const refBadgeKey = (ref: { type: string; name: string }) => `${ref.type}:${ref.name}`
