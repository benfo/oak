import type { ShortcutContext } from './shortcuts.ts'

export interface ShortcutEffects {
  revealsPanes?: boolean
  repositoryAction?: boolean
  requiresIdle?: boolean
}

export function shortcutBlockReason(effects: ShortcutEffects, context: ShortcutContext) {
  if (context.expanded && context.expanded !== 'standard') {
    if (effects.revealsPanes) return 'Restore panes with F11 to use this shortcut'
    if (effects.repositoryAction) return 'Use the command palette or restore panes with F11'
  }
  if (effects.requiresIdle && context.busy) return 'Wait for the current Git operation to finish'
}
