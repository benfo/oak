import { useRef } from 'react'
import { emptyNavHistory, pushEntry, stepHistory, updateCurrent, type NavHistory } from '../../../shared/navHistory.ts'

/** Per-repo, in-memory back/forward history. `leaving` is where the user is now, so Back returns to where they left off. */
export function useNavHistory<T>(same: (a: T, b: T) => boolean) {
  const history = useRef<NavHistory<T>>(emptyNavHistory<T>())

  const jump = (leaving: T, destination: T) => {
    const h = history.current
    const base = h.index < 0 ? pushEntry(h, leaving, same) : updateCurrent(h, leaving)
    history.current = pushEntry(base, destination, same)
  }

  const step = (direction: -1 | 1, leaving: T, isValid: (entry: T) => boolean): T | undefined => {
    const result = stepHistory(updateCurrent(history.current, leaving), direction, isValid)
    if (!result) return undefined
    history.current = result.history
    return result.entry
  }

  return { jump, step }
}
