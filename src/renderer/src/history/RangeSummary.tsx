import type { RepoCtx } from '../useRepo'
import { checkRewrite, rewriteCommits } from '../rewriteActions'

/** Stands in for the commit details while a range is selected: what is selected, and the two ways to combine it. */
export function RangeSummary({ r, hashes }: { r: RepoCtx; hashes: readonly string[] }) {
  const subjects = new Map(r.commits.map((c) => [c.hash, c.subject]))
  const check = checkRewrite(r, [...hashes], 'fixup')
  const disabled = !check.ok || !!r.busy
  return (
    <div className="range-summary" role="region" aria-label="Selected commits">
      <div className="range-summary-head">
        <h3>{hashes.length} commits selected</h3>
        <div className="range-summary-actions">
          <button className="btn" disabled={disabled} onClick={() => void rewriteCommits(r, [...hashes], 'squash')}>
            Squash…
          </button>
          <button className="btn" disabled={disabled} onClick={() => void rewriteCommits(r, [...hashes], 'fixup')}>
            Fixup
          </button>
        </div>
      </div>
      <p className="range-summary-note">
        {check.ok
          ? 'Squash lets you edit the combined message. Fixup keeps the oldest commit’s message.'
          : `Can’t combine these commits: ${check.reason}`}
      </p>
      <ul className="range-summary-list" tabIndex={0} aria-label="Selected commits, newest first">
        {hashes.map((h) => (
          <li key={h} className="range-summary-row">
            <code>{h.slice(0, 8)}</code>
            <span>{subjects.get(h) ?? ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
