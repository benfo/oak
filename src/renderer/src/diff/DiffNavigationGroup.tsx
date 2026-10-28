import type { ReactNode } from 'react'
import { Button } from 'react-aria-components'
import { Icon, type IconName } from '../components/Icon'
import { Tip } from '../components/Tip'

interface NavigationAction {
  label: string
  keys: string
  icon: IconName
  disabled: boolean
  run: () => void
}

/** Compose a counter between two consistently labelled navigation controls. */
export function DiffNavigationGroup({
  previous,
  next,
  children
}: {
  previous: NavigationAction
  next: NavigationAction
  children: ReactNode
}) {
  return (
    <span className="diff-navigation-group">
      <NavigationButton action={previous} />
      {children}
      <NavigationButton action={next} />
    </span>
  )
}

function NavigationButton({ action }: { action: NavigationAction }) {
  return (
    <Tip label={action.label} keys={action.keys}>
      <Button className="icon-btn" aria-label={action.label} isDisabled={action.disabled} onPress={action.run}>
        <Icon name={action.icon} size={14} />
      </Button>
    </Tip>
  )
}
