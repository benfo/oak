/** Reveal a match with an inset, reducing the inset for wide matches and exposing the start if it cannot fit. */
export function findScrollDelta(left: number, right: number, start: number, end: number, inset = 0): number {
  if (right <= left) return 0
  const gap = Math.max(0, Math.min(inset, (right - left - (end - start)) / 2))
  left += gap
  right -= gap
  if (end - start > right - left || start < left) return Math.floor(start - left)
  return end > right ? Math.ceil(end - right) : 0
}
