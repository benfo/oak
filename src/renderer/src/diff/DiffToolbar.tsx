import { useEffect, useRef, type ReactNode } from 'react'
import { Button, Toolbar } from 'react-aria-components'
import { toolbarHomeEnd } from '../lib/navigation'
import { Tip } from '../components/Tip'
import { Icon } from '../components/Icon'
import { DiffOptions } from './DiffOptions'
import { WhitespaceFilterIndicator } from './WhitespaceFilterIndicator'
import { DiffNavigationGroup } from './DiffNavigationGroup'

interface Props {
  leading?: ReactNode
  title: string
  metadata?: ReactNode
  files?: { index: number; count: number; onSelect: (index: number) => void }
  plain: boolean
  changeCount: number
  /** 0-based hunk under the cursor. */
  currentChange: number
  singleChangeVisible: boolean
  counterEmpty: string
  moveFile: (direction: -1 | 1) => void
  jumpHunk: (delta: number) => void
  onFind: () => void
  findOpen: boolean
  canFind: boolean
  /** Leads the tools, e.g. the Diff | Preview switch of a previewable file. */
  modeToggle?: ReactNode
  /** Showing a preview instead of the diff: the diff-only tools stay in place, hidden, so nothing around them moves. */
  previewing?: boolean
}

/** File title with the file, change, context and layout controls. */
export function DiffToolbar({
  leading,
  title,
  metadata,
  files,
  plain,
  changeCount,
  currentChange,
  singleChangeVisible,
  counterEmpty,
  moveFile,
  jumpHunk,
  onFind,
  findOpen,
  canFind,
  modeToggle,
  previewing = false
}: Props) {
  const toolsRef = useRef<HTMLDivElement>(null)
  useEffect(() => toolbarHomeEnd(toolsRef.current), [])
  const navigationDisabled = !changeCount || (changeCount === 1 && singleChangeVisible)
  const onlyChange = changeCount === 1
  return (
    <div className="diff-title">
      {leading}
      <Tip label={title} focusable={false}>
        <span className="diff-filename">{title}</span>
      </Tip>
      {metadata}
      {!plain && <WhitespaceFilterIndicator hidden={previewing} />}
      <Toolbar className="diff-controls" aria-label="Diff tools" ref={toolsRef}>
        {modeToggle}
        <Tip label="Find in file" keys="/ or Ctrl+F">
          <Button className="icon-btn" aria-label="Find in file" aria-pressed={findOpen} isDisabled={!canFind} onPress={onFind}>
            <Icon name="search" size={14} />
          </Button>
        </Tip>
        {files && files.count > 1 && (
          <DiffNavigationGroup
            previous={{
              label: 'Previous file',
              keys: 'Alt+PageUp',
              icon: 'chevronLeft',
              disabled: files.index <= 0,
              run: () => moveFile(-1)
            }}
            next={{
              label: 'Next file',
              keys: 'Alt+PageDown',
              icon: 'chevronRight',
              disabled: files.index < 0 || files.index >= files.count - 1,
              run: () => moveFile(1)
            }}
          >
            <span className="diff-counter" aria-label={`File ${files.index + 1} of ${files.count}`}>
              File {files.index + 1} of {files.count}
            </span>
          </DiffNavigationGroup>
        )}
        {!plain && (
          <div className="diff-tools-reserved" data-hidden={previewing || undefined} inert={previewing}>
            <DiffNavigationGroup
              previous={{
                label: onlyChange ? 'Reveal change' : 'Previous change',
                keys: 'P',
                icon: 'arrowUp',
                disabled: navigationDisabled,
                run: () => jumpHunk(-1)
              }}
              next={{
                label: onlyChange ? 'Reveal change' : 'Next change',
                keys: 'N',
                icon: 'arrowDown',
                disabled: navigationDisabled,
                run: () => jumpHunk(1)
              }}
            >
              <Tip label={onlyChange && singleChangeVisible ? 'The only change is already visible' : undefined} focusable={false}>
                <span
                  className="diff-counter"
                  aria-label={
                    changeCount
                      ? `Change ${currentChange + 1} of ${changeCount}${onlyChange && singleChangeVisible ? ', already visible' : ''}`
                      : 'No changes'
                  }
                >
                  {changeCount ? `${currentChange + 1} of ${changeCount}` : counterEmpty}
                </span>
              </Tip>
            </DiffNavigationGroup>
            <DiffOptions />
          </div>
        )}
      </Toolbar>
    </div>
  )
}
