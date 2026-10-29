import { useMemo } from 'react'
import { SideBySidePreview } from './SideBySidePreview'
import type { PreviewViewProps } from './types'

/** Loaded as an image, so scripts and external requests in the file never run. */
function svgDataUrl(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:image/svg+xml;base64,${btoa(binary)}`
}

function SvgImage({ bytes, fail }: { bytes: Uint8Array; fail: () => void }) {
  const src = useMemo(() => svgDataUrl(bytes), [bytes])
  return <img className="preview-image" src={src} alt="" onError={fail} />
}

export function SvgPreview({ before, after, onShowDiff }: PreviewViewProps) {
  return (
    <SideBySidePreview
      before={before}
      after={after}
      onShowDiff={onShowDiff}
      render={(bytes, fail) => <SvgImage bytes={bytes} fail={fail} />}
    />
  )
}
