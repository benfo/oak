import { Button, Input, TextField } from 'react-aria-components'
import { Icon } from './Icon'
import { Tip } from './Tip'

interface Props {
  query: string
  /** "3 of 12", "No matches", or what a ":120" query will do. */
  status: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onChange: (query: string) => void
  /** Enter goes to the next match (Shift+Enter, the previous); for a ":120" query it goes to the line and closes. */
  onEnter: (backwards: boolean) => void
  onClose: () => void
}

/** The find bar for a code view (see useFindInFile): drawn over the top right of the nearest positioned ancestor, so the code never moves. */
export function FindBar({ query, status, inputRef, onChange, onEnter, onClose }: Props) {
  // A ":120" query goes to a line, so stepping does not apply; the buttons stay (disabled) so the bar never changes size.
  const goto = query.startsWith(':')
  return (
    <div className="find-bar" role="search">
      <TextField className="find-bar-field" aria-label="Find in file" value={query} onChange={onChange} autoFocus>
        <Input
          ref={inputRef}
          placeholder="Find, or :120 for a line"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            } else if (e.key === 'Enter') {
              e.preventDefault()
              onEnter(e.shiftKey)
            }
          }}
        />
      </TextField>
      <span className="find-bar-status" aria-live="polite">
        {status}
      </span>
      <>
        <Tip label="Previous match" keys="Shift+Enter">
          <Button
            className="icon-btn"
            aria-label="Previous match"
            isDisabled={goto}
            onPress={(e) => {
              onEnter(true)
              // A click hands focus back to the box so typing continues; from the keyboard the button keeps it, so Enter can repeat.
              if (e.pointerType === 'mouse' || e.pointerType === 'touch') inputRef.current?.focus()
            }}
          >
            <Icon name="arrowUp" size={14} />
          </Button>
        </Tip>
        <Tip label="Next match" keys="Enter">
          <Button
            className="icon-btn"
            aria-label="Next match"
            isDisabled={goto}
            onPress={(e) => {
              onEnter(false)
              if (e.pointerType === 'mouse' || e.pointerType === 'touch') inputRef.current?.focus()
            }}
          >
            <Icon name="arrowDown" size={14} />
          </Button>
        </Tip>
      </>
      <Tip label="Close find" keys="Escape">
        <Button className="icon-btn" aria-label="Close find" onPress={onClose}>
          <Icon name="x" size={14} />
        </Button>
      </Tip>
    </div>
  )
}
