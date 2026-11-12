import type { ReactNode } from 'react'
import { Tip } from '../components/Tip'
import { hunkPatch, type FileDiff } from './diff'
import { GapControls, type GapEdge } from './GapControls'
import type { Gap } from '../../../shared/diffExpand'
import type { DiffActions, DiffSide, Item, Row, SidePair } from './diffTypes'

export interface ItemsContext {
  diff: FileDiff
  rows: Row[]
  items: Item[]
  sideRows: SidePair[]
  acts: DiffActions | null
  cursor: number
  cursorSide: DiffSide
  cursorHunk: number
  selected: Set<string>
  gaps: Gap[]
  expand: (key: number, edge: GapEdge) => void
  codeOf: (row: Row, currentSide: boolean) => ReactNode
  /** Measures rows of a long diff once rendered; null when the whole list is in the page. */
  measure: ((el: Element | null) => void) | null
  windowed: { index: number }[]
  spacer: { paddingTop: number; paddingBottom: number }
  onLineMouseDown: (e: React.MouseEvent, idx: number, side?: DiffSide) => void
  onLineMouseEnter: (idx: number) => void
}

/** The hunk headers and lines (or line pairs) of the diff, or the windowed part of them when it is long. */
export function renderDiffItems(ctx: ItemsContext, targetSide?: DiffSide) {
  const { diff, rows, items, sideRows, acts, cursor, cursorSide, cursorHunk, selected, measure, gaps, expand } = ctx
  const slot = (i: number) => (measure ? { ref: measure, 'data-index': i } : {})

  const renderLine = (i: number | null, index: number, key: string, hunk?: number) => {
    if (i === null) return <div key={key} {...slot(index)} className="dl side-blank" aria-hidden="true" />
    const r = rows[i]
    const l = diff.hunks[r.hunk].lines[r.line]
    return (
      <div
        key={key}
        {...slot(index)}
        data-idx={i}
        data-old-line={l.oldNo ?? undefined}
        data-new-line={l.newNo ?? undefined}
        data-side={targetSide}
        className={`dl ${l.type} ${i === cursor && (!targetSide || targetSide === cursorSide) ? 'cursor' : ''} ${selected.has(r.key) ? 'picked' : ''} ${(hunk ?? r.hunk) === cursorHunk ? 'active-hunk' : ''}`}
        onMouseDown={(e) => ctx.onLineMouseDown(e, i, targetSide)}
        onMouseEnter={() => ctx.onLineMouseEnter(i)}
      >
        <span className="gutter">
          {targetSide ? (
            <span className="ln">{(targetSide === 'old' ? l.oldNo : l.newNo) ?? ''}</span>
          ) : (
            <>
              <span className="ln">{l.oldNo ?? ''}</span>
              <span className="ln">{l.newNo ?? ''}</span>
            </>
          )}
          <span className="sign">{l.type === 'add' ? '+' : l.type === 'del' ? '-' : ''}</span>
        </span>
        {ctx.codeOf(r, !targetSide || targetSide === cursorSide)}
      </div>
    )
  }

  const renderHeader = (hi: number, index: number, key: string) => {
    const h = diff.hunks[hi]
    const patch = (reverse: boolean) => hunkPatch(diff, h, reverse)
    const gap = targetSide !== 'old' ? gaps.find((g) => g.before === hi) : undefined
    return (
      <div key={key} {...slot(index)} className={`hunk-slot ${hi > 0 ? 'gap' : ''}`}>
        <div className={`hunk-header ${hi === cursorHunk ? 'active-hunk' : ''}`}>
          {gap && <GapControls gap={gap} hunkCount={diff.hunks.length} onExpand={expand} />}
          <Tip label={h.header} focusable={false}>
            <span className="hunk-range">{h.header}</span>
          </Tip>
          {acts && targetSide !== 'old' && (
            <span className="hunk-actions">
              {acts.discard && (
                <Tip label="Discard this hunk" placement="top">
                  <button className="btn" tabIndex={-1} onClick={() => acts.discard!.run(patch(true))}>
                    {acts.discard.label}
                    {!targetSide && ' hunk'}
                  </button>
                </Tip>
              )}
              <Tip label={`${acts.primary.label} this hunk`} placement="top">
                <button className="btn primary" tabIndex={-1} onClick={() => acts.primary.run(patch(acts.primary.reverse))}>
                  {acts.primary.label}
                  {!targetSide && ' hunk'}
                </button>
              </Tip>
            </span>
          )}
        </div>
      </div>
    )
  }

  const renderFooter = (index: number, key: string) => {
    const gap = targetSide !== 'old' ? gaps.find((g) => g.before === diff.hunks.length) : undefined
    return (
      <div key={key} {...slot(index)} className="hunk-slot">
        <div className="hunk-header hunk-footer">{gap && <GapControls gap={gap} hunkCount={diff.hunks.length} onExpand={expand} />}</div>
      </div>
    )
  }

  const renderItem = (index: number) => {
    const item = items[index]
    if (!item) return null
    if (item.header) return renderHeader(item.hunk, index, item.key)
    if (item.footer) return renderFooter(index, item.key)
    if (targetSide) return renderLine(sideRows[item.pos!][targetSide], index, item.key, item.hunk)
    return renderLine(item.row!, index, item.key)
  }

  return (
    <div style={measure ? ctx.spacer : undefined}>
      {(measure ? ctx.windowed : items.map((_, i) => ({ index: i }))).map((v) => renderItem(v.index))}
    </div>
  )
}
