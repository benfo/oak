import { git } from './git.ts'
import { listBranches, remoteHead } from './refs.ts'
import { cleanupCandidates, cleanupKept, cleanupTarget, type BranchCleanup } from '../shared/branchCleanup.ts'

const HEADS = 'refs/heads/'

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
  const candidates = cleanupCandidates(branches, target, merged)
  await Promise.all(
    candidates
      .filter((c) => c.reason === 'gone')
      .map(async (c) => {
        c.unmerged = Number(await git(repo, ['rev-list', '--count', `${target}..${HEADS}${c.name}`]))
      })
  )
  return { target, candidates, kept: cleanupKept(branches) }
}

/** Force delete: the caller has shown which of these carry commits found nowhere else. */
export async function deleteBranches(repo: string, names: string[]) {
  if (names.length) await git(repo, ['branch', '-D', '--', ...names])
}
