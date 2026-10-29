import type { ReactNode } from 'react'
import { FileIcon } from './FileIcon'
import { Icon } from './Icon'
import { folderStats, type ChangeRow } from '../lib/changeTree'

/** Same 16px slot as a folder's chevron, so file names line up with folder names. */
export const ChevronSpacer = () => <span className="row-chevron" aria-hidden="true" />

export function FolderChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <span className="row-chevron" aria-hidden="true">
      <Icon name={collapsed ? 'chevronRight' : 'chevronDown'} size={14} />
    </span>
  )
}

/**
 * Folder row content shared by History and Changes: chevron, name, file count, and (when collapsed)
 * the combined +/- counts of everything inside. `chevron` lets a list supply its own press target.
 */
export function FolderLabel<T extends object>({ row, collapsed, chevron }: { row: ChangeRow<T>; collapsed: boolean; chevron?: ReactNode }) {
  const withCounts = (row.files as { additions?: number | null; deletions?: number | null }[]).filter((f) => f.additions !== undefined)
  const stats = collapsed && withCounts.length ? folderStats(withCounts as { additions: number | null; deletions: number | null }[]) : null
  return (
    <>
      {chevron ?? <FolderChevron collapsed={collapsed} />}
      <FileIcon path={row.name} kind="folder" open={!collapsed} />
      <span className="file-name">{row.name}</span>
      <span className="folder-count">{row.files.length}</span>
      {stats && (
        <span className="numstat">
          <span className="add">+{stats.additions}</span> <span className="del">−{stats.deletions}</span>
        </span>
      )}
    </>
  )
}
