import { useEffect, useState, type DependencyList } from 'react'

const REFRESH_MS = 30_000

/**
 * A value read from git (or the config) that other programs can change behind Oak's back: read when
 * `deps` change, again every 30 seconds, and again when the window regains focus (after an edit in an
 * editor or a terminal). Null until the first read arrives; a failed read keeps the last value.
 */
export function useRefreshed<T>(read: () => Promise<T>, deps: DependencyList): T | null {
  const [value, setValue] = useState<T | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      read()
        .then((v) => live && setValue(v))
        .catch(() => {})
    load()
    const timer = setInterval(load, REFRESH_MS)
    window.addEventListener('focus', load)
    return () => {
      live = false
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
    // `read` is rebuilt every render; the caller's `deps` say when it would read something different.
  }, deps)
  return value
}
