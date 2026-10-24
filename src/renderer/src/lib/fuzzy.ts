// The only module that knows which fuzzy-matching library is in use (currently fuzzysort).
// Replacing the library means reimplementing these three functions; callers depend on nothing else.
import fuzzysort from 'fuzzysort'

/** Text prepared once (per picker) so each keystroke only scores. Opaque to callers. */
export type FuzzyTarget = ReturnType<typeof fuzzysort.prepare>

export const prepareFuzzy = (text: string): FuzzyTarget => fuzzysort.prepare(text)

/**
 * Entries whose target matches the query, best first, at most `limit`.
 * Scores are higher for better matches; only their order and relative size are meaningful.
 * A null target never matches. Several space-separated terms must all match.
 */
export function rankFuzzy<T>(query: string, entries: readonly T[], target: (entry: T) => FuzzyTarget | null, limit: number) {
  const prepared = entries.map((entry) => ({ entry, target: target(entry) })).filter((e) => e.target)
  return fuzzysort.go(query, prepared, { key: 'target', limit }).map((r) => ({ entry: r.obj.entry, score: r.score }))
}

/** Character positions of `text` that the query matched, for highlighting. */
export const fuzzyPositions = (query: string, text: string): Set<number> => new Set(fuzzysort.single(query, text)?.indexes ?? [])
