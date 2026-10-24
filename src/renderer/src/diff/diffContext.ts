/** `git diff -U` large enough to include the whole file. */
export const FULL_CONTEXT = 1_000_000

export const CONTEXT_STEPS = [3, 6, 12, 25, 50, 100]

export const isFullContext = (context: number) => context >= FULL_CONTEXT

/** The next larger step, ending at the whole file. */
export function moreContext(current: number): number {
  return CONTEXT_STEPS.find((step) => step > current) ?? FULL_CONTEXT
}

/** The next smaller step; the whole file steps back to the largest one. */
export function lessContext(current: number): number {
  if (isFullContext(current)) return CONTEXT_STEPS[CONTEXT_STEPS.length - 1]
  return [...CONTEXT_STEPS].reverse().find((step) => step < current) ?? current
}

export const contextLabel = (context: number) => (isFullContext(context) ? 'Full' : String(context))
