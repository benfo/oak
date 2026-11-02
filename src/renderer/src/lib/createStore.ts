/** A tiny external store for `useSyncExternalStore`. */
export function createStore<T>(initial: T) {
  let value = initial
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      value = next
      subs.forEach((s) => s())
    },
    subscribe(s: () => void) {
      subs.add(s)
      return () => {
        subs.delete(s)
      }
    }
  }
}
