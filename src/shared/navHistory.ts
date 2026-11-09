/** Back/forward stack of places the user jumped from. Pure and immutable; the caller decides what a place is. */
export type NavHistory<T> = { readonly entries: readonly T[]; readonly index: number }

export const MAX_NAV_ENTRIES = 50

export function emptyNavHistory<T>(): NavHistory<T> {
  return { entries: [], index: -1 }
}

export function currentEntry<T>(h: NavHistory<T>): T | undefined {
  return h.entries[h.index]
}

export const canGoBack = (h: NavHistory<unknown>) => h.index > 0
export const canGoForward = (h: NavHistory<unknown>) => h.index < h.entries.length - 1

/** Records a deliberate jump. Drops the forward entries, and ignores a repeat of the current place. */
export function pushEntry<T>(h: NavHistory<T>, entry: T, same: (a: T, b: T) => boolean): NavHistory<T> {
  const current = currentEntry(h)
  if (current !== undefined && same(current, entry)) return h
  const entries = [...h.entries.slice(0, h.index + 1), entry].slice(-MAX_NAV_ENTRIES)
  return { entries, index: entries.length - 1 }
}

/** Replaces the current entry, so Back returns to where the user left off rather than where they arrived. */
export function updateCurrent<T>(h: NavHistory<T>, entry: T): NavHistory<T> {
  if (h.index < 0) return h
  const entries = h.entries.slice()
  entries[h.index] = entry
  return { entries, index: h.index }
}

/**
 * Moves toward the first (-1) or last (+1) entry, skipping entries that no longer exist.
 * Returns undefined when nothing valid lies in that direction; skipped entries are kept so a later step still sees them.
 */
export function stepHistory<T>(
  h: NavHistory<T>,
  direction: -1 | 1,
  isValid: (entry: T) => boolean
): { history: NavHistory<T>; entry: T } | undefined {
  for (let i = h.index + direction; i >= 0 && i < h.entries.length; i += direction) {
    if (isValid(h.entries[i])) return { history: { entries: h.entries, index: i }, entry: h.entries[i] }
  }
  return undefined
}
