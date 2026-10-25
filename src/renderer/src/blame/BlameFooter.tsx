import { Button } from 'react-aria-components'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Tip } from '../components/Tip'
import { fullDate, relativeTime } from '../lib/format'
import type { BlameCommit } from '../../../shared/blame'

interface Props {
  /** A short message that replaces the commit summary for a few seconds. */
  note: string | null
  commit: BlameCommit | undefined
  /** The cursor line was named by skipping an ignored commit. */
  ignored: boolean
  messageOpen: boolean
  onToggleMessage: () => void
}

/** The fixed-height row under the code: the cursor line's commit, or a note. The row is a button that opens the full message. */
export function BlameFooter({ note, commit, ignored, messageOpen, onToggleMessage }: Props) {
  return (
    <div className="blame-preview" aria-live="polite">
      {note ? (
        <span className="blame-note">{note}</span>
      ) : (
        commit && (
          <>
            <Tip label="Show the full commit message" keys="Space" placement="top">
              <Button className="blame-preview-button" aria-expanded={messageOpen} onPress={onToggleMessage}>
                {commit.uncommitted ? (
                  <span className="blame-uncommitted">Not committed yet. Enter shows the working changes.</span>
                ) : (
                  <>
                    <Avatar name={commit.author} email={commit.email} size={16} />
                    <span className="blame-author">{commit.author}</span>
                    <span className="blame-date" title={fullDate(commit.time * 1000)}>
                      {relativeTime(commit.time * 1000)}
                    </span>
                    <span className="blame-hash">{commit.hash.slice(0, 8)}</span>
                    <span className="blame-summary">{commit.summary}</span>
                    {ignored && <span className="blame-ignored">Skipped an ignored commit</span>}
                    <span className="blame-preview-hint" aria-hidden="true">
                      <Icon name="info" size={14} />
                      <kbd>Space</kbd>
                    </span>
                  </>
                )}
              </Button>
            </Tip>
            <span className="blame-preview-hint blame-preview-step" aria-hidden="true">
              {commit.boundary ? (
                'First version'
              ) : (
                <>
                  <kbd>B</kbd>
                  {commit.uncommitted ? 'at HEAD' : 'earlier'}
                </>
              )}
            </span>
          </>
        )
      )}
    </div>
  )
}
