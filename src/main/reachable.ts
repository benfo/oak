import { git } from './git.ts'

/** Whether a branch, tag, other ref or HEAD still reaches the commit. A commit nothing reaches (after a reset or amend) is gone from History. */
export async function isReachable(repo: string, hash: string): Promise<boolean> {
  try {
    if ((await git(repo, ['for-each-ref', '--count=1', '--contains', hash, '--format=%(refname)'])).trim()) return true
    await git(repo, ['merge-base', '--is-ancestor', hash, 'HEAD'])
    return true
  } catch {
    return false
  }
}
