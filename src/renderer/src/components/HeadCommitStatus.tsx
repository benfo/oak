import { useEffect, useState } from 'react'
import { useHeadCommit } from '../lib/useHeadCommit'
import { fullDate } from '../lib/format'
import { VIEW_KEYS } from '../lib/viewShortcuts'
import type { Identity } from '../../../shared/identity'
import { isYou, tipCommitText } from '../../../shared/status'
import type { RepoCtx } from '../useRepo'
import { StatusCard, StatusItem } from './StatusItem'

const TICK_MS = 60_000

/** "You, 2 hours ago": who made the latest commit on this branch and when. A click shows it in History. */
export function HeadCommitStatusItem({
  r,
  identity,
  onOpenCommit
}: {
  r: RepoCtx
  identity: Identity | null
  onOpenCommit: (hash: string) => void
}) {
  const commit = useHeadCommit(r.path, r.status?.head)
  // The relative time keeps up with the clock without asking git again.
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [])
  if (!commit) return null
  const branch = r.status?.branch
  const email = identity?.email ?? null
  return (
    <StatusItem
      onPress={() => onOpenCommit(commit.hash)}
      card={
        <StatusCard title={branch ? `Latest commit on ${branch}` : 'Latest commit (HEAD)'} keys={VIEW_KEYS.history}>
          <div>{commit.subject}</div>
          <div>{isYou(commit, email) ? `You (${commit.author} <${commit.email}>)` : `${commit.author} <${commit.email}>`}</div>
          <div>
            {fullDate(commit.time * 1000)} · {commit.hash.slice(0, 7)}
          </div>
        </StatusCard>
      }
    >
      {tipCommitText(commit, email, now)}
    </StatusItem>
  )
}
