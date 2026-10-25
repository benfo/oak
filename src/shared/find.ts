/** Where the query occurs in a line, as [start, end) offsets, ignoring case and without overlaps. */
export function findRanges(text: string, query: string): [number, number][] {
  const hay = text.toLowerCase()
  const needle = query.toLowerCase()
  // Lowering the case of a few characters changes their length, which would put the offsets out of step with the text.
  if (!needle || hay.length !== text.length) return []
  const ranges: [number, number][] = []
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) ranges.push([at, at + needle.length])
  return ranges
}

export interface FindHit {
  /** 0-based line. */
  line: number
  /** [start, end) offsets in the line's text. */
  start: number
  end: number
}

/** Every occurrence of the query in the file, in reading order: a line that contains it twice has two. */
export function findHits(lines: readonly { text: string }[], query: string): FindHit[] {
  return lines.flatMap((l, line) => findRanges(l.text, query).map(([start, end]) => ({ line, start, end })))
}

/** The 0-based line a ":120" query names, kept within the file; null when the query is not a line number. */
export function gotoLine(query: string, count: number): number | null {
  const match = /^:\s*(\d+)\s*$/.exec(query)
  if (!match || count < 1) return null
  return Math.min(count, Math.max(1, Number(match[1]))) - 1
}
