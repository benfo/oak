import { Button } from 'react-aria-components'
import { Icon } from '../components/Icon'
import { Tip } from '../components/Tip'
import { toggleIgnoreWhitespace, useIgnoreWhitespace } from './useIgnoreWhitespace'

/** Always laid out, and only visible while the filter is on, so the toolbar keeps one width whatever the filter does. */
export function WhitespaceFilterIndicator() {
  const active = useIgnoreWhitespace()
  return (
    <span className="diff-filter-slot" data-active={active || undefined} inert={!active}>
      <Tip label="Show whitespace changes">
        <Button className="diff-full-button diff-filter" aria-label="Show whitespace changes" onPress={toggleIgnoreWhitespace}>
          Ignoring whitespace <Icon name="x" size={12} />
        </Button>
      </Tip>
    </span>
  )
}
