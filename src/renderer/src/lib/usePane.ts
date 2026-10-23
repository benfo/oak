import { useMemo } from 'react'
import { useNavigation } from './useNavigation'
import { NavigationListLayout } from './NavigationListLayout'
import { handleToolNavigation } from './navigation'

/** Bind a pane's actual focus target and its surrounding tools to one identity.
 * Keep tabIndex, collection roles, refs and domain actions on the existing target:
 * React Aria owns collection focus; custom graph/diff panes own theirs.
 */
export function usePane(id: string, options: { kind?: 'list' | 'diff'; virtualized?: boolean } = {}) {
  const layout = useMemo(() => options.virtualized ? new NavigationListLayout() : undefined, [options.virtualized])
  const navigate = useNavigation({ kind: options.kind, withHalfPage: layout?.withHalfPage })
  const bindings = useMemo(() => ({
    targetProps: { 'data-pane': id },
    ownerProps: { 'data-pane-owner': id, onKeyDown: handleToolNavigation },
    // Attach at the adapter's DOM boundary; library components filter capture props.
    resetProps: { onBlurCapture: navigate.reset, onPointerDownCapture: navigate.reset }
  }), [id, navigate.reset])
  // Attach before surface-specific capture handlers, at the same boundary as before.
  return { ...bindings, navigate, layout }
}
