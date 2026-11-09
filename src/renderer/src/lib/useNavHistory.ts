import { useCallback, useReducer, useRef } from 'react'
import {
  canGoBack,
  canGoForward,
  emptyNavHistory,
  pushEntry,
  stepHistory,
  updateCurrent,
  type NavHistory
} from '../../../shared/navHistory.ts'

/** Per-repo, in-memory back/forward history. `leaving` is where the user is now, so Back returns to where they left off. */
export function useNavHistory<T>(same: (a: T, b: T) => boolean) {
  const history = useRef<NavHistory<T>>(emptyNavHistory<T>())
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  const set = (next: NavHistory<T>) => {
    history.current = next
    rerender()
  }

  const jump = useCallback(
    (leaving: T, destination: T) => {
      const h = history.current
      const base = h.index < 0 ? pushEntry(h, leaving, same) : updateCurrent(h, leaving)
      set(pushEntry(base, destination, same))
    },
    [same]
  )

  const step = (direction: -1 | 1, leaving: T, isValid: (entry: T) => boolean): T | undefined => {
    const base = updateCurrent(history.current, leaving)
    const result = stepHistory(base, direction, isValid)
    if (!result) return undefined
    set(result.history)
    return result.entry
  }

  return {
    jump,
    step,
    canGoBack: canGoBack(history.current),
    canGoForward: canGoForward(history.current)
  }
}
