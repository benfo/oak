import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, SearchField } from 'react-aria-components'
import { displayKeys, type Command } from '../commands'
import { Modal } from '../ui'
import { Icon } from './Icon'
import { useSettings } from '../settings'
import { WIDGET_KEYMAP } from '../lib/keymap'
import { handleDismissNavigation } from '../lib/navigation'
import { shortcutNavigationHelp } from './shortcutNavigationHelp'
import { matchesShortcutHelp, prepareShortcutHelp } from '../../../shared/shortcutHelp'

export function ShortcutsDialog({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const { vimNavigation } = useSettings()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const results = useRef<HTMLDivElement>(null)
  const shortcuts = useMemo(
    () =>
      [
        ...commands
          // Widget help presents list and code find as one action.
          .filter((c) => c.keys && c.id !== 'find-in-pane')
          .map((c) => ({
            id: c.id,
            title: c.shortcutDisabledReason ? `${c.help ?? c.title}: ${c.shortcutDisabledReason}` : (c.help ?? c.title),
            keys: c.keys!.replace(/\bEscape\b/g, 'Esc'),
            category: c.category,
            bindings: [c.keys!]
          })),
        ...shortcutNavigationHelp.map(([title, keys, category, bindings], i) => ({
          id: `navigation-${i}`,
          title,
          keys,
          category,
          bindings
        })),
        ...WIDGET_KEYMAP.flatMap((w) => (w.help ? [{ id: `widget-${w.action}-${w.roles[0]}`, ...w.help, bindings: w.keys }] : [])),
        ...(vimNavigation
          ? [
              {
                id: 'vim-move',
                title: 'Lists and code: move down / up (Vim)',
                keys: 'j / k',
                category: 'Navigation',
                bindings: ['j', 'k']
              },
              {
                id: 'vim-half-page',
                title: 'Move half a page down / up in the focused list or diff (Vim)',
                keys: 'Ctrl+D / Ctrl+U',
                category: 'Navigation',
                bindings: ['Ctrl+D', 'Ctrl+U']
              },
              {
                id: 'vim-ends',
                title: 'Lists and code: first / last item or line (Vim)',
                keys: 'gg / Shift+G',
                category: 'Navigation',
                bindings: ['gg', 'Shift+g']
              },
              {
                id: 'vim-panes',
                title: 'Lists and code: move left / right (Vim)',
                keys: 'h / l',
                category: 'Navigation',
                bindings: ['h', 'l']
              },
              { id: 'vim-menu-move', title: 'Menus: move down / up (Vim)', keys: 'j / k', category: 'Navigation', bindings: ['j', 'k'] },
              {
                id: 'vim-submenus',
                title: 'Menus: close / open submenu (Vim)',
                keys: 'h / l',
                category: 'Navigation',
                bindings: ['h', 'l']
              },
              {
                id: 'vim-scroll',
                title: 'Code: scroll left / right (Vim)',
                keys: 'Shift+H / Shift+L',
                category: 'Diff',
                bindings: ['Shift+h', 'Shift+l']
              }
            ]
          : [])
      ].map(prepareShortcutHelp),
    [commands, vimNavigation]
  )
  const categories = [...new Set(shortcuts.map((s) => s.category))].sort()
  const matching = shortcuts.filter((s) => (!category || s.category === category) && matchesShortcutHelp(s, query))
  const groups = new Map<string, typeof matching>()
  for (const s of matching) groups.set(s.category, [...(groups.get(s.category) ?? []), s])
  useEffect(() => {
    if (results.current) results.current.scrollTop = 0
  }, [query, category])

  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} width={640}>
      <div className="shortcuts-browser">
        <div className="shortcuts-filters">
          <SearchField className="shortcuts-search search" type="text" aria-label="Search shortcuts" value={query} onChange={setQuery}>
            <Icon name="search" size={14} />
            <Input
              autoFocus
              placeholder="Search actions or keys…"
              spellCheck={false}
              onKeyDownCapture={(e) => handleDismissNavigation(e, [query ? () => setQuery('') : undefined], { allowTextInput: true })}
            />
            <Button className="link shortcut-clear" aria-label="Clear shortcut search">
              Clear
            </Button>
          </SearchField>
          <select
            className="select shortcuts-category"
            aria-label="Shortcut category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="shortcuts-count muted small" role="status" aria-live="polite">
          {matching.length} of {shortcuts.length} shortcuts
        </div>
        <div className="pane-frame">
          <div
            ref={results}
            className="shortcuts-results"
            role="region"
            tabIndex={0}
            data-pane="shortcuts"
            aria-label="Keyboard shortcut results"
          >
            {matching.length ? (
              [...groups].map(([cat, rows]) => (
                <section key={cat} className="shortcut-group" aria-label={cat}>
                  <h3>{cat}</h3>
                  <dl>
                    {rows.map((s) => (
                      <div key={s.id} className="shortcut-row">
                        <dt>
                          {s.title}
                          {s.description && <div className="muted small">{s.description}</div>}
                        </dt>
                        <dd>
                          <kbd>{displayKeys(s.keys)}</kbd>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))
            ) : (
              <div className="pane-empty">No shortcuts match. Try another search or category.</div>
            )}
          </div>
        </div>
        <div className="shortcuts-footer">
          <span className="muted small">In search, Esc clears the query first. Otherwise, Esc closes.</span>
          <Button className="btn" onPress={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
