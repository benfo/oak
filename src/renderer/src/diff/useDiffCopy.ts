import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { api, showMenu } from '../api'
import { toast } from '../ui'
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
}

/** Copying the picked lines (or the cursor line) as text or a patch, and the menu offering it. */
export function useDiffCopy({ diff, rows, cursor, selected, ref }: Options) {
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
    const id = await showMenu(
      [
        { id: 'copy', label: hasTextSelection() ? 'Copy selection' : lines ? 'Copy lines' : 'Copy line' },
        { id: 'patch', label: lines ? 'Copy lines as patch' : 'Copy line as patch' }
      ],
      anchor
    )
    if (id === 'copy') copyFocused()
    else if (id === 'patch') copyDiffAsPatch()
  }

  return { copySource, showCopyMenu }
}
