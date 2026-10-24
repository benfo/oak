import { useRef, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { Menu, MenuItem, Popover, Separator, SubmenuTrigger } from 'react-aria-components'
import type { MenuItem as Item } from '../../../shared/types'
import { createStore } from '../ui'
import { Icon } from './Icon'
import { useContextMenuRetargeting } from '../lib/useContextMenuRetargeting'
import { MenuNavigation } from './MenuNavigation'

/*
 * Context and dropdown menus, as React Aria menus (themed like the rest of Oak, keyboard-first).
 * Opened through `showMenu` in api.ts, which decides where: at the mouse pointer for a right-click,
 * under the focused row for the keyboard, under the button for a dropdown.
 */

interface MenuReq {
  items: Item[]
  /** An element to open under, or a point (page coordinates) to open at. */
  at: Element | { x: number; y: number }
  /** Opened from the keyboard: focus the first item (from the mouse, the menu itself). */
  viaKeyboard: boolean
  resolve: (id: string | null) => void
}

const store = createStore<MenuReq | null>(null)

export function openContextMenu(items: Item[], at: MenuReq['at'], viaKeyboard: boolean) {
  return new Promise<string | null>((resolve) => {
    store.get()?.resolve(null)
    store.set({ items, at, viaKeyboard, resolve })
  })
}

export function ContextMenuHost() {
  const req = useSyncExternalStore(store.subscribe, store.get)
  return req ? <ContextMenu key={Math.random()} req={req} /> : null
}

function ContextMenu({ req }: { req: MenuReq }) {
  const point = useRef<HTMLDivElement>(null)
  const opener = useRef(document.activeElement as HTMLElement | null)
  const done = useRef(false)
  const anchored = req.at instanceof Element
  const triggerRef = anchored ? { current: req.at as Element } : point

  const finish = (id: string | null) => {
    if (done.current) return
    done.current = true
    // Close now and put focus back ourselves, so a dialog the chosen action opens returns focus to
    // where the menu was opened from, not to this (soon gone) menu.
    flushSync(() => store.set(null))
    opener.current?.focus()
    req.resolve(id)
  }

  useContextMenuRetargeting(() => finish(null))

  return (
    <>
      {!anchored && (
        <div ref={point} className="menu-point" style={{ left: (req.at as { x: number }).x, top: (req.at as { y: number }).y }} />
      )}
      <Popover
        className="menu-popover"
        triggerRef={triggerRef}
        placement="bottom start"
        offset={anchored ? 4 : 0}
        isOpen
        onOpenChange={(open) => !open && finish(null)}
      >
        <Items items={req.items} onAction={finish} autoFocus={req.viaKeyboard ? 'first' : true} />
      </Popover>
    </>
  )
}

function Items({ items, onAction, autoFocus }: { items: Item[]; onAction: (id: string) => void; autoFocus?: 'first' | true }) {
  return (
    <MenuNavigation>
      <Menu className="menu" aria-label="Menu" autoFocus={autoFocus} onAction={(key) => onAction(String(key))}>
        {items.map((it, i) =>
          it.type === 'separator' ? (
            <Separator key={`sep-${i}`} className="menu-separator" />
          ) : it.submenu ? (
            <SubmenuTrigger key={`sub-${i}`}>
              <MenuItem id={`submenu-${i}`} textValue={it.label} className="menu-item row" isDisabled={it.enabled === false}>
                <span className="menu-check" />
                <span className="menu-label">{it.label}</span>
                <Icon name="chevronRight" size={14} className="menu-more" />
              </MenuItem>
              <Popover className="menu-popover" offset={-2} crossOffset={-5}>
                <Items items={it.submenu} onAction={onAction} />
              </Popover>
            </SubmenuTrigger>
          ) : (
            <MenuItem key={it.id ?? i} id={it.id} textValue={it.label} className="menu-item row" isDisabled={it.enabled === false}>
              <span className="menu-check">{it.checked && <Icon name="check" size={14} />}</span>
              <span className="menu-label">{it.label}</span>
            </MenuItem>
          )
        )}
      </Menu>
    </MenuNavigation>
  )
}
