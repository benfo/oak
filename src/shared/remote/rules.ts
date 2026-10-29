import type { Branch } from '../types.ts'
import type { RemotePageTarget } from './targets.ts'

/*
 * When a page on the remote may be opened or copied. The rule is that a link must never 404: a page
 * for something the remote doesn't have is refused, and a file the remote has only in an older
 * version is linked at that older commit. The git questions are asked through `RemoteFacts`, so the
 * rules here stay pure (and testable); `main/remote.ts` answers them from a real repository.
 */

/** What the rules need to know about a repository's remote branches. */
export interface RemoteFacts {
  /** Whether any remote branch contains the commit. */
  isOnRemote(hash: string): Promise<boolean>
  /** The newest commit in the history of `hash` that a remote branch has; null when none is. */
  newestPushedAncestor(hash: string): Promise<string | null>
  /** The object id of `path` at `hash`; null when that commit has no such path. */
  objectAt(hash: string, path: string): Promise<string | null>
  /** Whether the working copy of `path` differs from HEAD (edited or not tracked). */
  hasLocalEdits(path: string): Promise<boolean>
  /** Whether the remote has a branch with this name. */
  hasRemoteBranch(name: string): Promise<boolean>
}

export type RemotePageDecision = { ok: true; target: RemotePageTarget } | { ok: false; error: string }

const refuse = (error: string): RemotePageDecision => ({ ok: false, error })

/**
 * Decides what to open or copy for `target` on `remote`, with a commit already resolved.
 * `workingCopy` says the file is the one on disk (shown at HEAD), whose local edits no commit has.
 * - A repository page always exists.
 * - A branch needs a remote branch of that name; a commit needs a remote branch that contains it.
 * - A file in a commit the remote lacks falls back to the newest pushed ancestor, if it has the file.
 * - A line link there also needs that older version to equal the one shown, so the line means the same code.
 */
export async function decideRemotePage(
  target: RemotePageTarget,
  remote: string,
  workingCopy: boolean,
  facts: RemoteFacts
): Promise<RemotePageDecision> {
  if (target.kind === 'repo') return { ok: true, target }
  if (target.kind === 'branch')
    return (await facts.hasRemoteBranch(target.name)) ? { ok: true, target } : refuse(`${target.name} isn't on ${remote} yet.`)
  if (await facts.isOnRemote(target.hash)) return { ok: true, target }
  if (target.kind === 'commit') return refuse(`This commit isn't on ${remote} yet, so it has no page.`)

  const base = await facts.newestPushedAncestor(target.hash)
  const pushedObject = base ? await facts.objectAt(base, target.path) : null
  if (!base || !pushedObject) return refuse(`${target.path} isn't on ${remote} yet, so it has no page.`)
  if (target.line) {
    const shown = workingCopy && (await facts.hasLocalEdits(target.path)) ? null : await facts.objectAt(target.hash, target.path)
    if (shown !== pushedObject)
      return refuse(`This version of ${target.path} isn't on ${remote} yet, so a line link could point at different code. Push it first.`)
  }
  return { ok: true, target: { ...target, hash: base } }
}

// ---- Menu rules: what can be known without asking git, so a menu can grey an item and say why. ----

/** The change status of a file that has no page on the remote because it is new (added or not tracked). */
const NEW_FILE_STATUSES = ['A', '?']

/** A new file has no page on the remote until the commit that adds it is pushed (working-tree files are never pushed). */
export function isNewFileNotOnRemote(status: string, where: { working: boolean; commitUnpushed: boolean }): boolean {
  return NEW_FILE_STATUSES.includes(status) && (where.working || where.commitUnpushed)
}

/** A local branch with no live upstream isn't on a remote, so it has no page there. */
export function isBranchNotOnRemote(branch: Pick<Branch, 'type' | 'upstream' | 'gone'>): boolean {
  return branch.type === 'local' && (!branch.upstream || branch.gone)
}
