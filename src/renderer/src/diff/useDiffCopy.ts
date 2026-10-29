import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { api, showMenu } from '../api'
import { toast } from '../ui'
import { remoteItem } from '../lib/remoteMenu'
import { copyFocused, copyDiffAsPatch, hasTextSelection } from '../lib/copy'
import type { FileDiff } from './diff'
import { copiedLabel, copiedPatch, copiedText, registerDiffCopy, type DiffCopySource } from './diffCopy'
import type { Row } from './diffTypes'

interface Options {
  diff: FileDiff | null
  rows: Row[]
  cursor: number
  selected: Set<string>
  ref: RefObject<HTMLDivElement | null>
  /** Adds "Open in editor" to the menu; called with the new-side line at the cursor. */
  openInEditor?: (line?: number) => void
  /** Adds "Open in browser" and a "Line link" copy item (History diffs); called with the new-side line at the cursor. */
  remote?: RemoteLineActions
}

/** What the diff line menu can do with the cursor line on the remote's website. */
export interface RemoteLineActions {
  open: (line?: number) => void
  copyLink: (line?: number) => void
  /** Asked when the menu opens: the file is new in an unpushed commit, so the remote has no page for it. */
  notOnRemote?: () => boolean
}

/** The new-side line number at a row: its own, else the next one in the hunk, else the last one before it (deleted lines have none). */
function newLineAt(diff: FileDiff, row: Row | undefined): number | undefined {
  if (!row) return undefined
  const lines = diff.hunks[row.hunk].lines
  for (let i = row.line; i < lines.length; i++) {
    const n = lines[i].newNo
    if (n != null) return n
  }
  for (let i = row.line - 1; i >= 0; i--) {
    const n = lines[i].newNo
    if (n != null) return n
  }
  return undefined
}

/** Copying the picked lines (or the cursor line) as text or a patch, and the menu offering it. */
export function useDiffCopy({ diff, rows, cursor, selected, ref, openInEditor, remote }: Options) {
  const copyLines = (patch: boolean) => {
    if (!diff) return
    const picked = rows.filter((r) => selected.has(r.key))
    const refs = (picked.length ? picked : rows[cursor] ? [rows[cursor]] : []).map((r) => ({ hunk: r.hunk, line: r.line }))
    const copied = patch ? copiedPatch(diff, refs) : copiedText(diff, refs)
    if (!copied) return void toast.info('Nothing to copy')
    void api.copyText(copied.text)
    toast.brief(copiedLabel(copied.lines, patch))
  }
  const copyRef = useRef(copyLines)
  copyRef.current = copyLines
  const copySource = useMemo<DiffCopySource>(() => ({ element: () => ref.current, copy: (patch) => copyRef.current(patch) }), [])
  useEffect(() => registerDiffCopy(copySource), [copySource])

  const showCopyMenu = async (viaKeyboard: boolean) => {
    const anchor = viaKeyboard ? (ref.current?.querySelector('.dl.cursor .gutter') ?? ref.current) : null
    const lines = selected.size > 0
    const notOnRemote = remote?.notOnRemote?.() ?? false
    const id = await showMenu(
      [
        ...(openInEditor ? [{ id: 'editor', label: 'Open in editor' }] : []),
        ...(remote ? [remoteItem('remote', 'Open in browser', notOnRemote)] : []),
        ...(openInEditor || remote ? [{ type: 'separator' as const }] : []),
        {
          label: 'Copy',
          submenu: [
            { id: 'copy', label: hasTextSelection() ? 'Selection' : lines ? 'Lines' : 'Line' },
            { id: 'patch', label: lines ? 'Lines as patch' : 'Line as patch' },
            ...(remote ? [remoteItem('copylink', 'Line link', notOnRemote)] : [])
          ]
        }
      ],
      anchor
    )
    if (id === 'copy') copyFocused()
    else if (id === 'patch') copyDiffAsPatch()
    else if (id === 'remote' && diff) remote?.open(newLineAt(diff, rows[cursor]))
    else if (id === 'copylink' && diff) remote?.copyLink(newLineAt(diff, rows[cursor]))
    else if (id === 'editor' && diff) openInEditor?.(newLineAt(diff, rows[cursor]))
  }

  return { copySource, showCopyMenu }
}
