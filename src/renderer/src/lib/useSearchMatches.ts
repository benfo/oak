import { useState } from 'react'
import { nextMatchIndex } from './searchMatches'

/** Boundary feedback expires when the query, results or current position changes. */
export function useSearchMatches(query: string, matches: readonly number[], from: number) {
  const [attempt, setAttempt] = useState<{ query: string; matches: readonly number[]; from: number; backwards: boolean } | null>(null)
  const boundary: 'above' | 'below' | null =
    attempt?.query === query && attempt.matches === matches && attempt.from === from ? (attempt.backwards ? 'above' : 'below') : null
  const next = (backwards: boolean) => {
    const index = nextMatchIndex(matches, from, backwards)
    setAttempt(index === null && matches.length > 0 ? { query, matches, from, backwards } : null)
    return index
  }
  return { next, boundary }
}
