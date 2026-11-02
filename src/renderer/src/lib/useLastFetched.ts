import { api } from '../api'
import { fetchedText } from '../../../shared/status'
import { useRefreshed } from './useRefreshed'

/**
 * "Fetched 3 minutes ago" for a repository, with the exact time (null when it never fetched), or null
 * until it is known. Git's own record is re-read whenever an operation starts or ends and on the usual
 * schedule (see `useRefreshed`), so an automatic fetch (which is silent) and a fetch run in a terminal
 * both show up.
 */
export function useLastFetched(path: string, busy: string | null): { text: string; at: number | null } | null {
  const read = useRefreshed(async () => ({ at: await api.lastFetched(path), now: Date.now() }), [path, busy])
  return read && { text: fetchedText(read.at, read.now), at: read.at }
}
