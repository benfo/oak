interface Scroller {
  scrollLeft: number
  scrollTop: number
  scrollWidth: number
  clientWidth: number
  scrollHeight: number
  clientHeight: number
}

const within = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(0, max))

/** Where `target` goes to follow `source`: the same offsets, held to what `target` itself can scroll (the shorter side stops at its end). */
export function followedPosition(source: Pick<Scroller, 'scrollLeft' | 'scrollTop'>, target: Scroller) {
  return {
    left: within(source.scrollLeft, target.scrollWidth - target.clientWidth),
    top: within(source.scrollTop, target.scrollHeight - target.clientHeight)
  }
}

/** Whether two offsets are the same position, allowing for the sub-pixel rounding of fractional zoom. */
export const samePosition = (a: number, b: number) => Math.abs(a - b) < 1
