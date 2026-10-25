import { getSettings, updateSettings } from '../settings'

/** The one switch for drawing spaces and tabs, used by the diff toolbar, the blame header and the palette. */
export const toggleWhitespace = () => updateSettings({ showWhitespace: !getSettings().showWhitespace })
