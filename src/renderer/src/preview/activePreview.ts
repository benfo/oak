import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react'
import { createStore } from '../ui'

interface Entry {
  element: HTMLElement
  toggle: () => void
}

/** The Diff | Preview switches currently on screen (Changes and History can both be mounted, only one is shown). */
const switches = createStore<Entry[]>([])

/** A switch announces itself while it is mounted, so commands and shortcuts act on exactly the file being shown. */
export function useRegisterPreviewSwitch(element: RefObject<HTMLElement | null>, toggle: () => void) {
  const latest = useRef(toggle)
  useEffect(() => {
    latest.current = toggle
  })
  useEffect(() => {
    const el = element.current
    if (!el) return
    const entry: Entry = { element: el, toggle: () => latest.current() }
    switches.set([...switches.get(), entry])
    return () => switches.set(switches.get().filter((e) => e !== entry))
  }, [element])
}

const shown = () => switches.get().find((e) => e.element.getClientRects().length > 0)

/** The "Toggle preview" command: available only while a previewable file is being shown. */
export function usePreviewToggleCommand() {
  useSyncExternalStore(switches.subscribe, switches.get)
  const entry = shown()
  return { enabled: !!entry, toggle: () => shown()?.toggle() }
}
