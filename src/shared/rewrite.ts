import type { Commit, RepoStatus } from './types'

/** Squash keeps every message for the user to edit; fixup keeps only the oldest commit's message. */
export type RewriteMode = 'squash' | 'fixup'

export interface RewritePlan {
  mode: RewriteMode
  /** The commit the rebase starts on top of, or null when the range begins at the root commit. */
  base: string | null
  /** The commits that become one, oldest first. The first is the one whose message fixup keeps. */
  combined: string[]
  /** Every commit the rebase rewrites, oldest first: the combined ones and all above them up to HEAD. */
  affected: string[]
  todo: string[]
}

/** The branch tip before and after a rewrite, so the caller can offer Undo. */
export interface RewriteResult {
  oldHead: string
  newHead: string
}

export type RewriteCheck = { ok: true; plan: RewritePlan } | { ok: false; reason: string }

export interface RewriteInput {
  /** Loaded history, any order; parents are read from each commit. */
  commits: readonly Commit[]
  /** Hashes the user selected, in any order. */
  selection: readonly string[]
  mode: RewriteMode
  head: string | null
  /** No staged, unstaged or conflicted changes. */
  clean: boolean
  /** The list is one file's history: its commits skip the ones between, so their parents are not a chain. */
  filtered?: boolean
}

/** The environment variable naming the file the todo's final step reads the combined message from. */
export const MESSAGE_FILE_ENV = 'OAK_REWRITE_MESSAGE_FILE'

/** Rebase refuses to start over staged, conflicted or modified tracked files, or during another operation; untracked files are fine. */
export function isReadyToRewrite(status: Pick<RepoStatus, 'state' | 'staged' | 'unstaged' | 'conflicted'> | null): boolean {
  return (
    !!status &&
    status.state === 'clean' &&
    !status.staged.length &&
    !status.conflicted.length &&
    status.unstaged.every((f) => f.status === '?')
  )
}

const fail = (reason: string): RewriteCheck => ({ ok: false, reason })

/** HEAD's first-parent line, newest first, as far as the loaded history reaches. */
function firstParentChain(byHash: Map<string, Commit>, head: string): Commit[] {
  const chain: Commit[] = []
  for (let c = byHash.get(head); c; c = c.parents[0] ? byHash.get(c.parents[0]) : undefined) chain.push(c)
  return chain
}

/**
 * Decides whether the selection can be squashed or fixed up and, if so, builds the rebase todo.
 * One commit means "into its previous commit"; several mean "into the oldest of them", and they
 * must be a continuous run on the checked-out branch with no merge commit from there up to HEAD,
 * because rebase would flatten it. Reasons read after "Squash: " or "Fixup: ".
 */
export function planRewrite({ commits, selection, mode, head, clean, filtered }: RewriteInput): RewriteCheck {
  if (!head || selection.length === 0) return fail('no commit selected')
  if (filtered) return fail('not available in a file’s history')
  if (!clean) return fail('commit or stash your changes first')
  const byHash = new Map(commits.map((c) => [c.hash, c]))
  const chain = firstParentChain(byHash, head)
  const position = new Map(chain.map((c, i) => [c.hash, i]))
  const picked = [...new Set(selection)]
  if (picked.some((h) => !position.has(h))) return fail('select commits on the checked-out branch')

  // `chain` is newest first, so the oldest selected commit has the largest index.
  const indexes = picked.map((h) => position.get(h)!)
  const newest = Math.min(...indexes)
  const oldestSelected = Math.max(...indexes)
  if (oldestSelected - newest + 1 !== picked.length) return fail('select a continuous run of commits')

  const intoPrevious = picked.length === 1
  let oldest = oldestSelected
  if (intoPrevious) {
    const parent = chain[oldestSelected].parents[0]
    if (!parent) return fail('there is no previous commit')
    if (!position.has(parent)) return fail('the previous commit is not loaded yet')
    oldest = position.get(parent)!
  }
  if (chain.slice(0, oldest + 1).some((c) => c.parents.length > 1)) return fail('history contains a merge commit')

  const affected = chain
    .slice(0, oldest + 1)
    .reverse()
    .map((c) => c.hash)
  const combinedCount = intoPrevious ? 2 : picked.length
  const combined = affected.slice(0, combinedCount)
  const rest = affected.slice(combinedCount)
  const todo = [
    `pick ${combined[0]}`,
    ...combined.slice(1).map((h) => `fixup ${h}`),
    ...(mode === 'squash' ? [`exec git commit --amend --allow-empty -F "$${MESSAGE_FILE_ENV}"`] : []),
    ...rest.map((h) => `pick ${h}`)
  ]
  return { ok: true, plan: { mode, base: chain[oldest].parents[0] ?? null, combined, affected, todo } }
}

export function combinedMessage(messages: readonly string[]): string {
  return messages
    .map((m) => m.trim())
    .filter(Boolean)
    .join('\n\n')
}
