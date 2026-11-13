import type { Branch } from './types'
import { chooseCompareTarget } from './compareTarget.ts'

export interface CleanupCandidate {
  name: string
  /** 'merged': the target has every commit. 'gone': the upstream was deleted and `unmerged` commits are not in the target. */
  reason: 'merged' | 'gone'
  unmerged: number
}

/** A branch with a deleted upstream that git cannot delete while it is checked out. */
export interface KeptBranch {
  name: string
  /** The worktree that has it checked out; null when it is the branch checked out here. */
  worktree: string | null
}

export interface BranchCleanup {
  /** The branch others are measured against (for example `origin/main`); null when the repository has no default branch. */
  target: string | null
  candidates: CleanupCandidate[]
  kept: KeptBranch[]
}

/** The default branch a cleanup measures against: the remote's, else a conventionally named local one. */
export function cleanupTarget(branches: Branch[], remoteHead: string | null): string | null {
  const known = branches.some((b) => b.type === 'remote' && b.name === remoteHead) ? remoteHead : null
  return chooseCompareTarget(
    known,
    branches.filter((b) => b.type === 'local').map((b) => b.name),
    null
  )
}

/**
 * Local branches that are safe to offer for deletion: merged into the target, or left behind by a deleted upstream.
 * Never the target, its local copy, or a branch checked out here or in another worktree. Counts are filled in later.
 */
export function cleanupCandidates(
  branches: Branch[],
  target: string,
  merged: ReadonlySet<string>,
  checkedOut: ReadonlySet<string>
): CleanupCandidate[] {
  const targetIsRemote = branches.some((b) => b.type === 'remote' && b.name === target)
  const localTarget = targetIsRemote ? target.slice(target.indexOf('/') + 1) : target
  return branches
    .filter((b) => b.type === 'local' && !b.current && b.name !== localTarget && !checkedOut.has(b.name))
    .filter((b) => merged.has(b.name) || b.gone)
    .map((b) => ({ name: b.name, reason: merged.has(b.name) ? 'merged' : 'gone', unmerged: 0 }))
}

/** Branches a deleted upstream left behind that stay because they are checked out, here or in another worktree. */
export function cleanupKept(branches: Branch[], worktrees: ReadonlyMap<string, string>): KeptBranch[] {
  return branches
    .filter((b) => b.type === 'local' && b.gone && (b.current || worktrees.has(b.name)))
    .map((b) => ({ name: b.name, worktree: b.current ? null : (worktrees.get(b.name) ?? null) }))
}

/** What a kept branch's row says about why it stays. */
export const keptNote = (kept: KeptBranch) => (kept.worktree ? `checked out in ${kept.worktree}` : 'checked out here')

/** What a review row says about why the branch is listed. */
export function cleanupNote(c: CleanupCandidate, target: string): string {
  if (c.reason === 'merged') return `merged into ${target}`
  return `upstream gone, ${c.unmerged} ${c.unmerged === 1 ? 'commit' : 'commits'} not in ${target}`
}
