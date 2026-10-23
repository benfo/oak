import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, SearchField } from 'react-aria-components'
import { displayKeys, type Command } from '../commands'
import { Modal } from '../ui'
import { Icon } from './Icon'
import { useSettings } from '../settings'
import { WIDGET_KEYMAP } from '../lib/keymap'

const navigation = [
  ['Next / previous control or pane', 'Tab / Shift+Tab', 'Navigation'],
  ['Move selection', '↑ ↓ Home End PageUp PageDown', 'Navigation'],
  ['Open commit files / diff', '→ or Enter', 'History'],
  ['Back out of a pane', '← or Esc', 'Navigation'],
  ['Expand / collapse (sidebar and all files tree)', '→ / ←', 'Navigation'],
  ['Next / previous match in search', 'Enter / Shift+Enter', 'Navigation'],
  ['Leave search for its list', 'Esc or Tab', 'Navigation'],
  ['Accept highlighted picker item', 'Enter', 'Navigation'],
  ['Context menu', 'Shift+F10', 'Navigation'],
  ['Resize the focused pane (the divider moves that way)', 'Shift+Alt+← ↑ ↓ →', 'Navigation'],
  ['Resize a clicked divider', 'Arrow keys · Home / End', 'Navigation'],
  ['Return from divider to previous control', 'Esc', 'Navigation'],
  ['Select files', 'Shift+↑↓, Ctrl+A, Space', 'Files'],
  ['Open focused file in diff', '→', 'Files'],
  ['Return from files to sidebar', '← or Esc', 'Files'],
  ['Stage / unstage files', 'Enter or double-click', 'Files'],
  ['Discard files', 'Delete', 'Files'],
  ['Compare two commits / replace After', 'Ctrl+click', 'History'],
  ['End commit comparison (in graph)', 'Esc', 'History'],
  ['Scroll code left / right', 'Shift+← / Shift+→', 'Diff'],
  ['Select lines in a diff', 'Shift+↑↓, Space, Ctrl+A', 'Diff'],
  ['Stage / unstage lines or hunk', 'Enter', 'Diff'],
  ['Discard lines or hunk', 'Delete', 'Diff'],
  ['Commit', 'Ctrl+Enter', 'Commit'],
  ['Commit & push', 'Ctrl+Shift+Enter', 'Commit']
] as const

