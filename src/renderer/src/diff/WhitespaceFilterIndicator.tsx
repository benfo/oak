import { Button } from 'react-aria-components'
import { Icon } from '../components/Icon'
import { Tip } from '../components/Tip'
import { toggleIgnoreWhitespace, useIgnoreWhitespace } from './useIgnoreWhitespace'

/** Reserved width keeps navigation fixed when the review filter changes. */
export function WhitespaceFilterIndicator() {
  const active = useIgnoreWhitespace()
  return (
    <span className="diff-filter-slot" data-active={active || undefined}>
      {active && (
        <Tip label="Show whitespace changes">
          <Button className="diff-full-button diff-filter" aria-label="Show whitespace changes" onPress={toggleIgnoreWhitespace}>
            Ignoring whitespace <Icon name="x" size={12} />
          </Button>
        </Tip>
      )}
    </span>
  )
}
