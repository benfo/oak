import { Button, Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover, Separator } from 'react-aria-components'
import { Icon } from '../components/Icon'
import { Tip } from '../components/Tip'
import { MenuNavigation } from '../components/MenuNavigation'
import { useSettings } from '../settings'
import { changeDiffLayout } from './changeDiffLayout'
import { DIFF_LAYOUTS, type DiffLayout } from './diffLayout'
import { CONTEXT_STEPS, FULL_CONTEXT, isFullContext } from './diffContext'
import { setContextLines, useContextLines } from './useDiffContext'
import { toggleWhitespace } from './toggleWhitespace'
import { toggleIgnoreWhitespace, useIgnoreWhitespace } from './useIgnoreWhitespace'

/** Occasional display adjustments; navigation stays on the toolbar. */
export function DiffOptions() {
  const { diffLayout, showWhitespace } = useSettings()
  const context = useContextLines()
  const ignoreWhitespace = useIgnoreWhitespace()
  const whitespace = [...(showWhitespace ? ['markers'] : []), ...(ignoreWhitespace ? ['ignore'] : [])]
  const action = (key: string) => {
    if (key.startsWith('layout:')) changeDiffLayout(key.slice(7) as DiffLayout)
    else if (key.startsWith('context:')) setContextLines(Number(key.slice(8)))
    else if (key === 'markers') toggleWhitespace()
    else if (key === 'ignore') toggleIgnoreWhitespace()
  }
  const item = (id: string, label: string) => (
    <MenuItem id={id} key={id} className="menu-item row" textValue={label}>
      {({ isSelected }) => (
        <>
          <span className="menu-check">{isSelected && <Icon name="check" size={14} />}</span>
          <span className="menu-label">{label}</span>
        </>
      )}
    </MenuItem>
  )
  return (
    <MenuTrigger>
      <Tip label="Diff options">
        <Button className="icon-btn" aria-label="Diff options">
          <Icon name="options" size={16} />
        </Button>
      </Tip>
      <Popover className="menu-popover diff-options" placement="bottom end">
        <MenuNavigation>
          <Menu className="menu" aria-label="Diff options" onAction={(key) => action(String(key))}>
            <MenuSection selectionMode="single" selectedKeys={[`layout:${diffLayout}`]} disallowEmptySelection>
              <Header className="diff-options-heading">Layout</Header>
              {DIFF_LAYOUTS.map((layout) => item(`layout:${layout.id}`, layout.label))}
            </MenuSection>
            <Separator className="menu-separator" />
            <MenuSection selectionMode="single" selectedKeys={[`context:${context}`]} disallowEmptySelection>
              <Header className="diff-options-heading">Context</Header>
              {CONTEXT_STEPS.map((lines) => item(`context:${lines}`, `${lines} lines`))}
              {!CONTEXT_STEPS.includes(context) && !isFullContext(context) && item(`context:${context}`, `${context} lines`)}
              {item(`context:${FULL_CONTEXT}`, 'Full file')}
            </MenuSection>
            <Separator className="menu-separator" />
            <MenuSection aria-label="Whitespace" selectionMode="multiple" selectedKeys={whitespace}>
              {item('markers', 'Show spaces and tabs')}
              {item('ignore', 'Ignore whitespace changes')}
            </MenuSection>
          </Menu>
        </MenuNavigation>
      </Popover>
    </MenuTrigger>
  )
}
