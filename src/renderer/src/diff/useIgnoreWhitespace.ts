import { useSyncExternalStore } from 'react'
import { createStore } from '../ui'
import { preserveDiffViewport } from './diffViewport'

/** Review filter shared by every diff, deliberately reset when Oak starts. */
const store = createStore(false)
export const useIgnoreWhitespace = () => useSyncExternalStore(store.subscribe, store.get)
export function toggleIgnoreWhitespace() {
  // Revealing changes removes the indicator/empty-state button; keep its focus in the code.
  const opener = document.activeElement as HTMLElement | null
  if (opener?.closest('.diff-filter, .diff-empty')) {
    opener.closest('.diff-wrap')?.querySelector<HTMLElement>('[data-pane="diff"]')?.focus({ preventScroll: true })
  }
  preserveDiffViewport(() => store.set(!store.get()))
}
