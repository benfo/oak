import { useEffect, useState, useSyncExternalStore } from 'react'
import { PROGRESS_DELAY_MS, RESULT_MS } from '../../../shared/status'
import { barMounted, dismissNotice, noticeStore, type Notice } from '../notices'
import type { RepoCtx } from '../useRepo'
import { Elapsed, showOutput } from './OpStatus'
import { Tip } from './Tip'
import { useIdentity } from '../lib/useIdentity'
import { FetchStatusItem } from './FetchStatus'
import { HeadCommitStatusItem } from './HeadCommitStatus'
import { IdentityStatusItem } from './IdentityStatus'
import { RepoStateItem } from './RepoStateItem'
import { UpdateStatusItem } from './UpdateStatusItem'
import { ZoomItem } from './ZoomItem'

/** True once an operation has run long enough to deserve progress; quick ones show only their result. */
function useDelayedProgress(r: RepoCtx) {
  const [shown, setShown] = useState(false)
  const started = r.op?.started
  useEffect(() => {
    if (!r.busy || started === undefined) return setShown(false)
    const timer = setTimeout(() => setShown(true), Math.max(0, PROGRESS_DELAY_MS - (Date.now() - started)))
    return () => clearTimeout(timer)
  }, [r.busy, started])
  return shown && !!r.busy && !!r.op
}

/** The newest bar notice; it clears itself after a few seconds, but never while the pointer or focus is on it. */
function useLatestResult(): { notice: Notice | undefined; hold: (held: boolean) => void } {
  const notices = useSyncExternalStore(noticeStore.subscribe, noticeStore.get)
  const [held, hold] = useState(false)
  const notice = notices.filter((n) => n.surface === 'bar').at(-1)
  const id = notice?.id
  useEffect(() => {
    if (id === undefined || held) return
    const timer = setTimeout(() => dismissNotice(id), RESULT_MS)
    return () => clearTimeout(timer)
  }, [id, held])
  return { notice, hold }
}

/** What is happening now (a running operation), else what just happened. Clicking opens the git output. */
function StatusMessage({ r }: { r: RepoCtx }) {
  const progress = useDelayedProgress(r)
  const { notice, hold } = useLatestResult()
  const content = progress ? (
    <>
      <span className="spinner" />
      <span className="status-text">
        {r.busy}…{' '}
        <span aria-hidden="true">
          <Elapsed since={r.op!.started} />
        </span>
      </span>
    </>
  ) : notice ? (
    <span className="status-text">{notice.text}</span>
  ) : null
  return (
    // The live region stays mounted so a screen reader announces each change; it is not a Tab stop (see AGENTS.md).
    <div className="status-message" role="status" aria-live="polite">
      {content && (
        <Tip label="Show git output" placement="top" focusable={false}>
          <button
            className="status-button"
            tabIndex={-1}
            onClick={showOutput}
            onMouseEnter={() => hold(true)}
            onMouseLeave={() => hold(false)}
          >
            {content}
          </button>
        </Tip>
      )}
    </div>
  )
}

/** A fixed-height strip: progress and results on the left, repository facts on the right. */
export function StatusBar({
  r,
  onOpenChanges,
  onOpenCommit
}: {
  r: RepoCtx
  onOpenChanges: () => void
  onOpenCommit: (hash: string) => void
}) {
  // Read once here: two items show it.
  const identity = useIdentity(r.path)
  useEffect(() => {
    barMounted.set(true)
    return () => barMounted.set(false)
  }, [])
  return (
    <footer className="status-bar" aria-label="Status">
      <StatusMessage r={r} />
      <RepoStateItem r={r} onOpenChanges={onOpenChanges} />
      <IdentityStatusItem id={identity} />
      <FetchStatusItem r={r} />
      <HeadCommitStatusItem r={r} identity={identity} onOpenCommit={onOpenCommit} />
      <UpdateStatusItem />
      <ZoomItem />
    </footer>
  )
}
