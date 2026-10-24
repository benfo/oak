/** HEAD reflog subjects arrive newest first. Commits and previews do not change checkout order. */
export function checkoutBranchNames(subjects: string): string[] {
  const names = new Set<string>()
  for (const line of subjects.split('\n')) {
    const match = /^checkout: moving from (\S+) to (\S+)\r?$/.exec(line)
    if (!match) continue
    // Destination was visited most recently; the source is useful even on the first switch.
    names.add(match[2])
    names.add(match[1])
  }
  return [...names]
}
