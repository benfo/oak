import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { FileDiff } from './diff'
import { resolveDiffLayout } from './diffLayout'
import { usePane } from '../lib/usePane'
import { DiffLineActions } from './DiffLineActions'
import { PaneFrame } from '../components/Pane'
import { Icon } from '../components/Icon'
import { useSettings } from '../settings'
import { noteDiffFocus } from './diffCopy'
import type { DiffActions, DiffSide } from './diffTypes'
import { useDiffRows } from './useDiffRows'
import { useDiffScroll } from './useDiffScroll'
import { useDiffCode } from './useDiffCode'
import { useDiffSelection } from './useDiffSelection'
import { useDiffCopy } from './useDiffCopy'
import { useDiffPane } from './useDiffPane'
import { DiffToolbar } from './DiffToolbar'
import { renderDiffItems } from './DiffItems'
import { SideColumns } from './SideColumns'
import { FindBar } from '../components/FindBar'
import { useDiffFind } from './useDiffFind'
import { useDiffNavigation, useDiffFileNavigation } from './useDiffNavigation'
import { toggleIgnoreWhitespace } from './useIgnoreWhitespace'
import { useDiffDocument } from './useDiffDocument'
import { useDiffCursor } from './useDiffCursor'

export type { DiffActions }

interface Props {
  title?: string
  metadata?: ReactNode
  text: string | null
  loading?: boolean
  emptyText?: ReactNode
  /** Enables hunk and line actions for this diff (null for read-only diffs). */
  actions?: (diff: FileDiff) => DiffActions | null
  /** For diffs without actions: why not, shown above the diff (e.g. a deleted file). */
  readOnlyReason?: (diff: FileDiff) => string | null
  /** Left at the left edge returns focus to the list this diff belongs to. */
  onBack?: () => void
  /** V — switch the changed-files list between list and tree; omit when that list is hidden or not switchable. */
  onSwitchView?: () => void
  files?: { index: number; count: number; onSelect: (index: number) => void }
  /** Whole-file content (a synthetic all-added diff): shown as plain numbered code, without diff markings or tools. */
  plain?: boolean
  /** Put the cursor on the line with this new-side number, scroll to it and focus the diff, then call `onRevealed` (also when there is no such line). */
  revealLine?: number
  onRevealed?: () => void
}

