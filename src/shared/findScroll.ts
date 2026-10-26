/** The smallest horizontal movement that exposes a match, or its start if it cannot fit. */
export function findScrollDelta(left: number, right: number, start: number, end: number): number {
  if (right <= left) return 0
  if (end - start > right - left || start < left) return Math.floor(start - left)
  return end > right ? Math.ceil(end - right) : 0
}
