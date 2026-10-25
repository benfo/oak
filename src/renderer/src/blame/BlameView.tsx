import { useEffect, useMemo, useRef, useState } from 'react'
import { errorMessage, showMenu } from '../api'
import { PaneFrame } from '../components/Pane'
import { useFileTokens } from '../diff/highlight'
import { copyText } from '../lib/copy'
import { widgetAction } from '../lib/keymap'
import { canHandleNavigation, horizontalScrollDirection, movementDelta, toolbarHomeEnd } from '../lib/navigation'
import { shortcutPlatform } from '../lib/shortcuts'
import { useFindInFile } from '../lib/useFindInFile'
import { usePane } from '../lib/usePane'
import { useVirtualRows } from '../lib/useVirtualRows'
import { useSettings } from '../settings'
import { BlameVersion, type BlameStep } from './BlameVersion'
import { CommitMessage } from './CommitMessage'
import { CommitPopover } from './CommitPopover'
import { adjacentBlockStart, blameBlockStarts, type BlameLine } from '../../../shared/blame'
import { BlameFind } from './BlameFind'
import { BlameFooter } from './BlameFooter'
import { BlameRow } from './BlameRow'
import { BlameToolbar } from './BlameToolbar'
import { stepBefore } from './stepBefore'
import { useBlameData } from './useBlameData'
import { useCommitPopover } from './useCommitPopover'

/** Keep in sync with --diff-line-height. */
const ROW_H = 20
const NOTE_MS = 3500
/** A stable empty list, so find does not recompute while nothing is loaded. */
const NO_LINES: BlameLine[] = []
/** Pixels a plain Left or Right scrolls the code; Shift scrolls a quarter of the pane. */
const H_STEP = 40

/** A file and a line (in the commit's version of it) that History should open on. */
export interface CommitTarget {
  file: string
  line: number
}

export interface BlameRequest {
  file: string
  /** A commit to blame at, or null for the working tree. */
  rev: string | null
  n: number
}

interface Props {
  repo: string
  request: BlameRequest
  /** Working-tree blame reloads when these change; a commit's blame never does. */
  status: unknown
  contentRevision: number
  /** Whether the Blame view is showing; a hidden view loses its scroll position, so it is put back on return. */
  active: boolean
  /** Enter on a line: show its commit (null for lines that are not committed yet) at the file and line it changed. */
  onOpenCommit: (hash: string | null, target: CommitTarget) => void
  onClose: () => void
}

