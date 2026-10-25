import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Button, Toolbar } from 'react-aria-components'
import { api, errorMessage, showMenu } from '../api'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { PaneFrame } from '../components/Pane'
import { Tip } from '../components/Tip'
import { useFileTokens } from '../diff/highlight'
import { toggleWhitespace } from '../diff/toggleWhitespace'
import { copyText } from '../lib/copy'
import { fullDate, relativeTime } from '../lib/format'
import { widgetAction } from '../lib/keymap'
import { canHandleNavigation, horizontalScrollDirection, movementDelta, toolbarHomeEnd } from '../lib/navigation'
import { shortcutPlatform } from '../lib/shortcuts'
import { usePane } from '../lib/usePane'
import { useVirtualRows } from '../lib/useVirtualRows'
import { useSettings } from '../settings'
import { BlameVersion, type BlameStep } from './BlameVersion'
import { CommitMessage } from './CommitMessage'
import { CommitPopover } from './CommitPopover'
import { adjacentBlockStart, blameBlockStarts, findHits, gotoLine, type BlameResult } from '../../../shared/blame'
import { BlameCode } from './BlameCode'
import { BlameFind } from './BlameFind'

/** Keep in sync with --diff-line-height. */
const ROW_H = 20
const SLOW_MS = 300
const NOTE_MS = 3500
const NO_HITS: [number, number][] = []
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

