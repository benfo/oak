import { git } from './git.ts'
import { parseDetailLines, parseRefLines } from '../shared/refList.ts'
import type { Branch, BranchDetail } from '../shared/types.ts'

const fmt = (...fields: string[]) => `--format=${fields.join('%1f')}`

/**
 * Every branch, remote branch and tag, without the fields that read each ref's object. Each call asks only for what
 * its kind of ref can have (an upstream for local branches, a peeled hash for tags), run side by side.
 */
export async function listBranches(repo: string): Promise<Branch[]> {
  const run = (format: string, pattern: string) => git(repo, ['for-each-ref', '--sort=refname', format, pattern])
  const [heads, remotes, tags] = await Promise.all([
    run(fmt('%(refname)', '%(objectname)', '%(HEAD)', '%(upstream)'), 'refs/heads'),
    run(fmt('%(refname)', '%(objectname)'), 'refs/remotes'),
    run(fmt('%(refname)', '%(objectname)', '%(*objectname)'), 'refs/tags')
  ])
  return parseRefLines(heads, remotes, tags)
}

/** Ahead and behind counts, date and subject per ref: one object read each, so it follows the list. */
export async function branchDetails(repo: string): Promise<Record<string, BranchDetail>> {
  const out = await git(repo, [
    'for-each-ref',
    fmt('%(refname)', '%(upstream:track,nobracket)', '%(creatordate:unix)', '%(contents:subject)'),
    'refs/heads',
    'refs/remotes',
    'refs/tags'
  ])
  return parseDetailLines(out)
}

/** The remote's default branch as `branches` names it (for example `origin/main`), or null when origin/HEAD is unset. */
export async function remoteHead(repo: string): Promise<string | null> {
  return (await git(repo, ['symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD'], { okCodes: [1] })).trim() || null
}
