/** Where a rebase is: step `current` of `total`. */
export interface RebaseStep {
  current: number
  total: number
}

/**
 * Git keeps a rebase's progress in two small files, named differently by its two backends:
 * `rebase-merge/msgnum` and `end`, or `rebase-apply/next` and `last`. Anything unreadable or odd
 * is not a step, so a half-written file never shows a wrong number.
 */
export function parseRebaseStep(current: string | null, total: string | null): RebaseStep | null {
  if (current === null || total === null) return null
  const c = Number.parseInt(current.trim(), 10)
  const t = Number.parseInt(total.trim(), 10)
  if (!Number.isInteger(c) || !Number.isInteger(t) || c < 1 || t < 1 || c > t) return null
  return { current: c, total: t }
}
