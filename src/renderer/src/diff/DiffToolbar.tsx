import { useEffect, useRef, type ReactNode } from 'react'
import { Button, Menu, MenuItem, MenuTrigger, Popover, Toolbar } from 'react-aria-components'
import { toolbarHomeEnd } from '../lib/navigation'
import { Tip } from '../components/Tip'
import { MenuNavigation } from '../components/MenuNavigation'
import { Icon } from '../components/Icon'
import { changeDiffLayout } from './changeDiffLayout'
import { CONTEXT_STEPS, contextLabel, isFullContext } from './diffContext'
import { DIFF_LAYOUTS, type DiffLayout } from './diffLayout'
import { showLessContext, showMoreContext, toggleFullContext, useContextLines } from './useDiffContext'

interface Props {
  title: string
  metadata?: ReactNode
  files?: { index: number; count: number; onSelect: (index: number) => void }
  plain: boolean
  split: boolean
  diffLayout: DiffLayout | 'auto'
  changeCount: number
  /** 0-based hunk under the cursor. */
  currentChange: number
  singleChangeVisible: boolean
  counterEmpty: string
  moveFile: (direction: -1 | 1) => void
  jumpHunk: (delta: number) => void
}

/** File title with the file, change, context and layout controls. */
export function DiffToolbar({
  title,
  metadata,
  files,
  plain,
  split,
  diffLayout,
  changeCount,
  currentChange,
  singleChangeVisible,
  counterEmpty,
  moveFile,
  jumpHunk
}: Props) {
  const toolsRef = useRef<HTMLDivElement>(null)
  useEffect(() => toolbarHomeEnd(toolsRef.current), [])
  const context = useContextLines()
  const layoutLabel = DIFF_LAYOUTS.find((layout) => layout.id === diffLayout)!.label
  const navigationDisabled = !changeCount || (changeCount === 1 && singleChangeVisible)
  const onlyChange = changeCount === 1
  return (
    <div className="diff-title">
      <span className="diff-filename" title={title}>
        {title}
      </span>
      {metadata}
      <Toolbar className="diff-controls" aria-label="Diff tools" ref={toolsRef}>
        {files && (
          <span className="diff-navigation-group">
            <Tip label="Previous file" keys="Alt+PageUp">
              <Button className="icon-btn" aria-label="Previous file" isDisabled={files.index <= 0} onPress={() => moveFile(-1)}>
                <Icon name="chevronLeft" size={14} />
              </Button>
            </Tip>
            <span className="diff-counter" aria-label={`File ${files.index + 1} of ${files.count}`}>
              File {files.index + 1} of {files.count}
            </span>
            <Tip label="Next file" keys="Alt+PageDown">
              <Button
                className="icon-btn"
                aria-label="Next file"
                isDisabled={files.index < 0 || files.index >= files.count - 1}
                onPress={() => moveFile(1)}
              >
                <Icon name="chevronRight" size={14} />
              </Button>
            </Tip>
          </span>
        )}
        {!plain && (
          <>
            <span className="diff-navigation-group">
              <Tip label={onlyChange ? 'Reveal change' : 'Previous change'} keys="P">
                <Button
                  className="icon-btn"
                  aria-label={onlyChange ? 'Reveal change' : 'Previous change'}
                  isDisabled={navigationDisabled}
                  onPress={() => jumpHunk(-1)}
                >
                  <Icon name="arrowUp" size={14} />
                </Button>
              </Tip>
              <span
                className="diff-counter"
                aria-label={
                  changeCount
                    ? `Change ${currentChange + 1} of ${changeCount}${onlyChange && singleChangeVisible ? ', already visible' : ''}`
                    : 'No changes'
                }
                title={onlyChange && singleChangeVisible ? 'The only change is already visible' : undefined}
              >
                {changeCount ? `${currentChange + 1} of ${changeCount}` : counterEmpty}
              </span>
              <Tip label={onlyChange ? 'Reveal change' : 'Next change'} keys="N">
                <Button
                  className="icon-btn"
                  aria-label={onlyChange ? 'Reveal change' : 'Next change'}
                  isDisabled={navigationDisabled}
                  onPress={() => jumpHunk(1)}
                >
                  <Icon name="arrowDown" size={14} />
                </Button>
              </Tip>
            </span>
            <span className="diff-context-group">
              <Tip label="Show less context" keys="Ctrl+Shift+-">
                <Button
                  className="icon-btn"
                  aria-label="Show less context"
                  isDisabled={context <= CONTEXT_STEPS[0]}
                  onPress={showLessContext}
                >
                  <Icon name="minus" size={14} />
                </Button>
              </Tip>
              <span className="diff-context-value" aria-label={`Context: ${isFullContext(context) ? 'whole file' : `${context} lines`}`}>
                Context {contextLabel(context)}
              </span>
              <Tip label="Show more context" keys="Ctrl+Shift+=">
                <Button className="icon-btn" aria-label="Show more context" isDisabled={isFullContext(context)} onPress={showMoreContext}>
                  <Icon name="plus" size={14} />
                </Button>
              </Tip>
              <Tip label="Show the whole file" keys="Ctrl+Shift+W">
                <Button className="diff-full-button" aria-pressed={isFullContext(context)} onPress={toggleFullContext}>
                  Full file
                </Button>
              </Tip>
            </span>
            <MenuTrigger>
              <Tip label="Diff layout" keys="Ctrl+Shift+D">
                <Button
                  className="diff-layout-button"
                  aria-label={`Diff layout: ${layoutLabel}${diffLayout === 'auto' ? ` (currently ${split ? 'side by side' : 'inline'})` : ''}`}
                >
                  {layoutLabel}
                  <Icon name="chevronDown" size={12} />
                </Button>
              </Tip>
              <Popover className="menu-popover" placement="bottom end">
                <MenuNavigation>
                  <Menu
                    className="menu"
                    aria-label="Diff layout"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[diffLayout]}
                    onAction={(id) => changeDiffLayout(id as DiffLayout)}
                  >
                    {DIFF_LAYOUTS.map((layout) => (
                      <MenuItem key={layout.id} id={layout.id} className="menu-item row" textValue={layout.label}>
                        {({ isSelected }) => (
                          <>
                            <span className="menu-check">{isSelected && <Icon name="check" size={14} />}</span>
                            <span className="menu-label">{layout.label}</span>
                          </>
                        )}
                      </MenuItem>
                    ))}
                  </Menu>
                </MenuNavigation>
              </Popover>
            </MenuTrigger>
          </>
        )}
      </Toolbar>
    </div>
  )
}
