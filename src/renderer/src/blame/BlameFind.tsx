import { Button, Input, TextField } from 'react-aria-components'
import { Icon } from '../components/Icon'
import { Tip } from '../components/Tip'

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

/** Find in the blamed file, drawn over the top right of the view so the code never moves. */
export function BlameFind({ query, status, inputRef, onChange, onEnter, onClose }: Props) {
  return (
    <div className="blame-find" role="search">
      <TextField className="blame-find-field" aria-label="Find in file" value={query} onChange={onChange} autoFocus>
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
      <span className="blame-find-status" aria-live="polite">
        {status}
      </span>
      <Tip label="Close find" keys="Escape">
        <Button className="icon-btn" aria-label="Close find" onPress={onClose}>
          <Icon name="x" size={14} />
        </Button>
      </Tip>
    </div>
  )
}
