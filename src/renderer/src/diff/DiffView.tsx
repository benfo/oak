import { useRef, useState, type ReactNode } from 'react'
import type { FileDiff } from './diff'
import { resolveDiffLayout } from './diffLayout'
import { usePane } from '../lib/usePane'
import { useDiffJumps } from './useDiffJumps'
import { useKeepExpand } from './useKeepExpand'
import { diffEmptyContent, DiffTruncated, ReadOnlyNotice } from './DiffNotices'
import { DiffLineActions } from './DiffLineActions'
import { PaneFrame } from '../components/Pane'
import { useSettings } from '../settings'
import { noteDiffFocus } from './diffCopy'
import type { DiffActions, DiffSide } from './diffTypes'
import { useDiffRows } from './useDiffRows'
import { useDiffScroll } from './useDiffScroll'
import { useDiffCode } from './useDiffCode'
import { useDiffSelection } from './useDiffSelection'
import { useDiffCopy, type RemoteLineActions } from './useDiffCopy'
import { diffPaneElementProps, useDiffPane } from './useDiffPane'
import { DiffToolbar } from './DiffToolbar'
import { renderDiffItems } from './DiffItems'
import { SideColumns } from './SideColumns'
import { FindBar } from '../components/FindBar'
import { useDiffFind } from './useDiffFind'
import { useDiffNavigation, useDiffFileNavigation } from './useDiffNavigation'
import { useDiffDocument } from './useDiffDocument'
import { useDiffCursor } from './useDiffCursor'
import { useFilePreview } from '../preview/useFilePreview'
import type { PreviewTarget } from '../../../shared/filePreview'
import { PreviewModeToggle } from '../preview/PreviewModeToggle'
import { PreviewContent } from '../preview/PreviewContent'
import { PreviewPane } from '../preview/PreviewPane'

export type { DiffActions }

interface Props {
  title?: string
  file?: { path: string; oldPath?: string }
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
  /** V: switch the changed-files list between list and tree; omit when that list is hidden or not switchable. */
  onSwitchView?: () => void
  /** Leading control in the title bar, e.g. the file list toggle. Shown even with no file open. */
  leading?: ReactNode
  files?: { index: number; count: number; onSelect: (index: number) => void }
  /** Whole-file content (a synthetic all-added diff): shown as plain numbered code, without diff markings or tools. */
  plain?: boolean
  /** Put the cursor on the line with this new-side number, scroll to it and focus the diff, then call `onRevealed` (also when there is no such line). */
  revealLine?: number
  onRevealed?: () => void
  /** Offers "Open in editor" in the line menu, at the cursor's line; omit when the file can't be opened. */
  onOpenInEditor?: (line?: number) => void
  /** Offers "Open in browser" and "Line link" in the line menu, at the cursor's line. */
  remote?: RemoteLineActions
  /** Where this diff's file can be read from. A file with a previewer then gets a Diff | Preview switch; omit for diffs that can't be previewed. */
  preview?: PreviewTarget
}

export function DiffView({
  title,
  file,
  metadata,
  text,
  loading,
  emptyText = 'Select a file to see its changes',
  actions,
  readOnlyReason,
  onBack,
  onSwitchView,
  leading,
  files,
  plain = false,
  revealLine,
  onRevealed,
  onOpenInEditor,
  remote,
  preview
}: Props) {
  const { diff, source, displayText, reviewMode, gaps, expand } = useDiffDocument(text, plain)
  const filePreview = useFilePreview(preview, text)
  const acts = diff && actions ? actions(diff) : null
  const notice = diff && !acts && readOnlyReason ? readOnlyReason(diff) : null
  const [showAll, setShowAll] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [side, setSide] = useState<DiffSide>('new')
  const pendingHunk = useRef<number | null>(null)
  const { ref, hadFocus, paneWidth, setPane, setSideColumn } = useDiffPane()

  const { syntaxHighlighting, showWhitespace, diffLayout, vimNavigation } = useSettings()
  const split = !plain && resolveDiffLayout(diffLayout, paneWidth) === 'split'
  const footer = !!diff && gaps.some((g) => g.before === diff.hunks.length)
  const { rows, truncated, sideRows, positions, items, rowItem, posItem, itemRow } = useDiffRows(diff, showAll, split, footer)
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
  const { copySource, showCopyMenu } = useDiffCopy({
    diff,
    rows,
    cursor,
    selected,
    ref,
    file,
    side: cursorSide,
    openInEditor: onOpenInEditor,
    remote
  })

  useDiffCursor(diff, rows, cursor, setCursor, reviewMode, selection.clear, pendingHunk)
  const jumpHunk = useDiffJumps({
    diff,
    rows,
    truncated,
    showAll,
    setShowAll,
    cursorHunk,
    setCursor,
    setSide,
    revealRow: scroll.revealRow,
    ref,
    pendingHunk,
    revealLine,
    onRevealed
  })
  const { keepExpand, expandAroundCursor } = useKeepExpand(diff, gaps, expand, cursorHunk)

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
    jumpHunk,
    expandAroundCursor
  })

  const paneProps = diffPaneElementProps({
    setPane,
    hadFocus,
    pane,
    onKeyDown,
    onFocus: () => noteDiffFocus(copySource),
    showMenu: rows.length ? () => void showCopyMenu(false) : null
  })

  const header = title ? (
    <DiffToolbar
      leading={leading}
      title={title}
      metadata={metadata}
      files={files}
      plain={plain}
      previewing={filePreview.previewing}
      modeToggle={
        filePreview.previewer && (
          <PreviewModeToggle previewLabel={filePreview.previewer.label} mode={filePreview.mode} onChange={filePreview.setMode} />
        )
      }
      changeCount={diff?.hunks.length ?? 0}
      currentChange={cursorHunk}
      singleChangeVisible={scroll.singleChangeVisible}
      counterEmpty={loading && text === null ? 'Loading…' : 'No changes'}
      moveFile={moveFile}
      jumpHunk={jumpHunk}
      onFind={find.open}
      findOpen={find.query !== null}
      canFind={rows.length > 0 && !filePreview.previewing}
    />
  ) : (
    leading && <div className="diff-title">{leading}</div>
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

  if (filePreview.previewing && filePreview.previewer && preview)
    return (
      <PreviewPane
        header={header}
        wrapProps={{ ...pane.ownerProps, onKeyDownCapture: onFileKey }}
        paneProps={paneProps}
        onBack={onBack}
        label={`${filePreview.previewer.label} of the file`}
      >
        <PreviewContent
          view={filePreview.previewer.view}
          path={preview.source.file}
          versions={filePreview.versions}
          error={filePreview.error}
          onShowDiff={() => filePreview.setMode('diff')}
        />
      </PreviewPane>
    )
  if (diff === null) return empty(loading ? 'Loading…' : emptyText)
  const emptyContent = diffEmptyContent(diff, source, !!filePreview.previewer)
  if (emptyContent !== null) return empty(emptyContent)

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
        gaps,
        expand: keepExpand,
        codeOf,
        measure: scroll.measure,
        windowed: scroll.windowed,
        spacer: scroll.spacer,
        onLineMouseDown: selection.onLineMouseDown,
        onLineMouseEnter: selection.onLineMouseEnter
      },
      targetSide
    )
  const truncation = truncated && <DiffTruncated onShowAll={() => setShowAll(true)} />
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
      {notice && <ReadOnlyNotice reason={notice} />}
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
