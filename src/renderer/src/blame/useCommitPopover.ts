import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { api } from '../api'
import type { BlameCommit } from '../../../shared/blame'

interface Options {
  repo: string
  /** The cursor line's commit. */
  commit: BlameCommit | undefined
  /** Whether the view is showing; the popover is portalled, so it must not outlive that. */
  active: boolean
  scrollerRef: React.RefObject<HTMLDivElement | null>
}

/** The full-message popover for the cursor line's commit: open state, the message (read on demand and kept), and the row it hangs from. */
export function useCommitPopover({ repo, commit, active, scrollerRef }: Options) {
  const [open, setOpen] = useState(false)
  /** Full messages by commit hash; a commit never changes, so entries stay (null: could not be read). */
  const messages = useRef(new Map<string, string | null>())
  const [, messagesChanged] = useReducer((n: number) => n + 1, 0)
  /** The cursor row's code. Held in state because Aria reads the element while rendering, so a ref would reposition one move late. */
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  // Runs before paint, so the popover is placed on the new row in the same frame the cursor moves to it.
  useLayoutEffect(() => {
    setAnchor(open ? (scrollerRef.current?.querySelector<HTMLElement>('.blame-row.cursor .code') ?? null) : null)
  })

  const wanted = open && commit && !commit.uncommitted ? commit.hash : null
  useEffect(() => {
    if (!wanted || messages.current.has(wanted)) return
    api
      .commitMessage(repo, wanted)
      .then(
        (text) => messages.current.set(wanted, text),
        () => messages.current.set(wanted, null)
      )
      .then(messagesChanged)
  }, [wanted])

  useEffect(() => {
    if (!active) setOpen(false)
  }, [active])
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element
      if (!scrollerRef.current?.contains(target) && !target.closest('.commit-popover, .blame-preview')) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  return { open, setOpen, anchor, message: (hash: string) => messages.current.get(hash) }
}
