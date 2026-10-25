import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Button, Toolbar } from 'react-aria-components'
import { api, errorMessage, showMenu } from '../api'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { PaneFrame } from '../components/Pane'
import { Tip } from '../components/Tip'
import { useFileTokens } from '../diff/highlight'
import { toggleWhitespace } from '../diff/toggleWhitespace'
import { showWhitespace } from '../diff/whitespace'
import { copyText } from '../lib/copy'
import { fullDate, relativeTime } from '../lib/format'
import { widgetAction } from '../lib/keymap'
import { canHandleNavigation, horizontalScrollDirection, movementDelta, toolbarHomeEnd } from '../lib/navigation'
import { shortcutPlatform } from '../lib/shortcuts'
import { usePane } from '../lib/usePane'
import { useVirtualRows } from '../lib/useVirtualRows'
import { useSettings } from '../settings'
import { CommitMessage } from './CommitMessage'
import { CommitPopover } from './CommitPopover'
import { adjacentBlockStart, blameBlockStarts, type BlameResult } from '../../../shared/blame'

/** Keep in sync with --diff-line-height. */
const ROW_H = 20
const SLOW_MS = 300
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

type Loaded = { base: string; result: BlameResult } | { base: string; error: string }

export function BlameView({ repo, request, status, contentRevision, active, onOpenCommit, onClose }: Props) {
  const { vimNavigation, syntaxHighlighting, showWhitespace: whitespace } = useSettings()
  const { file, rev } = request
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [slow, setSlow] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [messageOpen, setMessageOpen] = useState(false)
  /** Full messages by commit hash, read on demand; a commit never changes, so entries stay (null: could not be read). */
  const messages = useRef(new Map<string, string | null>())
  const [, messagesChanged] = useReducer((n: number) => n + 1, 0)
  /** The cursor row's code, which the popover hangs from. Held in state because Aria reads the element while rendering, so a ref would reposition one move late. */
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
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

  // The whole file is tokenized as one block, so a line that starts mid-construct is still coloured right.
  const text = useMemo(() => (result?.lines.length ? result.lines.map((l) => l.text).join('\n') : null), [result])
  const tokenLines = useFileTokens(file, text, syntaxHighlighting)
  const tokens = tokenLines?.length === lines.length ? tokenLines : null

  useEffect(() => {
    if (!loading) return setSlow(false)
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [loading])

  const starts = blameBlockStarts(lines)
  const at = Math.max(0, Math.min(lines.length - 1, cursor))
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

  // Runs before paint, so the popover is placed on the new row in the same frame the cursor moves to it.
  useLayoutEffect(() => {
    setAnchor(messageOpen ? (ref.current?.querySelector<HTMLElement>('.blame-row.cursor .code') ?? null) : null)
  })

  const wantedMessage = messageOpen && commit && !commit.uncommitted ? commit.hash : null
  useEffect(() => {
    if (!wantedMessage || messages.current.has(wantedMessage)) return
    api
      .commitMessage(repo, wantedMessage)
      .then(
        (text) => messages.current.set(wantedMessage, text),
        () => messages.current.set(wantedMessage, null)
      )
      .then(messagesChanged)
  }, [wantedMessage])

  // The popover is portalled, so it must not outlive the view being shown or the focus staying in it.
  useEffect(() => {
    if (!active) setMessageOpen(false)
  }, [active])
  useEffect(() => {
    if (!messageOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element
      if (!ref.current?.contains(target) && !target.closest('.commit-popover, .blame-preview')) setMessageOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [messageOpen])

  // The commit's diff shows the line where that commit put it, which is not where the line sits now.
  const open = (index = at) => {
    const l = lines[index]
    if (!l) return
    if (result?.commits[l.hash]?.uncommitted) onOpenCommit(null, { file, line: index + 1 })
    else onOpenCommit(l.hash, { file: l.file || file, line: l.origLine })
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
        { id: 'copyhash', label: 'Copy commit hash', enabled: !c.uncommitted },
        { id: 'copyline', label: 'Copy line' }
      ],
      anchor
    )
    if (id === 'message') setMessageOpen(true)
    else if (id === 'open') open(index)
    else if (id === 'copyhash') copyText(l.hash, 'commit hash')
    else if (id === 'copyline') copyText(l.text, 'line')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!canHandleNavigation(e)) return
    const widget = widgetAction(e.nativeEvent, 'blame', shortcutPlatform())
    // Left and Right only ever scroll the code; leaving the view is Escape (close) or Enter (open the commit).
    const wide = horizontalScrollDirection(e.nativeEvent, vimNavigation)
    const plain = e.shiftKey || e.ctrlKey || e.metaKey || e.altKey ? 0 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (wide || plain) {
      e.preventDefault()
      const scroller = ref.current
      if (scroller)
        scroller.scrollBy({ left: wide ? wide * Math.max(1, Math.round(scroller.clientWidth / 4)) : plain * H_STEP, behavior: 'instant' })
      return
    }
    if (widget === 'dismiss') {
      e.preventDefault()
      if (messageOpen) setMessageOpen(false)
      else onClose()
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
    } else if (widget === 'commitMessage') {
      e.preventDefault()
      setMessageOpen(!messageOpen)
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
          <Tip label="Draw spaces and tabs">
            <Button className="diff-full-button" aria-pressed={whitespace} onPress={toggleWhitespace}>
              Spaces and tabs
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
                const c = result!.commits[l.hash]
                const first = index === 0 || lines[index - 1].hash !== l.hash
                return (
                  <div
                    key={index}
                    className={`dl blame-row${first ? ' block-start' : ''}${index === at ? ' cursor' : ''}${l.hash === line?.hash ? ' same-commit' : ''}`}
                    onClick={() => setCursor(index)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCursor(index)
                      void lineMenu(false, index)
                    }}
                  >
                    <span className="gutter">
                      <span className="ln">{index + 1}</span>
                      <span
                        className="blame-info"
                        title={
                          first && c && !c.uncommitted
                            ? `${c.summary}\n${c.author}, ${fullDate(c.time * 1000)}, ${c.hash.slice(0, 7)}`
                            : undefined
                        }
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
                      {tokens
                        ? tokens[index].map((s, i) => (
                            <span key={i} style={s.c ? { color: s.c } : undefined}>
                              {whitespace ? showWhitespace(s.t) : s.t}
                            </span>
                          ))
                        : whitespace
                          ? showWhitespace(l.text)
                          : l.text}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </PaneFrame>
      <div className="blame-preview" aria-live="polite">
        {commit && (
          <Tip label="Show the full commit message" keys="Space" placement="top">
            <Button
              className="blame-preview-button"
              aria-expanded={messageOpen}
              onPress={() => {
                setMessageOpen(!messageOpen)
                ref.current?.focus({ preventScroll: true })
              }}
            >
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
                  <span className="blame-preview-hint" aria-hidden="true">
                    <Icon name="info" size={14} />
                    <kbd>Space</kbd>
                  </span>
                </>
              )}
            </Button>
          </Tip>
        )}
      </div>
      {/* One popover that moves with the cursor (it is not remounted per line, which flashed); hidden while the cursor's row is scrolled out of the window. */}
      {messageOpen && commit && anchor && (
        <CommitPopover anchor={anchor} scroller={ref.current}>
          <CommitMessage commit={commit} message={messages.current.get(commit.hash)} />
        </CommitPopover>
      )}
    </div>
  )
}
