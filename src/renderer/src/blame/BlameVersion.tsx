import { Button } from 'react-aria-components'
import { Tip } from '../components/Tip'

/** A version of the file older than the one Blame opened on, reached by stepping back from a line's commit. */
export interface BlameStep {
  file: string
  rev: string
  /** The commit this version precedes; null when it is HEAD, reached from a line that is not committed yet. */
  before: { hash: string; summary: string } | null
  /** The line the cursor was on in the newer version, to go back to. */
  returnTo: number
}

/** Says the code is not the current file, with the way back. It sits in the header, whose height never changes. */
export function BlameVersion({ steps, onNewer }: { steps: BlameStep[]; onNewer: () => void }) {
  const last = steps[steps.length - 1]
  if (!last) return null
  const where = last.before ? `Before ${last.before.hash.slice(0, 7)}, ${last.before.summary}` : 'At HEAD, before your changes'
  const depth = steps.length > 1 ? ` (${steps.length} steps back)` : ''
  return (
    <span className="blame-past" role="status">
      <span className="blame-past-text" title={`${where}${depth}`}>
        {where}
        {depth}
      </span>
      <Tip label="Back to the newer blame" keys="Backspace">
        <Button className="diff-full-button" onPress={onNewer}>
          Back to newer
        </Button>
      </Tip>
    </span>
  )
}
