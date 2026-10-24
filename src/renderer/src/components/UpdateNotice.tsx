import { useState } from 'react'
import { Button } from 'react-aria-components'
import { api } from '../api'
import { installUpdate, useUpdateStatus } from '../updates'

/**
 * Floats in the corner once a new version has downloaded (an overlay, so nothing shifts).
 * "Later" hides it until the next update; the update still installs when Oak closes.
 */
export function UpdateNotice() {
  const s = useUpdateStatus()
  const [dismissed, setDismissed] = useState('')
  if (s.state !== 'ready' || dismissed === s.version) return null
  return (
    <div className="update-notice" role="status">
      <div>
        <strong>Oak {s.version} is ready</strong>
        <div className="update-notice-hint">Restart to update, or it installs when you close Oak.</div>
      </div>
      <div className="update-notice-actions">
        <Button className="btn" onPress={() => api.openReleaseNotes(s.version)}>
          Release notes
        </Button>
        <button className="btn" onClick={() => setDismissed(s.version)}>
          Later
        </button>
        <button className="btn primary" onClick={installUpdate}>
          Restart now
        </button>
      </div>
    </div>
  )
}
