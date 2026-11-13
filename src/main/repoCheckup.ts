import { promises as fs } from 'fs'
import path from 'path'
import { git } from './git.ts'
import { findBranchCleanup } from './branchCleanup.ts'
import { parseCountObjects, type RepoCheckup, type RepoStorage } from '../shared/repoCheckup.ts'

/** A lock younger than this may belong to a git command that is still running. */
const LOCK_STALE_MS = 60_000

export async function repoStorage(repo: string): Promise<RepoStorage> {
  return parseCountObjects(await git(repo, ['count-objects', '-v']))
}

async function hasStaleLock(repo: string) {
  const gitDir = (await git(repo, ['rev-parse', '--absolute-git-dir'])).trim()
  try {
    return Date.now() - (await fs.stat(path.join(gitDir, 'index.lock'))).mtimeMs > LOCK_STALE_MS
  } catch {
    return false
  }
}

/** Everything the check-up reports, read in one go. Changes nothing. */
export async function runCheckup(repo: string): Promise<RepoCheckup> {
  const [cleanup, storage, staleLock] = await Promise.all([findBranchCleanup(repo), repoStorage(repo), hasStaleLock(repo)])
  return { cleanup, storage, staleLock }
}

/** Plain `git gc`: unreachable objects keep git's own grace period, so reflog recovery still works. Returns the storage afterwards. */
export async function compactRepo(repo: string): Promise<RepoStorage> {
  await git(repo, ['gc'])
  return repoStorage(repo)
}