/** `version` is the file and revision alone, so a setting change can keep showing the same file while it reloads. */
type Loaded = { base: string; version: string; result: BlameResult } | { base: string; version: string; error: string }

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
  // On by default, as it always was; the toggle only appears once a blame has found a list, and stays while the next one loads.
  const [useIgnoreRevs, setUseIgnoreRevs] = useState(true)
  const [hasIgnoreRevs, setHasIgnoreRevs] = useState(false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [slow, setSlow] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [messageOpen, setMessageOpen] = useState(false)
  /** The find bar's text; null while it is closed. A leading ":" makes it a go-to-line box. */
  const [find, setFind] = useState<string | null>(null)
  const findRef = useRef<HTMLInputElement>(null)
  /** Full messages by commit hash, read on demand; a commit never changes, so entries stay (null: could not be read). */
  const messages = useRef(new Map<string, string | null>())
  const [, messagesChanged] = useReducer((n: number) => n + 1, 0)
  /** The cursor row's code, which the popover hangs from. Held in state because Aria reads the element while rendering, so a ref would reposition one move late. */
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  const pane = usePane('blame', { kind: 'diff' })
  const version = JSON.stringify([repo, file, rev])
  const base = JSON.stringify([version, ignoreWhitespace, useIgnoreRevs])

  useEffect(() => toolbarHomeEnd(toolsRef.current), [])
  useEffect(() => ref.current?.focus({ preventScroll: true }), [])

  useEffect(() => {
    let cancelled = false
    api
      .blame(repo, file, rev, ignoreWhitespace, useIgnoreRevs)
      .then((result) => {
        if (cancelled) return
        if (result.hasIgnoreRevs) setHasIgnoreRevs(true)
        setLoaded({ base, version, result })
      })
      .catch((e) => !cancelled && setLoaded({ base, version, error: errorMessage(e) }))
    return () => {
      cancelled = true
    }
  }, [base, rev === null ? status : null, rev === null ? contentRevision : 0])

  // The previous lines stay up while a working-tree reload or a setting change reloads the same file; only a different file or revision shows the loading state.
  const current = loaded?.version === version ? loaded : null
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

  // The tint only says something while the commit is a minority of the file; a new file is one commit, and tinting all of it just lowers contrast.
  const tintCommit = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of lines) counts.set(l.hash, (counts.get(l.hash) ?? 0) + 1)
    return line && (counts.get(line.hash) ?? 0) * 2 <= lines.length ? line.hash : null
  }, [result, line?.hash])

  const goto = find?.startsWith(':') ?? false
  // Every occurrence is a match, so a line with the text twice counts twice and Enter steps through both.
  const hits = useMemo(() => (find && !goto ? findHits(lines, find) : []), [result, find, goto])
  const hitRows = useMemo(() => {
    const byLine = new Map<number, { first: number; ranges: [number, number][] }>()
    hits.forEach((h, i) => {
      const row = byLine.get(h.line) ?? { first: i, ranges: [] }
      row.ranges.push([h.start, h.end])
      byLine.set(h.line, row)
    })
    return byLine
  }, [hits])
  /** The occurrence Enter last moved to; it only counts while the cursor is still on its line. */
  const [hitIndex, setHitIndex] = useState(0)
  const firstOnLine = hitRows.get(at)?.first ?? -1
  const hitNow = hits[hitIndex]?.line === at ? hitIndex : firstOnLine
  const target = find !== null && goto ? gotoLine(find, lines.length) : null
  const findStatus = goto
    ? target === null
      ? 'Type a line number'
      : `Go to line ${target + 1}`
    : !find
      ? ''
      : !hits.length
        ? 'No matches'
        : hitNow >= 0
          ? `${hitNow + 1} of ${hits.length}`
          : `${hits.length} ${hits.length === 1 ? 'match' : 'matches'}`
  const closeFind = () => {
    setFind(null)
    ref.current?.focus({ preventScroll: true })
  }
  // Typing moves the cursor to the first match from where it is, or to the line a ":120" names, so the view follows as you type.
  const changeFind = (query: string) => {
    setFind(query)
    if (query.startsWith(':')) {
      const to = gotoLine(query, lines.length)
      if (to !== null) setCursor(to)
      return
    }
    const found = findHits(lines, query)
    const first = found.findIndex((h) => h.line >= at)
    const to = first >= 0 ? first : found.length ? 0 : -1
    if (to < 0) return
    setHitIndex(to)
    setCursor(found[to].line)
  }
  // The same actions as N, P and "/", for the header buttons; each button hands focus back so the keys keep working afterwards.
  const nextStart = adjacentBlockStart(starts, at, 1)
  const prevStart = adjacentBlockStart(starts, at, -1)
  const moveBlock = (delta: 1 | -1) => {
    const next = delta === 1 ? nextStart : prevStart
    if (next !== null) setCursor(next)
  }
  const openFind = () => {
    if (find === null) setFind('')
    else findRef.current?.select()
    findRef.current?.focus()
  }
  const refocus = () => ref.current?.focus({ preventScroll: true })
  const enterFind = (backwards: boolean) => {
    if (goto) {
      if (target === null) return
      setCursor(target)
      return closeFind()
    }
    const n = hits.length
    if (!n) return
    let to: number
    if (hitNow >= 0) to = (hitNow + (backwards ? -1 : 1) + n) % n
    else if (backwards) {
      const before = hits.findLastIndex((h) => h.line < at)
      to = before >= 0 ? before : n - 1
    } else {
      const after = hits.findIndex((h) => h.line > at)
      to = after >= 0 ? after : 0
    }
    setHitIndex(to)
    setCursor(hits[to].line)
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

  // The version just before the line's commit, with the cursor on the line's place in it. A line that is not committed steps to HEAD.
  const stepBack = async (index = at) => {
    const l = lines[index]
    const c = l && result?.commits[l.hash]
    if (!l || !c || stepping.current) return
    if (c.boundary) return setNote('No earlier version: this is the first version of the file.')
    stepping.current = true
    try {
      const older = await api.blameBefore(
        repo,
        c.uncommitted ? null : l.hash,
        c.uncommitted ? file : l.file || file,
        c.uncommitted ? index + 1 : l.origLine
      )
      if (!older) return setNote('No earlier version: this commit created the file.')
      setNote(older.added ? 'This commit added the line. Showing the nearest line above it.' : null)
      rememberOffset()
      setSteps([
        ...steps,
        { file: older.file, rev: older.rev, before: c.uncommitted ? null : { hash: c.hash, summary: c.summary }, returnTo: index }
      ])
      setCursor(older.line - 1)
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
      openFind()
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
        <Toolbar className="diff-controls" aria-label="Blame tools" ref={toolsRef}>
          <span className="diff-navigation-group">
            <Tip label="Find in file" keys="/">
              <Button
                className="icon-btn"
                aria-label="Find in file"
                aria-pressed={find !== null}
                isDisabled={!lines.length}
                onPress={openFind}
              >
                <Icon name="search" size={14} />
              </Button>
            </Tip>
            <Tip label="Previous commit block" keys="P">
              <Button
                className="icon-btn"
                aria-label="Previous commit block"
                isDisabled={prevStart === null}
                onPress={() => {
                  moveBlock(-1)
                  refocus()
                }}
              >
                <Icon name="arrowUp" size={14} />
              </Button>
            </Tip>
            <Tip label="Next commit block" keys="N">
              <Button
                className="icon-btn"
                aria-label="Next commit block"
                isDisabled={nextStart === null}
                onPress={() => {
                  moveBlock(1)
                  refocus()
                }}
              >
                <Icon name="arrowDown" size={14} />
              </Button>
            </Tip>
            <Tip label={commit?.uncommitted ? 'Blame this line at HEAD' : 'Blame the line as it was before its commit'} keys="B">
              <Button
                className="icon-btn"
                aria-label="Blame before this commit"
                isDisabled={!commit || commit.boundary}
                onPress={() => {
                  void stepBack()
                  refocus()
                }}
              >
                <Icon name="history" size={14} />
              </Button>
            </Tip>
          </span>
          <Tip label="Ignore whitespace changes">
            <Button className="diff-full-button" aria-pressed={ignoreWhitespace} onPress={() => setIgnoreWhitespace(!ignoreWhitespace)}>
              Ignore whitespace
            </Button>
          </Tip>
          {hasIgnoreRevs && (
            <Tip label="Skip the commits on the repository's ignore-revs list, such as bulk reformatting">
              <Button className="diff-full-button" aria-pressed={useIgnoreRevs} onPress={() => setUseIgnoreRevs(!useIgnoreRevs)}>
                Ignore bulk commits
              </Button>
            </Tip>
          )}
          <Tip label="Draw spaces and tabs">
            <Button className="diff-full-button" aria-pressed={whitespace} onPress={toggleWhitespace}>
              Spaces and tabs
            </Button>
          </Tip>
          <Tip label="Close blame">
            <Button className="icon-btn" aria-label="Close blame" onPress={onClose}>
              <Icon name="x" size={14} />
            </Button>
          </Tip>
        </Toolbar>
      </div>
      {find !== null && (
        <BlameFind query={find} status={findStatus} inputRef={findRef} onChange={changeFind} onEnter={enterFind} onClose={closeFind} />
      )}
      <PaneFrame>
        <div
          ref={ref}
          className={`diff blame${notice || loading ? ' diff-empty' : ''}${find !== null ? ' finding' : ''}`}
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
                    className={`dl blame-row${first ? ' block-start' : ''}${index === at ? ' cursor' : ''}${l.hash === tintCommit ? ' same-commit' : ''}${l.ignored ? ' ignored' : ''}${hitRows.has(index) ? ' found' : ''}`}
                    onClick={() => setCursor(index)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCursor(index)
                      void lineMenu(false, index)
                    }}
                  >
                    <span className="gutter" onDoubleClick={() => open(index)}>
                      <span
                        className="ln"
                        title={l.ignored ? 'Blame skipped a commit on the ignore-revs list to name this one' : undefined}
                      >
                        {index + 1}
                      </span>
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
                      <BlameCode
                        text={l.text}
                        tokens={tokens ? tokens[index] : null}
                        whitespace={whitespace}
                        hits={hitRows.get(index)?.ranges ?? NO_HITS}
                        currentHit={hitNow >= 0 && hits[hitNow].line === index ? hitNow - hitRows.get(index)!.first : -1}
                      />
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </PaneFrame>
      <div className="blame-preview" aria-live="polite">
        {note ? (
          <span className="blame-note">{note}</span>
        ) : (
          commit && (
            <>
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
                      {line?.ignored && <span className="blame-ignored">Skipped an ignored commit</span>}
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
      {/* One popover that moves with the cursor (it is not remounted per line, which flashed); hidden while the cursor's row is scrolled out of the window. */}
      {messageOpen && commit && anchor && (
        <CommitPopover anchor={anchor} scroller={ref.current}>
          <CommitMessage commit={commit} message={messages.current.get(commit.hash)} />
        </CommitPopover>
      )}
    </div>
  )
}
