import { useMemo } from 'react'
import { imageMimeType } from '../../../shared/fileKinds'
import { SideBySidePreview } from './SideBySidePreview'
import type { PreviewViewProps } from './types'

/** Loaded as an image, so scripts and external requests in an SVG never run. */
function imageDataUrl(bytes: Uint8Array, mime: string) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${mime};base64,${btoa(binary)}`
}

function Image({ bytes, mime, fail }: { bytes: Uint8Array; mime: string; fail: () => void }) {
  const src = useMemo(() => imageDataUrl(bytes, mime), [bytes, mime])
  return <img className="preview-image" src={src} alt="" onError={fail} />
}

/** Any format Chromium draws by itself (SVG, PNG, JPEG, GIF, WebP, AVIF, BMP, ICO), picked by the file's extension. */
export function ImagePreview({ path, before, after, onShowDiff }: PreviewViewProps) {
  const mime = imageMimeType(path) ?? 'application/octet-stream'
  return (
    <SideBySidePreview
      before={before}
      after={after}
      onShowDiff={onShowDiff}
      render={(bytes, fail) => <Image bytes={bytes} mime={mime} fail={fail} />}
    />
  )
}
