import { Button, Toolbar } from 'react-aria-components'
import { Icon } from '../components/Icon'
import { Tip } from '../components/Tip'
import { toggleWhitespace } from '../diff/toggleWhitespace'
import { useSettings } from '../settings'
import type { BlameCommit } from '../../../shared/blame'

interface Props {
  toolsRef: React.RefObject<HTMLDivElement | null>
  /** The cursor line's commit, which the step-back button acts on. */
  commit: BlameCommit | undefined
  hasLines: boolean
  findOpen: boolean
  canPrevBlock: boolean
  canNextBlock: boolean
  ignoreWhitespace: boolean
  /** Whether the repository has an ignore-revs list; the toggle only shows then. */
  hasIgnoreRevs: boolean
  useIgnoreRevs: boolean
  onFind: () => void
  /** The press's pointer type tells a click (hand focus back to the code) from a key press (keep it on the button). */
  onBlock: (delta: 1 | -1, pointer: string) => void
  onStepBack: (pointer: string) => void
  onIgnoreWhitespace: () => void
  onUseIgnoreRevs: () => void
  onClose: () => void
}

/** The header's buttons. Every key has one here, with the key in its tooltip. */
export function BlameToolbar(p: Props) {
  const { showWhitespace: whitespace } = useSettings()
  return (
    <Toolbar className="diff-controls" aria-label="Blame tools" ref={p.toolsRef}>
      <span className="diff-navigation-group">
        <Tip label="Find in file" keys="/">
          <Button className="icon-btn" aria-label="Find in file" aria-pressed={p.findOpen} isDisabled={!p.hasLines} onPress={p.onFind}>
            <Icon name="search" size={14} />
          </Button>
        </Tip>
        <Tip label="Previous commit block" keys="P">
          <Button
            className="icon-btn"
            aria-label="Previous commit block"
            isDisabled={!p.canPrevBlock}
            onPress={(e) => p.onBlock(-1, e.pointerType)}
          >
            <Icon name="arrowUp" size={14} />
          </Button>
        </Tip>
        <Tip label="Next commit block" keys="N">
          <Button
            className="icon-btn"
            aria-label="Next commit block"
            isDisabled={!p.canNextBlock}
            onPress={(e) => p.onBlock(1, e.pointerType)}
          >
            <Icon name="arrowDown" size={14} />
          </Button>
        </Tip>
        <Tip label={p.commit?.uncommitted ? 'Blame this line at HEAD' : 'Blame the line as it was before its commit'} keys="B">
          <Button
            className="icon-btn"
            aria-label="Blame before this commit"
            isDisabled={!p.commit || p.commit.boundary}
            onPress={(e) => p.onStepBack(e.pointerType)}
          >
            <Icon name="history" size={14} />
          </Button>
        </Tip>
      </span>
      <Tip label="Ignore whitespace changes">
        <Button className="diff-full-button" aria-pressed={p.ignoreWhitespace} onPress={p.onIgnoreWhitespace}>
          Ignore whitespace
        </Button>
      </Tip>
      {p.hasIgnoreRevs && (
        <Tip label="Skip the commits on the repository's ignore-revs list, such as bulk reformatting">
          <Button className="diff-full-button" aria-pressed={p.useIgnoreRevs} onPress={p.onUseIgnoreRevs}>
            Ignore bulk commits
          </Button>
        </Tip>
      )}
      <Tip label="Draw spaces and tabs">
        <Button className="diff-full-button" aria-pressed={whitespace} onPress={toggleWhitespace}>
          Spaces and tabs
        </Button>
      </Tip>
      <Tip label="Close blame">
        <Button className="icon-btn" aria-label="Close blame" onPress={p.onClose}>
          <Icon name="x" size={14} />
        </Button>
      </Tip>
    </Toolbar>
  )
}
