import { getSettings, updateSettings } from '../settings'
import { notify } from '../notices'
import { DIFF_COLOUR_OPTIONS } from './diffColours'

/** The palette's switch between standard and colour-blind friendly diff colours (Preferences sets it too). */
export function toggleDiffColours() {
  const next = getSettings().diffColours === 'standard' ? 'blueOrange' : 'standard'
  updateSettings({ diffColours: next })
  notify.info(`Diff colours: ${DIFF_COLOUR_OPTIONS.find((o) => o.id === next)!.label}`)
}
