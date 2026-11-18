import { useLayoutEffect, useRef } from 'react'
import type { Gap } from '../../../shared/diffExpand'
import type { FileDiff } from './diff'
import { captureDiffViewport } from './diffViewport'
import type { GapEdge } from './GapControls'

/**
 * Expanding context without moving what is on screen: revealed lines would push the cursor line down, so its place is
 * kept. The first expand loads the whole file before anything is revealed, so the place is restored when the gaps
 * actually change.
 */
export function useKeepExpand(diff: FileDiff | null, gaps: Gap[], expand: (key: number, edge: GapEdge) => void, cursorHunk: number) {
  const gapsKey = JSON.stringify(gaps)
  const pendingView = useRef<{ restore: () => boolean; gapsKey: string; timer: number } | null>(null)
  const keepExpand = (key: number, edge: GapEdge) => {
    if (pendingView.current) window.clearTimeout(pendingView.current.timer)
    const timer = window.setTimeout(() => (pendingView.current = null), 3000)
    pendingView.current = { restore: captureDiffViewport(true), gapsKey, timer }
    expand(key, edge)
  }
  useLayoutEffect(() => {
    const pending = pendingView.current
    if (!pending || pending.gapsKey === gapsKey || !pending.restore()) return
    window.clearTimeout(pending.timer)
    pendingView.current = null
    requestAnimationFrame(pending.restore)
  }, [gapsKey, diff])

  const expandAroundCursor = () => {
    for (const gap of gaps) {
      if (gap.before === cursorHunk) keepExpand(gap.key, 'up')
      else if (gap.before === cursorHunk + 1) keepExpand(gap.key, 'down')
    }
  }
  return { keepExpand, expandAroundCursor }
}
