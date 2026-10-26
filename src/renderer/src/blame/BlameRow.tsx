import { Avatar } from '../components/Avatar'
import type { Span } from '../diff/syntax'
import { fullDate, relativeTime } from '../lib/format'
import type { BlameCommit, BlameLine } from '../../../shared/blame'
import { CodeLine } from '../components/CodeLine'

interface Props {
  index: number
  line: BlameLine
  commit: BlameCommit | undefined
  /** The line starts a run from the same commit, so the gutter names it. */
  first: boolean
  cursor: boolean
  /** The cursor's commit, when it is a minority of the file (see BlameView). */
  tinted: boolean
  tokens: Span[] | null
  whitespace: boolean
  /** The find text's [start, end) offsets in this line, and which of them is the current match (-1: none). */
  hits: readonly [number, number][]
  currentHit: number
  onSelect: (index: number) => void
  onMenu: (index: number) => void
  onOpen: (index: number) => void
}

/** One blamed line: the gutter (number, commit subject, age) and the code. */
export function BlameRow({
  index,
  line,
  commit,
  first,
  cursor,
  tinted,
  tokens,
  whitespace,
  hits,
  currentHit,
  onSelect,
  onMenu,
  onOpen
}: Props) {
  const c = commit
  return (
    <div
      className={`dl blame-row${first ? ' block-start' : ''}${cursor ? ' cursor' : ''}${tinted ? ' same-commit' : ''}${line.ignored ? ' ignored' : ''}${hits.length ? ' found' : ''}`}
      onClick={() => onSelect(index)}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onSelect(index)
        onMenu(index)
      }}
    >
      <span className="gutter" onDoubleClick={() => onOpen(index)}>
        <span className="ln" title={line.ignored ? 'Blame skipped a commit on the ignore-revs list to name this one' : undefined}>
          {index + 1}
        </span>
        <span
          className="blame-info"
          title={first && c && !c.uncommitted ? `${c.summary}\n${c.author}, ${fullDate(c.time * 1000)}, ${c.hash.slice(0, 7)}` : undefined}
        >
          {first &&
            c &&
            (c.uncommitted ? (
              <span className="blame-uncommitted">Not committed yet</span>
            ) : (
              <>
                <Avatar name={c.author} email={c.email} size={16} />
                <span className="blame-summary">{c.summary}</span>
                <span className="blame-date">{relativeTime(c.time * 1000)}</span>
              </>
            ))}
        </span>
      </span>
      <span className="code">
        <CodeLine text={line.text} tokens={tokens} whitespace={whitespace} hits={hits} currentHit={currentHit} />
      </span>
    </div>
  )
}
