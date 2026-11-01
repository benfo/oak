import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { git } from './git.ts'
import { MESSAGE_FILE_ENV, type RewritePlan, type RewriteResult } from '../shared/rewrite.ts'

const TODO_FILE_ENV = 'OAK_REWRITE_TODO_FILE'
/** Replaces the todo file git hands the sequence editor (as its last argument) with ours. */
const SEQUENCE_EDITOR = `sh -c 'cat "$${TODO_FILE_ENV}" > "$1"' sh`

const headOf = async (repo: string) => (await git(repo, ['rev-parse', 'HEAD'])).trim()
const hasTrackedChanges = async (repo: string) => (await git(repo, ['status', '--porcelain', '--untracked-files=no'])).trim() !== ''

/**
 * Squashes or fixes up the planned commits with a real `git rebase -i`, so hooks, signing and config
 * behave as on the command line. The todo is supplied through the sequence editor, so no editor opens.
 * If git stops anyway (a failing hook, say), the rebase stays in progress for the usual Continue/Abort.
 */
export async function runRewrite(repo: string, plan: RewritePlan, message: string): Promise<RewriteResult> {
  const actual = (await git(repo, ['rev-list', '--reverse', plan.base ? `${plan.base}..HEAD` : 'HEAD'])).split('\n').filter(Boolean)
  // Differs when the branch moved since the plan, or when history has a merge the planner could not see.
  if (actual.join() !== plan.affected.join()) throw new Error('The branch changed since you chose these commits. Select them again.')
  if (await hasTrackedChanges(repo)) throw new Error('Commit or stash your changes first.')
  const oldHead = await headOf(repo)
  // Files, not environment variables: Windows allows 32,767 characters in one, and the todo grows with every commit above the squashed ones.
  const dir = await mkdtemp(join(tmpdir(), 'oak-rewrite-'))
  try {
    const todoFile = join(dir, 'todo')
    const messageFile = join(dir, 'message')
    await Promise.all([writeFile(todoFile, `${plan.todo.join('\n')}\n`), writeFile(messageFile, message)])
    await git(repo, ['rebase', '-i', ...(plan.base ? [plan.base] : ['--root'])], {
      env: { GIT_SEQUENCE_EDITOR: SEQUENCE_EDITOR, [TODO_FILE_ENV]: todoFile, [MESSAGE_FILE_ENV]: messageFile }
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
  return { oldHead, newHead: await headOf(repo) }
}

/** Full messages in the order the hashes are given. The hashes go through stdin: thousands overflow a command line. */
export async function readMessages(repo: string, hashes: string[]): Promise<string[]> {
  const out = await git(repo, ['show', '-s', '--no-walk=unsorted', '--format=%B%x00', '--stdin'], { input: hashes.join('\n') })
  return out
    .split('\0')
    .slice(0, hashes.length)
    .map((m) => m.trim())
}

/** Puts the branch back to where it was before a rewrite, only while it is still the rewrite's result. */
export async function restoreBeforeRewrite(repo: string, result: RewriteResult): Promise<void> {
  if ((await headOf(repo)) !== result.newHead) throw new Error('The branch has changed since, so it can no longer be undone here.')
  if (await hasTrackedChanges(repo)) throw new Error('Commit or stash your changes first.')
  await git(repo, ['reset', '--hard', result.oldHead])
}
