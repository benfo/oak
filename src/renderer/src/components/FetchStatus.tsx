import * as act from '../actions'
import { fullDate } from '../lib/format'
import { hasRemotes, remoteNames } from '../lib/remotes'
import { useLastFetched } from '../lib/useLastFetched'
import { useSettings } from '../settings'
import { autoFetchText } from '../../../shared/status'
import type { RepoCtx } from '../useRepo'
import { StatusCard, StatusItem } from './StatusItem'

/** "Fetched 3 minutes ago": a click fetches every remote, exactly like the toolbar's Fetch. */
export function FetchStatusItem({ r }: { r: RepoCtx }) {
  const { autoFetchMinutes } = useSettings()
  const fetched = useLastFetched(r.path, r.busy)
  const remotes = remoteNames(r.branches)
  if (!fetched) return null
  if (!hasRemotes(r))
    return <StatusItem card={<StatusCard title="No remotes">Add a remote to fetch and push.</StatusCard>}>No remotes</StatusItem>
  return (
    <StatusItem
      onPress={() => act.fetchAll(r)}
      inert={!!r.busy}
      card={
        <StatusCard title="Fetch all remotes" keys="Ctrl+Shift+F">
          <div>{fetched.at === null ? 'Never fetched in this repository' : `Last fetched ${fullDate(fetched.at)}`}</div>
          {remotes.length > 0 && <div>Remotes: {remotes.join(', ')}</div>}
          <div>{autoFetchText(autoFetchMinutes)}</div>
        </StatusCard>
      }
    >
      {fetched.text}
    </StatusItem>
  )
}
