/** Descriptions and display labels stay separate from the exact searchable bindings. */
export const shortcutNavigationHelp = [
  ['Next / previous control', 'Tab / Shift+Tab', 'Navigation', ['Tab', 'Shift+Tab']],
  [
    'Lists: move selection',
    '↑ / ↓ / Home / End / PageUp / PageDown',
    'Navigation',
    ['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']
  ],
  ['History: open commit files or the selected file diff', '→ / Enter', 'History', ['ArrowRight', 'Enter']],
  ['History changed files: return to the commit list from the top level', '←', 'History', ['ArrowLeft']],
  ['Dismiss a tooltip, menu, find bar or line selection; then restore expanded code', 'Esc', 'Navigation', ['Escape']],
  ['Sidebar and All files tree: expand / collapse folders', '→ / ←', 'Navigation', ['ArrowRight', 'ArrowLeft']],
  ['Search field: next / previous match', 'Enter / Shift+Enter', 'Navigation', ['Enter', 'Shift+Enter']],
  ['List search field: return to the list, keeping the query', 'Esc / Tab', 'Navigation', ['Escape', 'Tab']],
  ['Picker: accept the highlighted item', 'Enter', 'Navigation', ['Enter']],
  ['Focused list or code: open context menu', 'Shift+F10 / Menu', 'Navigation', ['Shift+F10', 'ContextMenu']],
  [
    'Move the nearest divider in the arrow direction',
    'Shift+Alt+← / ↑ / ↓ / →',
    'Navigation',
    ['Shift+Alt+ArrowLeft', 'Shift+Alt+ArrowUp', 'Shift+Alt+ArrowDown', 'Shift+Alt+ArrowRight']
  ],
  ['Focused divider: resize', 'Arrow keys / Home / End', 'Navigation', ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']],
  ['Focused divider: return to the previous control', 'Esc', 'Navigation', ['Escape']],
  ['Changes: select files', 'Shift+↑ / Shift+↓ / Ctrl+A / Space', 'Files', ['Shift+ArrowUp', 'Shift+ArrowDown', 'Ctrl+A', 'Space']],
  ['Changes file list: open the focused file diff', '→', 'Files', ['ArrowRight']],
  ['Changes file list: return to the sidebar', '←', 'Files', ['ArrowLeft']],
  ['Changes file list: stage / unstage selected files (also by double-click)', 'Enter', 'Files', ['Enter']],
  ['Changes file list: discard selected files', 'Delete', 'Files', ['Delete']],
  ['History commit list: compare commits or replace the After commit', 'Ctrl+click', 'History', ['Ctrl+click']],
  ['Comparison commit list (graph) or controls: exit comparison after dismissing overlays', 'Esc', 'History', ['Escape']],
  ['Code: scroll left / right', 'Shift+← / Shift+→', 'Diff', ['Shift+ArrowLeft', 'Shift+ArrowRight']],
  [
    'Editable diff: select changed lines',
    'Shift+↑ / Shift+↓ / Space / Ctrl+A',
    'Diff',
    ['Shift+ArrowUp', 'Shift+ArrowDown', 'Space', 'Shift+Space', 'Ctrl+Space', 'Ctrl+A']
  ],
  ['Editable diff: stage / unstage selected lines, or the current hunk', 'Enter', 'Diff', ['Enter']],
  ['Editable diff: discard selected lines, or the current hunk', 'Delete', 'Diff', ['Delete']],
  ['Diff at its left edge: return to the visible file list', '←', 'Diff', ['ArrowLeft']],
  ['Commit-message field: commit', 'Ctrl+Enter', 'Commit', ['Ctrl+Enter']],
  ['Commit-message field: commit and push', 'Ctrl+Shift+Enter', 'Commit', ['Ctrl+Shift+Enter']],
  ['Commit-message field: return to changed files, keeping the draft', 'Esc', 'Commit', ['Escape']]
] as const
