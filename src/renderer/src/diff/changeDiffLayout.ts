import { updateSettings } from '../settings'
import type { DiffLayout } from './diffLayout'
import { preserveDiffViewport } from './diffViewport'

/** The shared entry point for explicit layout changes, preserving visible code and focus. */
export function changeDiffLayout(layout: DiffLayout) {
  preserveDiffViewport(() => updateSettings({ diffLayout: layout }))
}
