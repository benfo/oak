import { reopenUpdateNotice, useUpdateLater, useUpdateStatus } from '../updates'
import { StatusCard, StatusItem } from './StatusItem'

/** After "Later" on the update card, "Update ready" stays in the bar; a click brings the card back (it never installs by itself). */
export function UpdateStatusItem() {
  const s = useUpdateStatus()
  const later = useUpdateLater()
  if (s.state !== 'ready' || later !== s.version) return null
  return (
    <StatusItem
      onPress={reopenUpdateNotice}
      card={
        <StatusCard title={`Oak ${s.version} is ready`}>
          <div>Click to bring back the update prompt (Restart now, Release notes). It also installs when you close Oak.</div>
        </StatusCard>
      }
    >
      Update ready
    </StatusItem>
  )
}
