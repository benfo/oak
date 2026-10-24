import { useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../api'
import type { RepoCtx } from '../useRepo'
import { confirmWithChoices, toast } from '../ui'
import * as act from '../actions'
import { lastOutputLine } from '../lib/output'
import { Elapsed, OutputLog } from '../components/OpStatus'
import { Icon } from '../components/Icon'
import { focusFiles, handleToolNavigation } from '../lib/navigation'
import { Tip } from '../components/Tip'
import { getSettings, updateSettings, useSettings } from '../settings'
import { handleShortcutBindings } from '../lib/shortcuts'
import { shortcutPlatform } from '../lib/useShortcuts'

const SLOW_AFTER_MS = 300

export function CommitBox({ r }: { r: RepoCtx }) {
  const { subjectLimit } = useSettings()
  const draftKey = `draft:${r.path}`
  const [message, setMessage] = useState(() => sessionStorage.getItem(draftKey) ?? '')
  const [amend, setAmend] = useState(false)
  const beforeAmend = useRef('')
  const prefilled = useRef<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  // Progress only appears if the commit is slow, so hook-less commits don't flash.
  const [slow, setSlow] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const st = r.status

  useEffect(() => {
    sessionStorage.setItem(draftKey, message)
  }, [message])

  // Pre-fill the merge message when a merge is waiting to be committed.
  // It is cleared again if the merge ends some other way (aborted, or committed by a pull or the terminal)
  // while the text is still the untouched pre-filled message.
  useEffect(() => {
    if (st?.state === 'merging') {
      if (message.trim()) return
      let stale = false
      api.mergeMessage(r.path).then((m) => {
        if (stale || !m) return
        prefilled.current = m
        setMessage((cur) => (cur.trim() ? cur : m))
      })
      return () => {
        stale = true
      }
    }
    const p = prefilled.current
    prefilled.current = null
    if (p) setMessage((cur) => (cur.trim() === p.trim() ? '' : cur))
  }, [st?.state])

  const toggleAmend = async (on: boolean) => {
    setAmend(on)
    if (on) {
      beforeAmend.current = message
      if (!message.trim()) {
        try {
          setMessage(await api.lastCommitMessage(r.path))
        } catch (e) {
          toast.error(errorMessage(e))
        }
      }
    } else if (!beforeAmend.current.trim()) setMessage('')
  }

  const hasStaged = !!st && st.staged.length > 0
  const merging = st?.state === 'merging'
  const conflicts = !!st && st.conflicted.length > 0
  const hasUnstaged = !!st && st.unstaged.length > 0
  const canCommit = !!message.trim() && !conflicts && (hasStaged || hasUnstaged || amend || merging) && !r.busy
  // Disabled buttons can't show tooltips, so explain in the box why committing isn't possible yet.
  const blocker = conflicts
    ? 'Resolve conflicts before committing.'
    : !(hasStaged || hasUnstaged || amend || merging)
      ? 'No changes to commit.'
      : !message.trim()
        ? 'Write a commit message.'
        : null

  // With nothing staged, Commit offers to stage the working changes first. Returns false when cancelled.
  const stageIfNeeded = async () => {
    if (hasStaged || amend || merging || !st) return true
    const tracked = st.unstaged.filter((f) => f.status !== '?').map((f) => f.path)
    const untracked = st.unstaged.filter((f) => f.status === '?').map((f) => f.path)
    const onlyNew = tracked.length === 0
    let includeNew = onlyNew
    if (!getSettings().autoStageOnCommit) {
      const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
      const choice = await confirmWithChoices({
        title: 'Nothing is staged',
        message: onlyNew
          ? `Only new files changed. Stage ${plural(untracked.length, 'new file', 'new files')} and commit?`
          : `Stage ${plural(tracked.length, 'changed file', 'changed files')} and commit?`,
        ok: 'Stage all & commit',
        checks: [
          ...(untracked.length && !onlyNew
            ? [{ id: 'untracked', label: `Include ${plural(untracked.length, 'new (untracked) file', 'new (untracked) files')}` }]
            : []),
          { id: 'auto', label: 'Don’t ask again (change in Preferences)' }
        ]
      })
      if (!choice) return false
      includeNew = onlyNew || !!choice.untracked
      if (choice.auto) updateSettings({ autoStageOnCommit: true })
    }
    try {
      await r.withBusy('Staging', () => api.stage(r.path, includeNew ? [...tracked, ...untracked] : tracked))
    } catch (e) {
      toast.error(errorMessage(e))
      return false
    }
    return true
  }

  const commit = async (andPush: boolean) => {
    if (!canCommit) return
    if (!(await stageIfNeeded())) return

    const subjectLine = message.trim().split('\n')[0]
    setFailure(null)
    setShowLog(false)
    setDone(null)
    setCommitting(true)
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    try {
      await r.withBusy(amend ? 'Amending' : 'Committing', () => api.commit(r.path, message.trim() + '\n', amend, getSettings().signoff))
    } catch (e) {
      // Keep the message; the status line shows the failure, with the full output under Details.
      setFailure(errorMessage(e))
      return
    } finally {
      clearTimeout(slowTimer)
      setSlow(false)
      setCommitting(false)
    }
    setMessage('')
    setAmend(false)
    setDone(`Committed “${subjectLine}”`)
    if (andPush) await act.push(r)
  }

  const subject = message.split('\n')[0]
  const head = !st?.head

  return (
    <div className="commit-box" data-pane-owner="message" onKeyDown={handleToolNavigation}>
      <textarea
        data-pane="message"
        aria-label="Commit message"
        value={message}
        readOnly={committing}
        aria-busy={committing}
        placeholder={hasStaged || hasUnstaged || amend || merging ? 'Commit message (Ctrl+Enter to commit)' : 'No changes to commit'}
        spellCheck
        onChange={(e) => {
          setMessage(e.target.value)
          setDone(null)
        }}
        onKeyDown={(e) => {
          handleShortcutBindings(
            e,
            [
              {
                id: 'commit',
                keys: 'Mod+Enter',
                allowInInput: true,
                enabled: canCommit,
                run: () => {
                  void commit(false)
                }
              },
              {
                id: 'commit-push',
                keys: 'Mod+Shift+Enter',
                allowInInput: true,
                enabled: canCommit,
                run: () => {
                  void commit(true)
                }
              },
              {
                id: 'leave-message',
                keys: 'Escape',
                allowInInput: true,
                run: () => {
                  focusFiles()
                }
              }
            ],
            { editing: true },
            shortcutPlatform()
          )
        }}
      />
      {/* A fixed-height status line: hints, progress and results swap in place, so nothing shifts. */}
      <div id="commit-status" className={`commit-status ${failure ? 'error' : done ? 'ok' : ''}`} role="status" aria-live="polite">
        {committing ? (
          slow &&
          r.op && (
            <>
              <span className="spinner" />
              <span className="status-text">
                <strong>
                  {amend ? 'Amending' : 'Committing'}… <Elapsed since={r.op.started} />
                </strong>{' '}
                <span className="mono">{lastOutputLine(r.op.output) || 'waiting for git'}</span>
              </span>
              <button className="link" onClick={() => setShowLog((s) => !s)} aria-expanded={showLog}>
                {showLog ? 'Hide output' : 'Output'}
              </button>
            </>
          )
        ) : failure ? (
          <>
            <Icon name="x" size={14} />
            <span className="status-text" title={failure}>
              <strong>Commit failed</strong> <span className="mono">{lastOutputLine(failure)}</span>
            </span>
            <button className="link" onClick={() => setShowLog((s) => !s)} aria-expanded={showLog}>
              {showLog ? 'Hide' : 'Details'}
            </button>
            <button className="link" onClick={() => (setFailure(null), setShowLog(false))}>
              Dismiss
            </button>
          </>
        ) : done ? (
          <>
            <Icon name="check" size={14} />
            <span className="status-text">{done}</span>
          </>
        ) : (
          blocker && (message.trim() || conflicts) && <span className="status-text muted">{blocker}</span>
        )}
      </div>
      {showLog && (committing ? r.op && <OutputLog text={r.op.output} /> : failure && <OutputLog text={failure} />)}
      <div className="commit-box-row">
        <label className="check" title={head ? 'Nothing to amend yet' : 'Replace the last commit'}>
          <input type="checkbox" checked={amend} disabled={head} onChange={(e) => toggleAmend(e.target.checked)} />
          Amend
        </label>
        <span
          className={`subject-len ${subjectLimit > 0 && subject.length > subjectLimit ? 'over' : ''}`}
          title={subjectLimit ? `Subject line length (guide: ${subjectLimit}, change in Preferences)` : 'Subject line length'}
        >
          {subject.length}
        </span>
        <span className="spacer" />
        <Tip label="Commit and push" keys="Ctrl+Shift+Enter" placement="top">
          <button className="btn" disabled={!canCommit} aria-describedby="commit-status" onClick={() => commit(true)}>
            Commit & Push
          </button>
        </Tip>
        <Tip label={amend ? 'Amend the last commit' : 'Commit'} keys="Ctrl+Enter" placement="top">
          <button
            className={`btn primary ${committing ? 'is-busy' : ''}`}
            disabled={!canCommit}
            aria-describedby="commit-status"
            onClick={() => commit(false)}
          >
            {amend ? 'Amend' : 'Commit'}
            <span className="btn-count">
              {committing ? <span className="spinner on-accent" /> : hasStaged && !amend ? st!.staged.length : null}
            </span>
          </button>
        </Tip>
      </div>
    </div>
  )
}
