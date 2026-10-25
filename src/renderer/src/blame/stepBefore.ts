import { api } from '../api'
import type { BlameCommit, BlameLine } from '../../../shared/blame'
import type { BlameStep } from './BlameVersion'

/** What stepping back from a line comes to: a note for the footer, and when there is an older version, the step and the cursor's line in it. */
export interface StepBefore {
  note: string | null
  step?: BlameStep
  /** 0-based line to put the cursor on in the older version. */
  line?: number
}

/**
 * The version just before the line's commit. A line that is not committed steps to HEAD.
 * `file` is the blamed file, `index` the line's place in it.
 */
export async function stepBefore(repo: string, file: string, line: BlameLine, commit: BlameCommit, index: number): Promise<StepBefore> {
  if (commit.boundary) return { note: 'No earlier version: this is the first version of the file.' }
  const older = await api.blameBefore(
    repo,
    commit.uncommitted ? null : line.hash,
    commit.uncommitted ? file : line.file || file,
    commit.uncommitted ? index + 1 : line.origLine
  )
  if (!older) return { note: 'No earlier version: this commit created the file.' }
  return {
    note: older.added ? 'This commit added the line. Showing the nearest line above it.' : null,
    step: {
      file: older.file,
      rev: older.rev,
      before: commit.uncommitted ? null : { hash: commit.hash, summary: commit.summary },
      returnTo: index
    },
    line: older.line - 1
  }
}
