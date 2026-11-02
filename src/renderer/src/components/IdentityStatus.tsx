import { identityBarText, identityLabel, type Identity } from '../../../shared/identity'
import { openPreferences } from './Preferences'
import { StatusCard, StatusItem } from './StatusItem'

/**
 * Who commits here, shown only when it is worth a look: no identity at all, or one set for this
 * repository alone (so a work repository does not quietly commit as a personal name). A click opens
 * Git settings, where it is set.
 */
export function IdentityStatusItem({ id }: { id: Identity | null }) {
  const text = id && identityBarText(id)
  if (!id || !text) return null
  return (
    <StatusItem attention={id.missing} onPress={() => openPreferences('git')} card={<IdentityCard id={id} />}>
      {text}
    </StatusItem>
  )
}

function IdentityCard({ id }: { id: Identity }) {
  return (
    <StatusCard title="Git identity" keys="Ctrl+,">
      {id.missing ? (
        <div>Commits need both a name and an email. Click to set them in Git settings.</div>
      ) : (
        <>
          <div>Commits here are by {identityLabel(id.name, id.email)}.</div>
          <div>
            This repository sets its own identity
            {id.global.name || id.global.email ? `, instead of the global ${identityLabel(id.global.name, id.global.email)}` : ''}.
          </div>
        </>
      )}
    </StatusCard>
  )
}
