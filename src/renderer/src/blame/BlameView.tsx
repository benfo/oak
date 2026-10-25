import { useEffect, useRef, useState } from 'react'
import { Button, Toolbar } from 'react-aria-components'
import { api, errorMessage, showMenu } from '../api'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { PaneFrame } from '../components/Pane'
import { Tip } from '../components/Tip'
import { copyText } from '../lib/copy'
import { fullDate, relativeTime } from '../lib/format'
import { widgetAction } from '../lib/keymap'
import { canHandleNavigation, horizontalScrollDirection, movementDelta, toolbarHomeEnd } from '../lib/navigation'
import { shortcutPlatform } from '../lib/shortcuts'
import { usePane } from '../lib/usePane'
import { useVirtualRows } from '../lib/useVirtualRows'
import { useSettings } from '../settings'
import { adjacentBlockStart, blameBlockStarts, blockStartOf, type BlameResult } from '../../../shared/blame'

/** Keep in sync with --diff-line-height. */
const ROW_H = 20
const SLOW_MS = 300

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
  /** Enter on a line: show its commit (null for lines that are not committed yet). */
  onOpenCommit: (hash: string | null) => void
  onClose: () => void
}

type Loaded = { base: string; result: BlameResult } | { base: string; error: string }

export function BlameView({ repo, request, status, contentRevision, active, onOpenCommit, onClose }: Props) {
  const { vimNavigation } = useSettings()
  const { file, rev } = request
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [slow, setSlow] = useState(false)
  const [cursor, setCursor] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  const pane = usePane('blame', { kind: 'diff' })
  const base = JSON.stringify([repo, file, rev, ignoreWhitespace])

  useEffect(() => toolbarHomeEnd(toolsRef.current), [])
  useEffect(() => ref.current?.focus({ preventScroll: true }), [])

  useEffect(() => {
    let cancelled = false
    api
      .blame(repo, file, rev, ignoreWhitespace)
      .then((result) => !cancelled && setLoaded({ base, result }))
      .catch((e) => !cancelled && setLoaded({ base, error: errorMessage(e) }))
    return () => {
      cancelled = true
    }
  }, [base, rev === null ? status : null, rev === null ? contentRevision : 0])

  // The previous lines stay up while a working-tree reload runs; a different file or setting shows the loading state.
  const current = loaded?.base === base ? loaded : null
  const result = current && 'result' in current ? current.result : null
  const error = current && 'error' in current ? current.error : null
  const lines = result?.lines ?? []
  const loading = !current

  useEffect(() => {
    if (!loading) return setSlow(false)
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [loading])

  const starts = blameBlockStarts(lines)
  const at = Math.max(0, Math.min(lines.length - 1, cursor))
  const blockStart = lines.length ? blockStartOf(starts, at) : 0
  const line = lines[at]
  const commit = line && result ? result.commits[line.hash] : undefined

  const rows = useVirtualRows({ count: lines.length, getScrollElement: () => ref.current, estimateSize: () => ROW_H, overscan: 20 })
  useEffect(() => {
    if (lines.length) rows.virtual.scrollToIndex(at, { align: 'auto' })
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

  const open = () => line && onOpenCommit(commit?.uncommitted ? null : line.hash)

  const lineMenu = async () => {
    if (!line || !commit) return
    const id = await showMenu([
      { id: 'open', label: commit.uncommitted ? 'Show working changes' : 'Show commit in History' },
      { id: 'copyhash', label: 'Copy commit hash', enabled: !commit.uncommitted },
      { id: 'copyline', label: 'Copy line' }
    ])
    if (id === 'open') open()
    else if (id === 'copyhash') copyText(line.hash, 'commit hash')
    else if (id === 'copyline') copyText(line.text, 'line')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!canHandleNavigation(e)) return
    const widget = widgetAction(e.nativeEvent, 'blame', shortcutPlatform())
    const horizontal = horizontalScrollDirection(e.nativeEvent, vimNavigation)
    if (horizontal) {
      e.preventDefault()
      const scroller = ref.current
      if (scroller) scroller.scrollBy({ left: horizontal * Math.max(1, Math.round(scroller.clientWidth / 4)), behavior: 'instant' })
      return
    }
    if (widget === 'dismiss' || (widget === 'back' && !ref.current?.scrollLeft)) {
      e.preventDefault()
      onClose()
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
      const next = adjacentBlockStart(starts, at, widget === 'nextBlock' ? 1 : -1)
      if (next !== null) setCursor(next)
    } else if (widget === 'activate' || widget === 'deeper') {
      e.preventDefault()
      open()
    } else if (widget === 'menu') {
      e.preventDefault()
      void lineMenu()
    }
  }

  const revision = rev ? rev.slice(0, 8) : 'Working tree'
  const notice =
    error ?? (result?.binary ? 'Blame is not available for binary files.' : result && !lines.length ? 'This file is empty.' : null)

  return (
    <div className="diff-wrap blame-view" {...pane.ownerProps}>
      <div className="diff-title">
        <span className="diff-filename" title={file}>
          {file}
        </span>
        <span className="blame-revision" title={rev ?? undefined}>
          {revision}
        </span>
        <Toolbar className="diff-controls" aria-label="Blame tools" ref={toolsRef}>
          <Tip label="Ignore whitespace changes">
            <Button className="diff-full-button" aria-pressed={ignoreWhitespace} onPress={() => setIgnoreWhitespace(!ignoreWhitespace)}>
              Ignore whitespace
            </Button>
          </Tip>
          <Tip label="Close blame" keys="Escape">
            <Button className="icon-btn" aria-label="Close blame" onPress={onClose}>
              <Icon name="x" size={14} />
            </Button>
          </Tip>
        </Toolbar>
      </div>
      <PaneFrame>
        <div
          ref={ref}
          className={`diff blame${notice || loading ? ' diff-empty' : ''}`}
          tabIndex={0}
          aria-label={`Blame of ${file}`}
          {...pane.targetProps}
          {...pane.resetProps}
          onKeyDown={onKeyDown}
          onKeyDownCapture={(e) => pane.navigate(e)}
          onContextMenu={(e) => {
            if (!lines.length) return
            e.preventDefault()
            void lineMenu()
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
                const c = result!.commits[l.hash]
                const first = index === 0 || lines[index - 1].hash !== l.hash
                return (
                  <div
                    key={index}
                    className={`dl blame-row${first ? ' block-start' : ''}${index === at ? ' cursor' : ''}${blockStartOf(starts, index) === blockStart ? ' current-block' : ''}`}
                    onClick={() => setCursor(index)}
                  >
                    <span className="gutter">
                      <span className="ln">{index + 1}</span>
                      <span className="blame-info" title={first && c ? `${c.author}, ${fullDate(c.time * 1000)}\n${c.summary}` : undefined}>
                        {first &&
                          c &&
                          (c.uncommitted ? (
                            <span className="blame-uncommitted">Not committed yet</span>
                          ) : (
                            <>
                              <Avatar name={c.author} email={c.email} size={16} />
                              <span className="blame-hash">{c.hash.slice(0, 7)}</span>
                              <span className="blame-date">{relativeTime(c.time * 1000)}</span>
                            </>
                          ))}
                      </span>
                    </span>
                    <span className="code">{l.text}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </PaneFrame>
      <div className="blame-preview" aria-live="polite">
        {commit &&
          (commit.uncommitted ? (
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
            </>
          ))}
      </div>
    </div>
  )
}
