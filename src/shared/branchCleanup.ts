import type { Branch } from './types'
import { chooseCompareTarget } from './compareTarget.ts'

export interface CleanupCandidate {
  name: string
  /** 'merged': the target has every commit. 'gone': the upstream was deleted and `unmerged` commits are not in the target. */
  reason: 'merged' | 'gone'
  unmerged: number
  /** Another worktree, with nothing uncommitted, that has it checked out: it is removed before the branch can go. */
  worktree?: string
}

/** Why a worktree cannot be removed to free its branch; absent from the map when it can. */
export type WorktreeBlock = 'main' | 'locked' | 'changes'

/** A branch worth cleaning up that stays because it is checked out. */
export interface KeptBranch {
  name: string
  /** The worktree that has it checked out; null when it is the branch checked out here. */
  worktree: string | null
  why: WorktreeBlock | 'here'
}

export interface BranchCleanup {
  /** The branch others are measured against (for example `origin/main`); null when the repository has no default branch. */
  target: string | null
  candidates: CleanupCandidate[]
  kept: KeptBranch[]
}

/** One entry of `git worktree list --porcelain`. */
export interface Worktree {
  path: string
  /** Short branch name; null when detached or bare. */
  branch: string | null
  /** The repository's first worktree, which git never removes. */
  main: boolean
  locked: boolean
  /** Its folder is missing, so there is nothing in it to lose. */
  prunable: boolean
}

export function parseWorktrees(out: string): Worktree[] {
  return out
    .split(/\r?\n\r?\n/)
    .map((entry) => entry.split(/\r?\n/).filter(Boolean))
    .filter((lines) => lines[0]?.startsWith('worktree '))
    .map((lines, index) => {
      const value = (key: string) => lines.find((line) => line === key || line.startsWith(`${key} `))
      const branch = value('branch')?.slice('branch refs/heads/'.length)
      return {
        path: lines[0].slice('worktree '.length),
        branch: branch || null,
        main: index === 0,
        locked: value('locked') !== undefined,
        prunable: value('prunable') !== undefined
      }
    })
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

/** Local branches whose work is done with: merged into the target, or left behind by a deleted upstream. Never the target's local copy. */
function finished(branches: Branch[], target: string, merged: ReadonlySet<string>): Branch[] {
  const targetIsRemote = branches.some((b) => b.type === 'remote' && b.name === target)
  const localTarget = targetIsRemote ? target.slice(target.indexOf('/') + 1) : target
  return branches.filter((b) => b.type === 'local' && b.name !== localTarget && (merged.has(b.name) || b.gone))
}

/** Finished branches another worktree has checked out: whether each can go depends on that worktree. */
export const cleanupHeld = (branches: Branch[], target: string, merged: ReadonlySet<string>) =>
  finished(branches, target, merged)
    .filter((b) => !b.current && b.worktree)
    .map((b) => b.name)

/**
 * Finished branches that are safe to offer for deletion. Never the branch checked out here, nor one in a worktree
 * that is `blocked`; one in a worktree that can be removed carries that worktree. Counts are filled in later.
 */
export function cleanupCandidates(
  branches: Branch[],
  target: string,
  merged: ReadonlySet<string>,
  blocked: ReadonlyMap<string, WorktreeBlock>
): CleanupCandidate[] {
  return finished(branches, target, merged)
    .filter((b) => !b.current && !blocked.has(b.name))
    .map((b) => ({
      name: b.name,
      reason: merged.has(b.name) ? 'merged' : 'gone',
      unmerged: 0,
      ...(b.worktree ? { worktree: b.worktree } : {})
    }))
}

/** Finished branches that stay: a gone one checked out here, and any in a worktree that cannot be removed. */
export function cleanupKept(
  branches: Branch[],
  target: string,
  merged: ReadonlySet<string>,
  blocked: ReadonlyMap<string, WorktreeBlock>
): KeptBranch[] {
  return finished(branches, target, merged).flatMap((b): KeptBranch[] => {
    if (b.current) return b.gone ? [{ name: b.name, worktree: null, why: 'here' }] : []
    const why = blocked.get(b.name)
    return why ? [{ name: b.name, worktree: b.worktree ?? null, why }] : []
  })
}

/** What a kept branch's row says about why it stays. */
export function keptNote(kept: KeptBranch): string {
  if (kept.why === 'here') return 'checked out here'
  if (kept.why === 'changes') return `uncommitted changes in ${kept.worktree}`
  if (kept.why === 'locked') return `locked worktree ${kept.worktree}`
  return `checked out in the main worktree ${kept.worktree}`
}

/** What a review row says about why the branch is listed. */
export function cleanupNote(c: CleanupCandidate, target: string): string {
  const why =
    c.reason === 'merged'
      ? `merged into ${target}`
      : `upstream gone, ${c.unmerged} ${c.unmerged === 1 ? 'commit' : 'commits'} not in ${target}`
  return c.worktree ? `${why}, in ${c.worktree}` : why
}
