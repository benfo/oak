import { Icon } from './Icon'
import { Tip } from './Tip'
import { getSettings, updateSettings, useSettings } from '../settings'

export const toggleChangesTree = () => updateSettings({ changesTree: !getSettings().changesTree })

/** Switches every changed-file list between a flat list and a folder tree. */
export function TreeToggle() {
  const { changesTree } = useSettings()
  return (
    <Tip label={changesTree ? 'Show as list' : 'Show as tree'} keys="V">
      <button className="icon-btn tree-toggle" aria-pressed={changesTree} aria-label="Show files as a tree" onClick={toggleChangesTree}>
        <Icon name="tree" size={14} />
      </button>
    </Tip>
  )
}
