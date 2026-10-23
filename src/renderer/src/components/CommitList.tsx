import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Commit } from '../../../shared/types'
import { WORKING_HASH } from '../../../shared/working.ts'
import type { Graph, GraphRow } from '../lib/graph'
import { relativeTime } from '../lib/format'
import { Avatar } from './Avatar'
import { canHandleNavigation, handleListNav, handleNavigation, movementDelta } from '../lib/navigation'
import { widgetAction } from '../lib/keymap'
import { shortcutPlatform } from '../lib/shortcuts'
import { usePane } from '../lib/usePane'
import { PaneFrame } from './Pane'

/** Matches --row-md (tokens.css). */
export const ROW_H = 28
const LANE_W = 14
const MAX_LANES = 24
const OVERSCAN = 12
/** Graph lane colours come from the theme (`--graph-lane-0` … `--graph-lane-7`). */
export const LANE_COUNT = 8

// Leave roughly --row-pad before the HEAD ring's outside edge, clear of the focus bar.
const laneX = (i: number) => 18 + i * LANE_W
const laneColor = (c: number, muted = false) => {
  const color = `var(--graph-lane-${c % LANE_COUNT})`
  // Mix opaque colours instead of reducing element opacity: lines must not show through nodes.
  return muted ? `color-mix(in srgb, ${color} var(--graph-muted-strength), var(--surface))` : color
}

interface Props {
  commits: Commit[]
  graph: Graph
  emphasizeCurrentBranch?: boolean
  onDisplayMenu?: (e: React.SyntheticEvent) => void
  selected: string | null
  compareBase: string | null
  comparing?: boolean
  onToggle: (hash: string) => void
  onClearComparison: () => void
  /** Escape when no comparison is active (for example, clears a file's history). */
  onDismiss?: () => void
  /** Bumped whenever the selected row should be scrolled into view. */
  revealKey: number
  onSelect: (hash: string) => void
  onContextMenu?: (c: Commit, e: React.SyntheticEvent) => void
  onNearEnd?: () => void
  /** Enter or → on the selected commit (moves focus to its files). */
  onOpen?: () => void
  /** Uncommitted changes shown as the first row; its file count is the row's detail. */
  working?: { files: number; onLabel: string } | null
  /** The list is stale while a new one loads: dimmed and inert. */
  loading?: boolean
  /** Focus the search field without replacing its current query. */
  onSearch?: () => void
}

