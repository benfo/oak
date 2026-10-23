/** Find in display order without wrapping. A fresh reverse search starts at the last match. */
export function nextMatchIndex(matches: readonly number[], from: number, backwards: boolean): number | null {
  if (from < 0) return (backwards ? matches.at(-1) : matches[0]) ?? null
  return (backwards ? matches.findLast((index) => index < from) : matches.find((index) => index > from)) ?? null
}
