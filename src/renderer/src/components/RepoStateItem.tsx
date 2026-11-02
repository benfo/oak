import { displayKeys } from '../commands'
import { VIEW_KEYS } from '../lib/viewShortcuts'
import { repoStateText } from '../../../shared/status'
import type { RepoCtx } from '../useRepo'
import { StatusCard, StatusItem } from './StatusItem'

/** "Merging: 3 conflicts": an operation Git is part-way through is easy to forget; a click goes to Changes. */
export function RepoStateItem({ r, onOpenChanges }: { r: RepoCtx; onOpenChanges: () => void }) {
  const st = r.status
  const text = st && repoStateText(st.state, st.conflicted.length, st.rebaseStep)
  if (!text) return null
  return (
    <StatusItem
      attention
      onPress={onOpenChanges}
      card={
        <StatusCard title="Go to Changes" keys={VIEW_KEYS.changes}>
          <div>
            An operation is not finished. Resolve the conflicts there, then continue or abort it from the command palette (
            {displayKeys('Ctrl+Shift+P')}).
          </div>
        </StatusCard>
      }
    >
      {text}
    </StatusItem>
  )
}
