import { useEffect, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { Button } from 'react-aria-components'
import { api } from '../api'
import { createStore, Modal } from '../ui'
import { focusPane } from '../lib/navigation'
import { useUpdateStatus } from '../updates'
import { compareReleaseVersions, notesForRelease, RELEASE_VERSION_KEY, shouldShowReleaseNotice } from '../lib/releaseNotes'

const open = createStore<{ since?: string | null } | null>(null)
export const openWhatsNew = (since?: string | null) => open.set({ since })

// Capture before this launch can save a newly opened repository or preferences.
function previousUse() {
  try {
    return { version: localStorage.getItem(RELEASE_VERSION_KEY), existing: ['lastRepo', 'settings', 'theme'].some((key) => localStorage.getItem(key) !== null) }
  } catch {
    return { version: null, existing: false }
  }
}
const previous = previousUse()

export function WhatsNewHost() {
  const update = useUpdateStatus()
  const request = useSyncExternalStore(open.subscribe, open.get)
  const [version, setVersion] = useState('')
  const [notice, setNotice] = useState<{ version: string; since: string | null } | null>(null)
  useEffect(() => {
    let live = true
    api.releaseNotesContext().then((context) => {
      if (!live) return
      setVersion(context.version)
      if (!context.installed) return
      if (shouldShowReleaseNotice(context.version, previous.version, previous.existing)) setNotice({ version: context.version, since: previous.version })
      // Record once per installed version, without letting a downgrade reset the marker.
      if (previous.version === null || compareReleaseVersions(context.version, previous.version) === 1) {
        try { localStorage.setItem(RELEASE_VERSION_KEY, context.version) } catch { /* storage is best-effort */ }
      }
    }).catch(() => {})
    return () => { live = false }
  }, [])

  const readNotice = () => {
    const since = notice?.since
    flushSync(() => setNotice(null))
    // The notice button is removed; give the dialog a stable place to return focus to.
    focusPane('[data-pane="toolbar"] button') || focusPane('.welcome button')
    openWhatsNew(since)
  }
  const releases = notesForRelease(version, request?.since)
  return <>
    {notice && update.state !== 'ready' && <div className="update-notice" role="status">
      <div>
        <strong>Updated to Oak {notice.version}</strong>
        <div className="update-notice-hint">See the new features and fixes.</div>
      </div>
      <div className="update-notice-actions">
        <Button className="btn" onPress={() => setNotice(null)}>Dismiss</Button>
        <Button className="btn primary" onPress={readNotice}>See what’s new</Button>
      </div>
    </div>}
    {request && version && <Modal title="What’s new in Oak" onClose={() => open.set(null)} width={620}>
      <div className="release-notes">
        {releases.length ? releases.map((release) => <section key={release.version} className="release-section">
          <h3>Oak {release.version}</h3>
          {release.highlights.map((highlight) => <div className="release-highlight" key={highlight.title}>
            <h4>{highlight.title}</h4><p>{highlight.text}</p>
          </div>)}
          {!!release.fixes.length && <><h4>Fixes</h4><ul>{release.fixes.map((fix) => <li key={fix}>{fix}</li>)}</ul></>}
        </section>) : <p>Release notes for Oak {version} are available on GitHub.</p>}
      </div>
      <div className="modal-actions">
        <Button className="btn" onPress={() => api.openReleaseNotes()}>All release notes on GitHub</Button>
        <Button className="btn primary" onPress={() => open.set(null)} autoFocus>Done</Button>
      </div>
    </Modal>}
  </>
}
