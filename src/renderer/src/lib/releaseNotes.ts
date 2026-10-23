import notes from '../../../shared/releases.json' with { type: 'json' }

export const RELEASE_NOTES = notes
export const RELEASE_VERSION_KEY = 'release-notes:last-version'

/** Oak's public releases use stable major.minor.patch versions. Ignore unknown version formats. */
export function compareReleaseVersions(a: string, b: string): number | null {
  if (!/^\d+\.\d+\.\d+$/.test(a) || !/^\d+\.\d+\.\d+$/.test(b)) return null
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return Math.sign(left[i] - right[i])
  return 0
}

/** Missing version + existing settings/repository is an upgrade from a pre-notice Oak build. */
export function shouldShowReleaseNotice(version: string, previous: string | null, existingUser: boolean): boolean {
  if (!notes.some((note) => note.version === version)) return false
  return previous === null ? existingUser : compareReleaseVersions(version, previous) === 1
}

/** A manual visit shows the latest installed notes; an update also includes skipped releases. */
export function notesForRelease(version: string, since?: string | null) {
  const eligible = notes.filter((note) => {
    const order = compareReleaseVersions(note.version, version)
    return order !== null && order <= 0 && (!since || compareReleaseVersions(note.version, since) === 1)
  })
  return since ? eligible : eligible.slice(0, 1)
}
