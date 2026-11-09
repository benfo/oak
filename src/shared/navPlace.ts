/** A place the user can return to: a view plus the one thing that view was showing. */
export type NavPlace =
  { view: 'changes' } | { view: 'history'; commit: string | null } | { view: 'blame'; file: string; rev: string | null; line?: number }

export function samePlace(a: NavPlace, b: NavPlace): boolean {
  if (a.view !== b.view) return false
  if (a.view === 'history' && b.view === 'history') return a.commit === b.commit
  if (a.view === 'blame' && b.view === 'blame') return a.file === b.file && a.rev === b.rev
  return true
}

/** Back and Forward skip a commit that is no longer in the graph; the other places always exist. */
export function placeExists(place: NavPlace, commitExists: (hash: string) => boolean): boolean {
  return place.view !== 'history' || place.commit === null || commitExists(place.commit)
}
