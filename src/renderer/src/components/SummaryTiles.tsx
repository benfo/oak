import { Icon, type IconName } from './Icon'

export interface SummaryTile {
  icon: IconName
  label: string
  /** The headline finding. */
  value: string
  detail: string
  /** Something here wants doing; otherwise the tile reads as fine. */
  attention: boolean
}

/** A row of at-a-glance findings, one tile per area. Tiles wrap when the row is too narrow. */
export function SummaryTiles({ tiles }: { tiles: SummaryTile[] }) {
  return (
    <ul className="summary-tiles">
      {tiles.map((tile) => (
        <li key={tile.label} className={`summary-tile ${tile.attention ? 'attention' : ''}`}>
          <span className="summary-tile-icon">
            <Icon name={tile.icon} size={16} />
          </span>
          <span className="summary-tile-label">{tile.label}</span>
          <span className="summary-tile-value">{tile.value}</span>
          <span className="summary-tile-detail">{tile.detail}</span>
        </li>
      ))}
    </ul>
  )
}
