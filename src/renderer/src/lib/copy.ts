import { api } from '../api'
import { notify } from '../notices'
import { activeDiffCopy } from '../diff/diffCopy'
import { activeListCopy } from './listCopy'

const selectedText = () => window.getSelection()?.toString() ?? ''

export const hasTextSelection = () => selectedText() !== ''

/** Copies `text` and confirms with a toast, so every copy command gives the same feedback. */
export function copyText(text: string, what: string) {
  void api.copyText(text)
  notify.success(`Copied ${what}`)
}

/** Ctrl+C: the selected text if there is any, otherwise the focused diff's lines. */
export function copyFocused() {
  const text = selectedText()
  if (text) {
    void api.copyText(text)
    notify.success('Copied selection')
    return
  }
  const diff = activeDiffCopy()
  if (diff) return diff.copy(false)
  if (!copyListItem(false)) notify.info('Nothing to copy')
}

/** Ctrl+C / Ctrl+Shift+C on a focused list: the selection's primary or alternate copy (file paths, commit hash, ref name). */
export function copyListItem(alternate: boolean) {
  const source = activeListCopy()
  const item = alternate ? (source?.alternate ?? source?.primary)?.() : source?.primary()
  if (!item) return false
  copyText(item.text, item.what)
  return true
}

export function copyDiffAsPatch() {
  const diff = activeDiffCopy()
  if (diff) diff.copy(true)
  else notify.info('Nothing to copy')
}
