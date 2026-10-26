import { useEffect, useMemo } from 'react'
import { displayKeys } from '../commands'
import { fuzzyPositions } from '../lib/fuzzy'
import { Icon } from './Icon'
import type { PaletteItem } from './Palette'

export function PaletteRow({
  item,
  text,
  query,
  commands,
  showChecks,
  showCategories,
  recent,
  focused,
  onHighlight
}: {
  item: PaletteItem
  text: string
  query: string
  commands: boolean
  showChecks: boolean
  showCategories: boolean
  recent: boolean
  focused: boolean
  onHighlight?: (id: string) => void
}) {
  useEffect(() => {
    if (focused) onHighlight?.(item.id)
  }, [focused])

  const hits = useMemo(() => (query ? fuzzyPositions(query, text) : new Set<number>()), [query, text])
  const shortcut = item.hint ? <kbd>{displayKeys(item.hint)}</kbd> : null
  return (
    <div className="palette-row">
      {showChecks && <span className="palette-check">{item.current && <Icon name="check" size={14} />}</span>}
      <span className="palette-label">
        <Highlighted text={item.label} hits={hits} offset={item.category ? item.category.length + 2 : 0} />
      </span>
      {item.badges?.map((b) => (
        <span key={b.text} className={`pill ${b.warn ? 'warn' : ''}`}>
          {b.text}
        </span>
      ))}
      {item.detail && <span className="palette-detail">{item.detail}</span>}
      {recent && <span className="palette-recent">recent</span>}
      {showCategories && (
        <span className="palette-category">
          <Highlighted text={item.category ?? ''} hits={hits} />
        </span>
      )}
      {commands ? <span className="palette-shortcut">{shortcut}</span> : shortcut}
    </div>
  )
}

/** Highlight only the visible label, while ranking continues to use the full searchable text. */
function Highlighted({ text, hits, offset = 0 }: { text: string; hits: Set<number>; offset?: number }) {
  return (
    <>
      {[...text].map((ch, i) => (
        <span key={i} className={hits.has(i + offset) ? 'hit' : undefined}>
          {ch}
        </span>
      ))}
    </>
  )
}
