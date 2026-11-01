/** The hashes from `a` to `b` inclusive, in list order, or null when either is missing or they are the same commit. */
export function commitsBetween(hashes: readonly string[], a: string, b: string): string[] | null {
  const i = hashes.indexOf(a)
  const j = hashes.indexOf(b)
  if (i < 0 || j < 0 || i === j) return null
  return hashes.slice(Math.min(i, j), Math.max(i, j) + 1)
}