export function CommitList({ commits, graph, emphasizeCurrentBranch, onDisplayMenu, selected, compareBase, comparing, onToggle, onClearComparison, onDismiss, revealKey, onSelect, onContextMenu, onNearEnd, onOpen, onSearch, working, loading }: Props) {
  const id = useId()
  const pane = usePane('graph')
  const [cursor, setCursor] = useState(selected)
  useEffect(() => setCursor(selected), [selected, revealKey])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(600)
  const graphW = laneX(Math.min(graph.width, MAX_LANES) - 1) + 12
  const offset = working ? 1 : 0
  const keys = useMemo(() => (working ? [WORKING_HASH] : []).concat(commits.map((c) => c.hash)), [commits, !!working])
  const headIndex = commits.findIndex((c) => c.refs.some((r) => r.current || r.type === 'head'))
  const headCol = graph.rows[headIndex]?.col ?? 0

  useLayoutEffect(() => {
    const el = scrollRef.current!
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The working row appearing or disappearing must not move the commits under the pointer.
  const hadWorking = useRef(!!working)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && hadWorking.current !== !!working && el.scrollTop > 0) el.scrollTop = Math.max(0, el.scrollTop + (working ? ROW_H : -ROW_H))
    hadWorking.current = !!working
  }, [!!working])

  const ownedMenuKey = useRef(false)
  const selectedIndex = selected ? keys.indexOf(selected) : -1
  const cursorIndex = keys.indexOf(cursor ?? '')

  // Scroll the selection into view only when asked (selection by keyboard, sidebar, search).
  useEffect(() => {
    const el = scrollRef.current
    if (!el || selectedIndex < 0) return
    const top = selectedIndex * ROW_H
    if (top < el.scrollTop) el.scrollTop = top
    else if (top + ROW_H > el.scrollTop + el.clientHeight) el.scrollTop = top - el.clientHeight / 2
  }, [revealKey, selectedIndex >= 0])

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const end = Math.min(keys.length, Math.ceil((scrollTop + height) / ROW_H) + OVERSCAN)

  useEffect(() => {
    if (onNearEnd && commits.length && end >= keys.length - 20) onNearEnd()
  }, [end, keys.length])

  const ensureVisible = (i: number) => {
    const el = scrollRef.current
    if (!el) return
    const top = i * ROW_H
    if (top < el.scrollTop) el.scrollTop = top
    else if (top + ROW_H > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_H - el.clientHeight
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!canHandleNavigation(e)) return
    if (handleNavigation(e, { dismiss: comparing ? onClearComparison : onDismiss })) return
    const widget = widgetAction(e.nativeEvent, 'graph', shortcutPlatform())
    if ((widget === 'select' || widget === 'toggleSelect') && cursor) {
      e.preventDefault()
      if (widget === 'toggleSelect') onToggle(cursor)
      else onSelect(cursor)
      return
    }
    if (widget === 'moveFocus') {
      const page = Math.max(1, Math.floor(height / ROW_H) - 1)
      const delta = movementDelta(e.key, page)
      if (delta !== undefined && keys.length) {
        e.preventDefault()
        const i = Math.max(0, Math.min(keys.length - 1, Math.max(0, cursorIndex) + delta))
        setCursor(keys[i])
        ensureVisible(i)
        return
      }
    }
    const commitAtCursor = cursorIndex >= offset ? commits[cursorIndex - offset] : undefined
    if (handleNavigation(e, {
      menu: cursorIndex < offset ? () => {
        // The browser's own context-menu event can still follow this key; swallow it once.
        ownedMenuKey.current = true
        setTimeout(() => { ownedMenuKey.current = false }, 500)
      } : commitAtCursor && onContextMenu ? () => onContextMenu(commitAtCursor, e) : undefined,
      deeper: onOpen,
      activate: onOpen
    })) return
    const page = Math.max(1, Math.floor(height / ROW_H) - 1)
    handleListNav(e, keys.length, cursorIndex, (i) => {
      setCursor(keys[i])
      onSelect(keys[i])
      ensureVisible(i)
    }, page)
  }

  return (
    <PaneFrame>
      <div className="commit-list" aria-busy={loading || undefined} tabIndex={0} {...pane.targetProps} {...pane.resetProps} role="listbox" aria-multiselectable="true"
        aria-label="Commit graph. Ctrl+click two commits to compare. Ctrl+arrows move focus, Ctrl+Space toggles selection, Escape ends comparison."
        aria-activedescendant={cursorIndex >= start && cursorIndex < end ? `${id}-${cursor}` : undefined} onKeyDown={onKeyDown}
        onKeyDownCapture={(e) => pane.navigate(e, onSearch)}
        onContextMenu={(e) => {
          if (ownedMenuKey.current) { ownedMenuKey.current = false; e.preventDefault(); return }
          if (!e.defaultPrevented) onDisplayMenu?.(e)
        }}>
        <div className="commit-row header" aria-hidden="true" style={{ gridTemplateColumns: cols(graphW) }}>
          <div />
          <div>Message</div>
          <div>Author</div>
          <div>Date</div>
          <div>Commit</div>
        </div>
        {/* Clicks land on the scroller; hand focus to the pane so the graph stays a single Tab stop. */}
        <div
          ref={scrollRef}
          className="commit-scroll"
          tabIndex={-1}
          onFocus={(e) => e.currentTarget.parentElement?.focus()}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          <div style={{ height: keys.length * ROW_H, position: 'relative' }}>
            {keys.slice(start, end).map((key, k) => {
              const i = start + k
              if (key === WORKING_HASH) {
                const n = working?.files ?? 0
                return (
                  <div
                    key={key}
                    id={`${id}-${key}`}
                    role="option"
                    aria-selected={key === selected}
                    className={`commit-row working ${key === selected ? 'selected' : ''} ${key === cursor ? 'cursor' : ''}`}
                    style={{ top: i * ROW_H, gridTemplateColumns: cols(graphW) }}
                    onContextMenu={(e) => e.preventDefault()}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return
                      setCursor(key)
                      onSelect(key)
                    }}
                  >
                    <svg className="graph-cell" width={graphW} height={ROW_H} aria-hidden="true">
                      {/* The stub only means something when HEAD is the row right below. */}
                      {headIndex === 0 && <path className="working-edge" d={`M${laneX(headCol)} ${ROW_H / 2}V${ROW_H}`} />}
                      <circle className="working-node" cx={laneX(headCol)} cy={ROW_H / 2} r={4.5} />
                    </svg>
                    <div className="c-subject">
                      <span className="subject-text">Working changes</span>
                      <span className="muted small">{n} {n === 1 ? 'file' : 'files'} · on {working?.onLabel}</span>
                    </div>
                    <div />
                    <div />
                    <div />
                  </div>
                )
              }
              const c = commits[i - offset]
              return (
                <div
                  key={c.hash}
                  id={`${id}-${c.hash}`}
                  role="option"
                  aria-selected={c.hash === selected || c.hash === compareBase}
                  className={`commit-row ${c.hash === selected || c.hash === compareBase ? 'selected' : ''} ${c.hash === cursor ? 'cursor' : ''}`}
                  style={{ top: i * ROW_H, gridTemplateColumns: cols(graphW) }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return
                    setCursor(c.hash)
                    if (e.ctrlKey || e.metaKey) onToggle(c.hash)
                    else onSelect(c.hash)
                  }}
                  onContextMenu={(e) => {
                    setCursor(c.hash)
                    onContextMenu?.(c, e)
                  }}
                >
                  <GraphCell row={graph.rows[i - offset]} width={graphW} emphasize={!!emphasizeCurrentBranch} isMerge={c.parents.length > 1} isHead={c.refs.some((r) => r.current || r.type === 'head')} />
                  <div className="c-subject">
                    {c.refs.map((r) => (
                      <span key={r.type + r.name} className={`ref-badge ${r.type} ${r.current ? 'current' : ''}`}>
                        {r.name}
                      </span>
                    ))}
                    <span className="subject-text">{c.subject}</span>
                  </div>
                  <div className="c-author" title={`${c.author} <${c.email}>`}>
                    <Avatar name={c.author} email={c.email} size={16} />
                    <span className="c-author-name">
                      {c.author}
                    </span>
                  </div>
                  <div className="c-date" title={new Date(c.date).toLocaleString()}>
                    {relativeTime(c.date)}
                  </div>
                  <div className="c-hash">{c.hash.slice(0, 8)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </PaneFrame>
  )
}

const cols = (graphW: number) => `${graphW}px minmax(200px, 1fr) 160px 120px 76px`

function edgePath(fromX: number, y1: number, toX: number, y2: number) {
  if (fromX === toX) return `M${fromX} ${y1}V${y2}`
  const ym = (y1 + y2) / 2
  return `M${fromX} ${y1}C${fromX} ${ym} ${toX} ${ym} ${toX} ${y2}`
}

function GraphCell({ row, width, emphasize, isMerge, isHead }: { row: GraphRow | undefined; width: number; emphasize: boolean; isMerge: boolean; isHead: boolean }) {
  if (!row) return <div />
  const mid = ROW_H / 2
  const cx = laneX(row.col)
  const emphasis = (current: boolean) => emphasize ? current ? 'graph-current' : 'graph-muted' : undefined
  return (
    <svg className="graph-cell" width={width} height={ROW_H}>
      {row.top.map((e, i) => (
        <path key={`t${i}`} className={emphasis(e.current)} d={edgePath(laneX(e.from), 0, laneX(e.to), mid)} stroke={laneColor(e.color, emphasize && !e.current)} />
      ))}
      {row.bottom.map((e, i) => (
        <path key={`b${i}`} className={emphasis(e.current)} d={edgePath(laneX(e.from), mid, laneX(e.to), ROW_H)} stroke={laneColor(e.color, emphasize && !e.current)} />
      ))}
      {isHead && <circle cx={cx} cy={mid} r={7.5} fill="none" stroke={laneColor(row.color)} strokeWidth={1.5} />}
      <circle
        className={`${emphasis(row.current) ?? ''}${isMerge ? ' graph-merge' : ''}`}
        cx={cx}
        cy={mid}
        r={isMerge ? 3.5 : 4.5}
        fill={isMerge ? 'var(--surface)' : laneColor(row.color, emphasize && !row.current)}
        stroke={laneColor(row.color, emphasize && !row.current)}
        strokeWidth={isMerge ? 2 : 0}
      />
    </svg>
  )
}
