const CONVENTIONAL = ['main', 'master', 'develop']

/**
 * The branch a comparison should default to: the remote's default branch (origin/HEAD), then a
 * conventionally named local branch. The source itself is never its own target.
 */
export function chooseCompareTarget(remoteHead: string | null, localBranches: string[], source: string | null): string | null {
  const candidates = [remoteHead, ...CONVENTIONAL.filter((name) => localBranches.includes(name))]
  // origin/main is the same line as the local main, so it is no target for it either.
  const isSource = (name: string) => name === source || (name === remoteHead && name.slice(name.indexOf('/') + 1) === source)
  return candidates.find((name): name is string => !!name && !isSource(name)) ?? null
}
