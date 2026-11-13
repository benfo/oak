/**
 * How added and removed lines are coloured everywhere they show (diff lines, word changes, status badges, line
 * counts). Standard keeps the theme's own red and green; colour-blind friendly swaps them for blue and orange, which
 * stay apart for the common red-green colour blindness, on top of any theme.
 */
export type DiffColours = 'standard' | 'blueOrange'

export const DIFF_COLOUR_OPTIONS: readonly { id: DiffColours; label: string }[] = [
  { id: 'standard', label: 'Standard (red and green)' },
  { id: 'blueOrange', label: 'Colour-blind friendly (blue and orange)' }
]

type DiffTokens = Record<
  'diff-add' | 'diff-add-gutter' | 'diff-add-foreground' | 'diff-del' | 'diff-del-gutter' | 'diff-del-foreground',
  string
>

/** The blue and orange tokens per theme base; tests/diff-colours.test.ts checks their contrast on every built-in theme. */
export const BLUE_ORANGE: Record<'light' | 'dark', DiffTokens> = {
  light: {
    'diff-add': 'rgba(84, 174, 255, 0.16)',
    'diff-add-gutter': 'rgba(84, 174, 255, 0.32)',
    'diff-add-foreground': '#0550ae',
    'diff-del': 'rgba(251, 143, 68, 0.16)',
    'diff-del-gutter': 'rgba(251, 143, 68, 0.34)',
    'diff-del-foreground': '#953800'
  },
  dark: {
    'diff-add': 'rgba(56, 139, 253, 0.16)',
    'diff-add-gutter': 'rgba(56, 139, 253, 0.32)',
    'diff-add-foreground': '#79c0ff',
    'diff-del': 'rgba(219, 109, 40, 0.16)',
    'diff-del-gutter': 'rgba(219, 109, 40, 0.34)',
    'diff-del-foreground': '#ffa657'
  }
}

/** The tokens to lay over the theme's, or none for Standard. */
export function diffColourTokens(choice: DiffColours, base: 'light' | 'dark'): Partial<DiffTokens> {
  return choice === 'blueOrange' ? BLUE_ORANGE[base] : {}
}
