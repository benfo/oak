import type { View } from '../components/RepoView'

/** Go-to-view shortcuts, shared by the commands and the tooltips of the collapsed sidebar rail. */
export const VIEW_KEYS: Record<View, string> = { changes: 'Ctrl+1', history: 'Ctrl+2', blame: 'Ctrl+3' }
