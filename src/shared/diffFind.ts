/** Locate a source line in a diff: prefer After, falling back to Before for a deleted file. */
export function diffFindLine(lines: readonly { oldNo: number | null; newNo: number | null }[], query: string) {
  const match = /^:\s*(\d+)\s*$/.exec(query)
  if (!match) return null
  const number = Math.max(1, Number(match[1]))
  const after = lines.some((line) => line.newNo !== null)
  const row = lines.findIndex((line) => (after ? line.newNo : line.oldNo) === number)
  return row < 0 ? null : { row, label: `${number}${after ? '' : ' (Before)'}` }
}
