import { VisuallyHidden } from 'react-aria-components'

/** Compact, contextual feedback inside the field; full messages remain accessible. */
export function SearchFeedback({
  id,
  query,
  count,
  position,
  boundary,
  loaded = false,
  label
}: {
  id: string
  query: string
  count: number
  position: number
  boundary: 'above' | 'below' | null
  loaded?: boolean
  label?: string
}) {
  const active = !!query.trim()
  const counter =
    position >= 0 ? `${position + 1} of ${count}${loaded ? ' loaded matches' : ''}` : `${count}${loaded ? ' loaded' : ''} matches`
  const scope = loaded ? ' in loaded history' : ''
  const message = !count
    ? `No matches${scope}`
    : boundary === 'below'
      ? `No further matches below${scope}`
      : boundary === 'above'
        ? `No earlier matches above${scope}`
        : ''
  const compact = !count
    ? 'No matches'
    : `${position >= 0 ? `${position + 1}/` : ''}${count}${loaded ? '+' : ''}${boundary ? (boundary === 'below' ? ' · End' : ' · Start') : ''}`
  return (
    <div
      id={id}
      className="search-feedback"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-notice={(active && !!message) || undefined}
      title={active ? [message, count > 0 ? counter : ''].filter(Boolean).join(' · ') : undefined}
    >
      {active && (
        <>
          <VisuallyHidden>{[label, message, count > 0 ? counter : ''].filter(Boolean).join('. ')}</VisuallyHidden>
          <span aria-hidden="true">{compact}</span>
        </>
      )}
    </div>
  )
}
