import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import { sameVersions, type FileVersions, type PreviewSource } from '../../../shared/filePreview'

/**
 * Both sides of the file for `source`, loaded only while `enabled`. `reloadKey` (the diff text) reloads the same file
 * after a change; the old versions stay on screen until the new ones arrive, and are dropped when the file changes.
 */
export function useFileVersions(repo: string, source: PreviewSource | undefined, enabled: boolean, reloadKey: unknown) {
  const sourceKey = source ? JSON.stringify(source) : null
  const [loaded, setLoaded] = useState<{ key: string; versions: FileVersions } | null>(null)
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null)
  useEffect(() => {
    if (!enabled || !source || !sourceKey) return
    let cancelled = false
    api
      .fileVersions(repo, source)
      .then((versions) => {
        if (cancelled) return
        setFailed(null)
        setLoaded((prev) => (prev?.key === sourceKey && sameVersions(prev.versions, versions) ? prev : { key: sourceKey, versions }))
      })
      .catch((e) => !cancelled && setFailed({ key: sourceKey, message: errorMessage(e) }))
    return () => {
      cancelled = true
    }
  }, [repo, sourceKey, enabled, reloadKey])
  return {
    versions: loaded?.key === sourceKey ? loaded.versions : null,
    error: failed?.key === sourceKey ? failed.message : null
  }
}