export function DiffView({
  title,
  metadata,
  text,
  loading,
  emptyText = 'Select a file to see its changes',
  actions,
  readOnlyReason,
  onBack,
  onSwitchView,
  files,
  plain = false,
  revealLine,
  onRevealed
}: Props) {
  const { diff, source, displayText, reviewMode } = useDiffDocument(text, plain)
  const acts = diff && actions ? actions(diff) : null
  const notice = diff && !acts && readOnlyReason ? readOnlyReason(diff) : null
  const [showAll, setShowAll] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [side, setSide] = useState<DiffSide>('new')
  const pendingHunk = useRef<number | null>(null)
  const { ref, hadFocus, paneWidth, setPane, setSideColumn } = useDiffPane()

  const { syntaxHighlighting, showWhitespace, diffLayout, vimNavigation } = useSettings()
  const split = !plain && resolveDiffLayout(diffLayout, paneWidth) === 'split'
  const { rows, truncated, sideRows, positions, items, rowItem, posItem, itemRow } = useDiffRows(diff, showAll, split)
  const lineType = rows[cursor] && diff?.hunks[rows[cursor].hunk].lines[rows[cursor].line].type
  const cursorSide = lineType === 'del' ? 'old' : lineType === 'add' ? 'new' : side
  const cursorHunk = rows[cursor]?.hunk ?? 0

  const scroll = useDiffScroll({ ref, diff, split, cursor, cursorSide, rows, items, rowItem, posItem, positions, itemRow })
  const find = useDiffFind(diff, rows, cursor, ref, setCursor, setSide, () => setShowAll(true))
  const codeOf = useDiffCode(diff, displayText, rows, syntaxHighlighting, showWhitespace, find)
  const selection = useDiffSelection({
    diff,
    rows,
    acts,
    ref,
    split,
    positions,
    sideRows,
    cursor,
    cursorSide,
    cursorHunk,
    setCursor,
    setSide
  })
  const { selected } = selection
  const { copySource, showCopyMenu } = useDiffCopy({ diff, rows, cursor, selected, ref })

  useDiffCursor(diff, rows, cursor, setCursor, reviewMode, selection.clear, pendingHunk)

  // Reveal after cursor restoration so a diff reset cannot undo the requested source line.
  useEffect(() => {
    if (revealLine === undefined || !diff) return
    const row = rows.find((r) => diff.hunks[r.hunk].lines[r.line].newNo === revealLine)
    if (!row && truncated && !showAll) return setShowAll(true)
    if (row) {
      setCursor(row.index)
      setSide('new')
      scroll.revealRow(row.index, 'center')
      ref.current?.focus({ preventScroll: true })
    }
    onRevealed?.()
  }, [revealLine, diff, rows])

  useEffect(() => {
    if (pendingHunk.current === null) return
    const row = rows.find((r) => r.hunk === pendingHunk.current && r.change)
    if (row) {
      pendingHunk.current = null
      setCursor(row.index)
      scroll.revealRow(row.index, 'center')
    }
  }, [rows])

  const jumpHunk = (delta: number) => {
    if (!diff?.hunks.length) return
    const target = (cursorHunk + delta + diff.hunks.length) % diff.hunks.length
    const idx = rows.findIndex((r) => r.hunk === target && r.change)
    if (idx < 0) {
      pendingHunk.current = target
      setShowAll(true)
      return
    }
    setCursor(idx)
    scroll.revealRow(idx, 'center')
    // The reveal button becomes disabled once the only change is visible. Move focus to the
    // revealed code first so disabling the button doesn't drop keyboard focus onto the page.
    if (diff.hunks.length === 1) ref.current?.focus({ preventScroll: true })
  }

  const pane = usePane('diff', { kind: 'diff' })
  const { moveFile, onFileKey } = useDiffFileNavigation(files, ref)

  const onKeyDown = useDiffNavigation({
    ref,
    vimNavigation,
    split,
    cursorSide,
    cursor,
    rows,
    positions,
    sideRows,
    acts,
    selection,
    find,
    setCursor,
    setSide,
    onSwitchView,
    onBack,
    showCopyMenu,
    jumpHunk
  })

  const paneProps = {
    ref: setPane,
    tabIndex: 0,
    ...pane.targetProps,
    ...pane.resetProps,
    onKeyDown,
    onKeyDownCapture: (e: React.KeyboardEvent) => pane.navigate(e),
    onFocus: () => {
      hadFocus.current = true
      noteDiffFocus(copySource)
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (!rows.length) return
      e.preventDefault()
      void showCopyMenu(false)
    },
    onBlur: (e: React.FocusEvent<HTMLDivElement>) => {
      // Removal can blur too; only a real move elsewhere (element still in the page) counts.
      const el = e.currentTarget
      setTimeout(() => el.isConnected && (hadFocus.current = false))
    }
  }

  const header = title && (
    <DiffToolbar
      title={title}
      metadata={metadata}
      files={files}
      plain={plain}
      changeCount={diff?.hunks.length ?? 0}
      currentChange={cursorHunk}
      singleChangeVisible={scroll.singleChangeVisible}
      counterEmpty={loading && text === null ? 'Loading…' : 'No changes'}
      moveFile={moveFile}
      jumpHunk={jumpHunk}
      onFind={find.open}
      findOpen={find.query !== null}
      canFind={rows.length > 0}
    />
  )
  const empty = (content: ReactNode) => (
    <div className="diff-wrap" {...pane.ownerProps} onKeyDownCapture={onFileKey}>
      {header}
      <PaneFrame>
        <div className="diff diff-empty" {...paneProps}>
          {content}
        </div>
      </PaneFrame>
    </div>
  )

  if (diff === null) return empty(loading ? 'Loading…' : emptyText)
  if (diff.binary) return empty('Binary file — no preview')
  if (!diff.hunks.length) {
    if (source?.hunks.length && diff !== source)
      return empty(
        <span>
          Only whitespace changes.{' '}
          <button className="link" onClick={toggleIgnoreWhitespace}>
            Show whitespace changes
          </button>
        </span>
      )
    const info = diff.header.filter((l) => !/^(diff --git|index |--- |\+\+\+ )/.test(l))
    return empty(info.length ? info.map((l, i) => <div key={i}>{l}</div>) : 'No content changes')
  }

  const hint = acts
    ? `Diff. ↑↓ move${split ? ', ←→ switch sides' : ''}, Shift+↑↓ or Space select lines, Enter to ${acts.primary.label.toLowerCase()}${acts.discard ? ', Delete to discard' : ''}, N/P next/previous hunk`
    : `Diff. ↑↓ move${split ? ', ←→ switch sides' : ''}, N/P next/previous hunk`
  const itemList = (targetSide?: DiffSide) =>
    renderDiffItems(
      {
        diff,
        rows,
        items,
        sideRows,
        acts,
        cursor,
        cursorSide,
        cursorHunk,
        selected,
        codeOf,
        measure: scroll.measure,
        windowed: scroll.windowed,
        spacer: scroll.spacer,
        onLineMouseDown: selection.onLineMouseDown,
        onLineMouseEnter: selection.onLineMouseEnter
      },
      targetSide
    )
  const truncation = truncated && (
    <div className="diff-truncated">
      Large diff truncated.{' '}
      <button className="link" onClick={() => setShowAll(true)}>
        Show everything
      </button>
    </div>
  )
  return (
    <div className={`diff-wrap ${plain ? 'plain' : ''}`} {...pane.ownerProps} onKeyDownCapture={onFileKey}>
      {header}
      {find.query !== null && (
        <FindBar
          query={find.query}
          status={find.status}
          inputRef={find.inputRef}
          onChange={find.change}
          onEnter={find.enter}
          onClose={find.close}
          scopeHint={plain ? undefined : 'Searches loaded diff text. Use Full file for more context.'}
        />
      )}
      {notice && (
        <div className="diff-notice" role="note">
          <Icon name="info" size={14} />
          {notice}
        </div>
      )}
      <PaneFrame>
        <div
          className={`diff ${split ? 'side-mode' : ''} ${acts ? 'selectable' : ''} ${find.query !== null ? 'finding' : ''}`}
          {...paneProps}
          aria-label={hint}
        >
          {split ? (
            <SideColumns
              setColumn={setSideColumn}
              focusPane={() => ref.current?.focus({ preventScroll: true })}
              renderColumn={(targetSide) => (
                <div className="side-inner">
                  {itemList(targetSide)}
                  {truncation}
                </div>
              )}
            />
          ) : (
            <div className="diff-inner">
              {itemList()}
              {truncation}
            </div>
          )}
        </div>
      </PaneFrame>
      {acts && <DiffLineActions acts={acts} selection={selection} focusPane={() => ref.current?.focus({ preventScroll: true })} />}
    </div>
  )
}
