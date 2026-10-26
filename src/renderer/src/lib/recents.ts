/** Recently picked ids for a picker, newest first, remembered in localStorage under `key`. */
export function readRecent(key?: string): string[] {
  if (!key) return []
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]')
  } catch {
    return []
  }
}

export function remember(key: string | undefined, id: string) {
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify([id, ...readRecent(key).filter((x) => x !== id)].slice(0, 10)))
  } catch {
    // recents just won't be remembered
  }
}