export function BlameView({ repo, request, status, contentRevision, active, onOpenCommit, onClose }: Props) {
  const { vimNavigation, syntaxHighlighting, showWhitespace: whitespace } = useSettings()
  // Stepping back replaces the version shown; the steps are dropped with the view, so closing starts afresh.
  const [steps, setSteps] = useState<BlameStep[]>([])
  const stepping = useRef(false)
  /** A short message in the footer, which is where the eye already is; it clears itself. */
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    if (!note) return
    const timer = setTimeout(() => setNote(null), NOTE_MS)
    return () => clearTimeout(timer)
  }, [note])
  const past = steps[steps.length - 1]
  const file = past ? past.file : request.file
  const rev = past ? past.rev : request.rev
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  // On by default, as it always was.
  const [useIgnoreRevs, setUseIgnoreRevs] = useState(true)
  const [cursor, setCursor] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  const pane = usePane('blame', { kind: 'diff' })

  useEffect(() => toolbarHomeEnd(toolsRef.current), [])
  useEffect(() => ref.current?.focus({ preventScroll: true }), [])

  const { result, error, loading, slow, hasIgnoreRevs } = useBlameData({
    repo,
    file,
    rev,
    ignoreWhitespace,
    useIgnoreRevs,
    status,
    contentRevision
  })
  const lines = result?.lines ?? NO_LINES

  // The whole file is tokenized as one block, so a line that starts mid-construct is still coloured right.
  const text = useMemo(() => (result?.lines.length ? result.lines.map((l) => l.text).join('\n') : null), [result])
  const tokenLines = useFileTokens(file, text, syntaxHighlighting)
  const tokens = tokenLines?.length === lines.length ? tokenLines : null

  const starts = blameBlockStarts(lines)
  const at = Math.max(0, Math.min(lines.length - 1, cursor))
  const line = lines[at]
  const commit = line && result ? result.commits[line.hash] : undefined
  const { open: messageOpen, setOpen: setMessageOpen, anchor, message } = useCommitPopover({ repo, commit, active, scrollerRef: ref })

  // The tint only says something while the commit is a minority of the file; a new file is one commit, and tinting all of it just lowers contrast.
  const tintCommit = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of lines) counts.set(l.hash, (counts.get(l.hash) ?? 0) + 1)
    return line && (counts.get(line.hash) ?? 0) * 2 <= lines.length ? line.hash : null
  }, [result, line?.hash])

  const findInFile = useFindInFile({ lines, at, moveTo: setCursor, scrollerRef: ref })
  const finding = findInFile.query !== null
  // The same actions as N, P and "/", for the header buttons; each button hands focus back so the keys keep working afterwards.
  const nextStart = adjacentBlockStart(starts, at, 1)
  const prevStart = adjacentBlockStart(starts, at, -1)
  const moveBlock = (delta: 1 | -1) => {
    const next = delta === 1 ? nextStart : prevStart
    if (next !== null) setCursor(next)
  }
  // A click returns focus to the code so the keys work again; a key press on a button leaves focus there, so Enter can repeat.
  const refocus = (pointer: string) => {
    if (pointer === 'mouse' || pointer === 'touch') ref.current?.focus({ preventScroll: true })
  }

  const rows = useVirtualRows({ count: lines.length, getScrollElement: () => ref.current, estimateSize: () => ROW_H, overscan: 20 })
  // After a step the cursor row goes back to where it sat in the pane, so the eye keeps its place while the line numbers change.
  const keepOffset = useRef<number | null>(null)
  const rememberOffset = () => {
    const row = ref.current?.querySelector('.blame-row.cursor')
    keepOffset.current = row && ref.current ? row.getBoundingClientRect().top - ref.current.getBoundingClientRect().top : null
  }
  useEffect(() => {
    if (!lines.length) return
    const offset = keepOffset.current
    keepOffset.current = null
    if (offset === null) rows.virtual.scrollToIndex(at, { align: 'auto' })
    else rows.virtual.scrollToOffset(Math.max(0, at * ROW_H - offset))
  }, [at, lines.length])

  // The virtualizer measured a zero-size scroller while hidden, so it is re-measured once the view shows again.
  useEffect(() => {
    if (!active) return
    const frame = requestAnimationFrame(() => {
      rows.virtual.measure()
      if (lines.length) rows.virtual.scrollToIndex(at, { align: 'auto' })
    })
    return () => cancelAnimationFrame(frame)
  }, [active])

  // The commit's diff shows the line where that commit put it, which is not where the line sits now.
  const open = (index = at) => {
    const l = lines[index]
    if (!l) return
    if (result?.commits[l.hash]?.uncommitted) onOpenCommit(null, { file, line: index + 1 })
    else onOpenCommit(l.hash, { file: l.file || file, line: l.origLine })
  }

  // The version just before the line's commit, with the cursor on the line's place in it. A line that is not committed steps to HEAD.
  const stepBack = async (index = at) => {
    const l = lines[index]
    const c = l && result?.commits[l.hash]
    if (!l || !c || stepping.current) return
    stepping.current = true
    try {
      const older = await stepBefore(repo, file, l, c, index)
      setNote(older.note)
      if (!older.step) return
      rememberOffset()
      setSteps([...steps, older.step])
      setCursor(older.line!)
    } catch (e) {
      setNote(errorMessage(e))
    } finally {
      stepping.current = false
    }
  }
  const stepNewer = () => {
    if (!past) return
    setNote(null)
    rememberOffset()
    setSteps(steps.slice(0, -1))
    setCursor(past.returnTo)
  }

  // From the keyboard the menu opens under the cursor line; with the mouse, at the pointer and on the line clicked.
  const lineMenu = async (viaKeyboard: boolean, index = at) => {
    const l = lines[index]
    const c = l && result?.commits[l.hash]
    if (!l || !c) return
    const anchor = viaKeyboard ? (ref.current?.querySelector('.blame-row.cursor .gutter') ?? ref.current) : null
    const id = await showMenu(
      [
        { id: 'message', label: 'Show full commit message', enabled: !c.uncommitted },
        { id: 'open', label: c.uncommitted ? 'Show working changes' : 'Show commit in History' },
        {
          id: 'before',
          label: c.uncommitted
            ? 'Blame at HEAD'
            : c.boundary
              ? 'Blame before this commit (no earlier version)'
              : 'Blame before this commit',
          enabled: !c.boundary
        },
        ...(past ? [{ id: 'newer', label: 'Back to newer blame' }] : []),
        { id: 'copyhash', label: 'Copy commit hash', enabled: !c.uncommitted },
        { id: 'copyline', label: 'Copy line' }
      ],
      anchor
    )
    if (id === 'message') setMessageOpen(true)
    else if (id === 'open') open(index)
    else if (id === 'before') void stepBack(index)
    else if (id === 'newer') stepNewer()
    else if (id === 'copyhash') copyText(l.hash, 'commit hash')
    else if (id === 'copyline') copyText(l.text, 'line')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!canHandleNavigation(e)) return
    const widget = widgetAction(e.nativeEvent, 'blame', shortcutPlatform())
    // Left and Right only ever scroll the code; the view is left with Enter (open the commit), the Close button, or the view shortcuts.
    const wide = horizontalScrollDirection(e.nativeEvent, vimNavigation)
    const plain = e.shiftKey || e.ctrlKey || e.metaKey || e.altKey ? 0 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (wide || plain) {
      e.preventDefault()
      const scroller = ref.current
      if (scroller)
        scroller.scrollBy({ left: wide ? wide * Math.max(1, Math.round(scroller.clientWidth / 4)) : plain * H_STEP, behavior: 'instant' })
      return
    }
    // Escape only dismisses what is on top of the code. Leaving the view is never Escape, so a second press cannot lose the place.
    if (widget === 'dismiss') {
      if (messageOpen) {
        e.preventDefault()
        setMessageOpen(false)
      }
      return
    }
    if (!lines.length) return
    const page = Math.max(1, Math.floor((ref.current?.clientHeight ?? 400) / ROW_H) - 2)
    const move = movementDelta(e.key, page, e.nativeEvent)
    if (move !== undefined && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      setCursor(Math.max(0, Math.min(lines.length - 1, at + move)))
    } else if (widget === 'nextBlock' || widget === 'prevBlock') {
      e.preventDefault()
      moveBlock(widget === 'nextBlock' ? 1 : -1)
    } else if (widget === 'commitMessage') {
      e.preventDefault()
      setMessageOpen(!messageOpen)
    } else if (widget === 'find') {
      e.preventDefault()
      findInFile.open()
    } else if (widget === 'blameBefore' || widget === 'blameNewer') {
      // A held key would skip through several versions; each step is a fresh press.
      e.preventDefault()
      if (e.repeat) return
      if (widget === 'blameBefore') void stepBack()
      else stepNewer()
    } else if (widget === 'activate') {
      e.preventDefault()
      open()
    } else if (widget === 'menu') {
      e.preventDefault()
      void lineMenu(true)
    }
  }

  const revision = rev ? rev.slice(0, 8) : 'Working tree'
  const notice =
    error ?? (result?.binary ? 'Blame is not available for binary files.' : result && !lines.length ? 'This file is empty.' : null)

  return (
    <div className={`diff-wrap blame-view${past ? ' stepped' : ''}`} {...pane.ownerProps}>
      <div className="diff-title">
        <span className="diff-filename" title={file}>
          {file}
        </span>
        <span className="blame-revision" title={rev ?? undefined}>
          {revision}
        </span>
        <BlameVersion steps={steps} onNewer={stepNewer} />
        <BlameToolbar
          toolsRef={toolsRef}
          commit={commit}
          hasLines={lines.length > 0}
          findOpen={finding}
          canPrevBlock={prevStart !== null}
          canNextBlock={nextStart !== null}
          ignoreWhitespace={ignoreWhitespace}
          hasIgnoreRevs={hasIgnoreRevs}
          useIgnoreRevs={useIgnoreRevs}
          onFind={findInFile.open}
          onBlock={(delta, pointer) => {
            moveBlock(delta)
            refocus(pointer)
          }}
          onStepBack={(pointer) => {
            void stepBack()
            refocus(pointer)
          }}
          onIgnoreWhitespace={() => setIgnoreWhitespace(!ignoreWhitespace)}
          onUseIgnoreRevs={() => setUseIgnoreRevs(!useIgnoreRevs)}
          onClose={onClose}
        />
      </div>
      {findInFile.query !== null && (
        <BlameFind
          query={findInFile.query}
          status={findInFile.status}
          inputRef={findInFile.inputRef}
          onChange={findInFile.change}
          onEnter={findInFile.enter}
          onClose={findInFile.close}
        />
      )}
      <PaneFrame>
        <div
          ref={ref}
          className={`diff blame${notice || loading ? ' diff-empty' : ''}${finding ? ' finding' : ''}`}
          tabIndex={0}
          aria-label={`Blame of ${file}`}
          {...pane.targetProps}
          {...pane.resetProps}
          onKeyDown={onKeyDown}
          onKeyDownCapture={(e) => pane.navigate(e)}
          onBlur={(e) => {
            const to = e.relatedTarget as Element | null
            if (to && !to.closest('.blame-preview')) setMessageOpen(false)
          }}
          onContextMenu={(e) => {
            if (!lines.length) return
            e.preventDefault()
            void lineMenu(false)
          }}
        >
          {loading ? (
            slow && (
              <span className="blame-loading">
                <span className="spinner" aria-hidden="true" />
                Loading blame…
              </span>
            )
          ) : notice ? (
            notice
          ) : (
            <div className="diff-inner" style={rows.spacer}>
              {rows.items.map(({ index }) => {
                const l = lines[index]
                const found = findInFile.hitsOn(index)
                return (
                  <BlameRow
                    key={index}
                    index={index}
                    line={l}
                    commit={result!.commits[l.hash]}
                    first={index === 0 || lines[index - 1].hash !== l.hash}
                    cursor={index === at}
                    tinted={l.hash === tintCommit}
                    tokens={tokens ? tokens[index] : null}
                    whitespace={whitespace}
                    hits={found.ranges}
                    currentHit={found.current}
                    onSelect={setCursor}
                    onMenu={(i) => void lineMenu(false, i)}
                    onOpen={open}
                  />
                )
              })}
            </div>
          )}
        </div>
      </PaneFrame>
      <BlameFooter
        note={note}
        commit={commit}
        ignored={!!line?.ignored}
        messageOpen={messageOpen}
        onToggleMessage={() => {
          setMessageOpen(!messageOpen)
          ref.current?.focus({ preventScroll: true })
        }}
      />
      {/* One popover that moves with the cursor (it is not remounted per line, which flashed); hidden while the cursor's row is scrolled out of the window. */}
      {messageOpen && commit && anchor && (
        <CommitPopover anchor={anchor} scroller={ref.current}>
          <CommitMessage commit={commit} message={message(commit.hash)} />
        </CommitPopover>
      )}
    </div>
  )
}
