import { Avatar } from '../components/Avatar'
import { fullDate } from '../lib/format'
import type { BlameCommit } from '../../../shared/blame'

/**
 * What the blame popover shows for a commit. `message` is undefined while it loads and null if it could not be read;
 * either way the subject from the blame output is already there, so nothing blanks.
 */
export function CommitMessage({ commit, message }: { commit: BlameCommit; message: string | null | undefined }) {
  if (commit.uncommitted) return <p className="commit-popover-note">Not committed yet. Enter shows the working changes.</p>
  const [subject, ...rest] = (message || commit.summary).split('\n')
  const body = rest.join('\n').trim()
  return (
    <>
      <div className="commit-popover-head">
        <Avatar name={commit.author} email={commit.email} size={16} />
        <span className="commit-popover-author">{commit.author}</span>
        <span>{fullDate(commit.time * 1000)}</span>
        <code>{commit.hash}</code>
      </div>
      <p className="commit-popover-subject">{subject}</p>
      {body && <pre className="commit-popover-body">{body}</pre>}
      {message === null && <p className="commit-popover-note">The full message could not be loaded.</p>}
    </>
  )
}
