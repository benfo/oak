/** Added and deleted lines per path, keyed by the new path of a rename; null for a binary file. */
export type LineCounts = Map<string, { additions: number | null; deletions: number | null }>

/** Reads `git diff --numstat -z` (or `diff-tree`): a rename's entry has an empty path, then its old and new paths. */
export function parseNumstat(out: string): LineCounts {
  const tokens = out.split('\0')
  const counts: LineCounts = new Map()
  for (let i = 0; i < tokens.length;) {
    const [a, d, p] = tokens[i++].split('\t')
    if (p === undefined) continue
    let path = p
    if (p === '') {
      i++ // old path of a rename
      path = tokens[i++]
    }
    counts.set(path, { additions: a === '-' ? null : Number(a), deletions: d === '-' ? null : Number(d) })
  }
  return counts
}
