import { git } from './git.ts'
import { listBranches, remoteHead } from './refs.ts'
import {
  cleanupCandidates,
  cleanupHeld,
  cleanupKept,
  cleanupTarget,
  parseWorktrees,
  type BranchCleanup,
  type WorktreeBlock
} from '../shared/branchCleanup.ts'

const HEADS = 'refs/heads/'
/** Windows refuses paths over 260 characters unless git is told to allow them, and dependency folders often have them. */
const LONG_PATHS = ['-c', 'core.longpaths=true']

/** Why each of these branches' worktrees cannot be removed. Uncommitted work is asked of the worktree itself. */
async function blockedWorktrees(repo: string, held: string[]): Promise<Map<string, WorktreeBlock>> {
  const blocked = new Map<string, WorktreeBlock>()
  if (!held.length) return blocked
  const worktrees = parseWorktrees(await git(repo, ['worktree', 'list', '--porcelain']))
  await Promise.all(
    held.map(async (name) => {
      const worktree = worktrees.find((w) => w.branch === name)
      if (!worktree || worktree.main) blocked.set(name, 'main')
      else if (worktree.locked) blocked.set(name, 'locked')
      else if (!worktree.prunable) {
        // A worktree that cannot be read is left alone, like one with changes.
        const changes = await git(worktree.path, [...LONG_PATHS, 'status', '--porcelain']).catch(() => 'unreadable')
        if (changes.trim()) blocked.set(name, 'changes')
      }
    })
  )
  return blocked
}

/** Local branches worth deleting, measured against the default branch. Reads only; nothing is deleted here. */
export async function findBranchCleanup(repo: string): Promise<BranchCleanup> {
  const [branches, head] = await Promise.all([listBranches(repo), remoteHead(repo)])
  const target = cleanupTarget(branches, head)
  if (!target) return { target, candidates: [], kept: [] }

  const mergedOut = await git(repo, ['for-each-ref', '--format=%(refname)', `--merged=${target}`, HEADS])
  const merged = new Set(
    mergedOut
      .split('\n')
      .filter(Boolean)
      .map((ref) => ref.slice(HEADS.length))
  )
  const blocked = await blockedWorktrees(repo, cleanupHeld(branches, target, merged))
  const candidates = cleanupCandidates(branches, target, merged, blocked)
  await Promise.all(
    candidates
      .filter((c) => c.reason === 'gone')
      .map(async (c) => {
        c.unmerged = Number(await git(repo, ['rev-list', '--count', `${target}..${HEADS}${c.name}`]))
      })
  )
  return { target, candidates, kept: cleanupKept(branches, target, merged, blocked) }
}

/** Without force: git itself refuses a worktree that gained uncommitted work or a lock since it was listed. */
export async function removeWorktrees(repo: string, paths: string[]) {
  for (const path of paths) await git(repo, [...LONG_PATHS, 'worktree', 'remove', '--', path])
}

/** Force delete: the caller has shown which of these carry commits found nowhere else. */
export async function deleteBranches(repo: string, names: string[]) {
  if (names.length) await git(repo, ['branch', '-D', '--', ...names])
}