// Search written-out key names as well as the glyphs used in the cheat sheet.
const normalize = (value: string) => value.toLowerCase()
  .replace(/^\s*\/\s*$/, 'slash').replace(/^\s*,\s*$/, 'comma')
  .replace(/↑/g, ' arrowup up ').replace(/↓/g, ' arrowdown down ')
  .replace(/←/g, ' arrowleft left ').replace(/→/g, ' arrowright right ')
  .replace(/⌘/g, ' ctrl cmd command ').replace(/⇧/g, ' shift ').replace(/⌥/g, ' alt option ')
  .replace(/control/g, 'ctrl').replace(/escape/g, 'esc').replace(/return/g, 'enter')
  .replace(/\b(cmd|command)\b/g, 'ctrl').replace(/\bpgup\b/g, 'pageup').replace(/\bpgdn\b/g, 'pagedown')
  .replace(/ctrl\+\//g, 'ctrl slash').replace(/ctrl\+,/g, 'ctrl comma').replace(/ctrl\+`/g, 'ctrl backtick')
  .replace(/[+/,]/g, ' ').replace(/\s+/g, ' ').trim()

export function ShortcutsDialog({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const { vimNavigation } = useSettings()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const results = useRef<HTMLDivElement>(null)
  const shortcuts = useMemo(() => [
    ...commands.filter((c) => c.keys).map((c) => ({ id: c.id, title: c.shortcutDisabledReason ? `${c.help ?? c.title} — ${c.shortcutDisabledReason}` : c.help ?? c.title, keys: c.keys!, category: c.category })),
    ...navigation.map(([title, keys, category], i) => ({ id: `navigation-${i}`, title, keys, category })),
    ...WIDGET_KEYMAP.flatMap((w) => w.help ? [{ id: `widget-${w.action}-${w.roles[0]}`, ...w.help }] : []),
    ...(vimNavigation ? [
      { id: 'vim-move', title: 'Move down / up (Vim)', keys: 'j / k', category: 'Navigation' },
      { id: 'vim-half-page', title: 'Move half a page down / up in the focused list or diff (Vim)', keys: 'Ctrl+D / Ctrl+U', category: 'Navigation' },
      { id: 'vim-ends', title: 'First / last item or line in the focused pane (Vim)', keys: 'gg / G', category: 'Navigation' },
      { id: 'vim-panes', title: 'Back / deeper or collapse / expand (Vim)', keys: 'h / l', category: 'Navigation' },
      { id: 'vim-menu-move', title: 'Move down / up in menus (Vim)', keys: 'j / k', category: 'Navigation' },
      { id: 'vim-submenus', title: 'Close / open submenu (Vim)', keys: 'h / l', category: 'Navigation' },
      { id: 'vim-scroll', title: 'Scroll code left / right (Vim)', keys: 'Shift+H / Shift+L', category: 'Diff' }
    ] : [])
  ].map((s) => ({
    ...s,
    search: normalize(`${s.title} ${s.category} ${s.keys} ${displayKeys(s.keys)}`),
    keyWords: new Set(normalize(`${s.keys} ${displayKeys(s.keys)}`).split(' '))
  })), [commands, vimNavigation])
  const categories = [...new Set(shortcuts.map((s) => s.category))].sort()
  const words = normalize(query).split(' ').filter(Boolean)
  const keyQuery = /^(ctrl|control|cmd|command|alt|shift|⌘|⇧|⌥)(?:\+|\s)/i.test(query.trim())
  const matching = shortcuts.filter((s) => (!category || s.category === category)
    && words.every((word) => keyQuery ? s.keyWords.has(word) : s.search.includes(word)))
  const groups = new Map<string, typeof matching>()
  for (const s of matching) groups.set(s.category, [...(groups.get(s.category) ?? []), s])
  useEffect(() => { if (results.current) results.current.scrollTop = 0 }, [query, category])

  return <Modal title="Keyboard shortcuts" onClose={onClose} width={640}>
    <div className="shortcuts-browser">
      <div className="shortcuts-filters">
        <SearchField className="shortcuts-search search" type="text" aria-label="Search shortcuts" value={query} onChange={setQuery}>
          <Icon name="search" size={14} />
          <Input autoFocus placeholder="Search actions or keys…" spellCheck={false} onKeyDownCapture={(e) => {
            if (e.key === 'Escape' && query) { e.preventDefault(); e.stopPropagation(); setQuery('') }
          }} />
          <Button className="link shortcut-clear" aria-label="Clear shortcut search">Clear</Button>
        </SearchField>
        <select className="select shortcuts-category" aria-label="Shortcut category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>
      <div className="shortcuts-count muted small" role="status" aria-live="polite">
        {matching.length} of {shortcuts.length} shortcuts
      </div>
      <div className="pane-frame">
        <div ref={results} className="shortcuts-results" tabIndex={0} data-pane="shortcuts" aria-label="Keyboard shortcut results">
          {matching.length ? [...groups].map(([cat, rows]) => <section key={cat} className="shortcut-group" aria-label={cat}>
            <h3>{cat}</h3>
            <dl>
              {rows.map((s) => <div key={s.id} className="shortcut-row"><dt>{s.title}</dt><dd><kbd>{displayKeys(s.keys)}</kbd></dd></div>)}
            </dl>
          </section>) : <div className="pane-empty">No shortcuts match. Try another search or category.</div>}
        </div>
      </div>
      <div className="shortcuts-footer">
        <span className="muted small">Esc clears search, then closes · Run actions with Ctrl+Shift+P</span>
        <Button className="btn" onPress={onClose}>Close</Button>
      </div>
    </div>
  </Modal>
}
