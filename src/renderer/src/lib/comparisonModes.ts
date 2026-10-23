export interface ComparisonRelation {
  /** Commits on the target that the compared commit lacks. */
  ahead: number
}

const commits = (n: number) => `${n} newer commit${n === 1 ? '' : 's'}`

export function comparisonSummary(target: string, mode: 'changes' | 'snapshots', relation: ComparisonRelation | null): string {
  if (mode === 'snapshots') return 'No single common ancestor, showing the difference between both tips'
  return relation && relation.ahead > 0
    ? `Changes since the common ancestor (${target}'s ${commits(relation.ahead)} ${relation.ahead === 1 ? 'is' : 'are'} not shown)`
    : 'Committed changes introduced since the common ancestor'
}
