export interface Shot {
  image: string
  title: string
  caption?: string
  width?: number
  height?: number
}

export interface KeyHint {
  label: string
  keys: string[]
}

export interface Stop {
  id: string
  name: string
  text: string[]
  keys?: KeyHint[]
  shots?: Shot[]
  /** Shown as a mini route. Beside the text when there is a screenshot, in its place when there is not. */
  points?: string[]
}

export interface Line {
  id: string
  number: string
  name: string
  blurb: string
  color: 'blue' | 'red' | 'green' | 'orange'
  stops: Stop[]
}

const strip = { width: 2160, height: 761 }

export const lines: Line[] = [
  {
    id: 'review',
    number: '1',
    name: 'Review',
    blurb: 'Read what changed',
    color: 'blue',
    stops: [
      {
        id: 'compare',
        name: 'Compare without checkout',
        text: [
          'Review what a branch introduced since it branched from its target. Select an earlier commit to review the branch at that point.',
          'Your working tree stays in place while you compare.',
        ],
        points: ['Select a target: main, a release branch or another feature branch', 'Open a changed file to read its diff beside the history', 'Step back to an earlier commit to see the branch up to that revision'],
        shots: [{ image: 'oak-comparison', title: "Oak's branch comparison with the changed files list and a diff", caption: 'A feature branch compared with main, in a synthetic project.' }],
      },
      {
        id: 'history-scope',
        name: 'History scope',
        text: ["Show only the current branch's own commits, without the default branch's history. Switch to the full ancestry, or add a target branch, from the History scope menu."],
        points: ["Only this branch's own commits", 'The full ancestry', 'A target branch added to the view'],
      },
      {
        id: 'file-history',
        name: 'File history',
        text: ['Choose "Show file history" from a file\'s menu, or from the command palette, to filter the History graph to the commits that touched that file. Stepping through them shows only that file\'s diff.'],
        points: ["Open a file's menu, or the command palette", 'Choose Show file history', "Step through the commits that touched it, each showing only that file's diff", 'Press Escape to return to all commits'],
      },
      {
        id: 'blame',
        name: 'Blame',
        text: ["See who last changed each line. The gutter names each block's commit by subject and age, and a footer shows the commit for the line under the cursor."],
        keys: [
          { label: 'Open Blame', keys: ['Ctrl', '3'] },
          { label: 'Step back to the version before a line\'s commit', keys: ['B'] },
          { label: 'Find in the file', keys: ['/'] },
        ],
        points: ["Open Blame from a file's menu or the command palette", "Press B to see the file as it was before a line's commit, and Backspace to return", 'Press Enter to open that commit in History at the file and line it changed'],
        shots: [{ image: 'oak-blame', title: "Oak's Blame view with each block's commit beside the code and the cursor line's commit in the footer", caption: 'A file in a synthetic project, blamed in the working tree.' }],
      },
    ],
  },
  {
    id: 'stage',
    number: '2',
    name: 'Stage',
    blurb: 'Choose what goes in',
    color: 'red',
    stops: [
      {
        id: 'stage-lines',
        name: 'Stage lines',
        text: [
          'Select the changes to include in a commit. A click selects exactly the line shown, and the remaining changes stay unstaged.',
          'Review staged and unstaged changes beside your commit message. If you commit with nothing staged, Oak asks whether to stage the changed files first; new files are included only if you tick the box.',
        ],
        keys: [
          { label: 'Toggle a line', keys: ['Space'] },
          { label: 'Extend the selection', keys: ['Shift', '↓'] },
          { label: 'Stage or unstage', keys: ['Enter'] },
        ],
        shots: [{ image: 'oak-staging', title: "Oak's Changes view with two diff lines selected and a Stage lines button", caption: 'Two lines selected, ready to stage. The rest of the hunk stays unstaged.' }],
      },
      {
        id: 'diff-layout',
        name: 'Inline or side by side',
        text: [
          'View additions and deletions in one column, or compare before and after in two columns. Both layouts include syntax colours and word-level change highlighting.',
          'Switching keeps your place. Show more or less surrounding code with the context buttons in the diff header, or the whole file with the shortcut below.',
        ],
        keys: [
          { label: 'Switch layout', keys: ['Ctrl', 'Shift', 'D'] },
          { label: 'Whole file', keys: ['Ctrl', 'Shift', 'W'] },
        ],
        shots: [
          { image: 'oak-diff-split', title: 'A diff in the side by side layout', caption: 'Side by side', ...strip },
          { image: 'oak-diff-inline', title: 'A diff in the inline layout', caption: 'Inline', ...strip },
        ],
      },
      {
        id: 'tree',
        name: 'Changed files as a tree',
        text: ["Group changed files by folder to see where a change lands. It applies to Changes and to a commit's files in History, and your selection stays in place when you switch."],
        keys: [{ label: 'List or tree', keys: ['V'] }],
        shots: [{ image: 'oak-tree', title: "Oak's Changes view with files grouped by folder and a folder selected", caption: 'Unstaged and staged files grouped by folder, with src/components selected.' }],
      },
    ],
  },
  {
    id: 'move',
    number: '3',
    name: 'Move',
    blurb: 'Get around by keyboard',
    color: 'green',
    stops: [
      {
        id: 'palette',
        name: 'Command palette',
        text: [
          'Type part of a command name, use the arrow keys to select a result and press Enter to run it.',
          "The palette includes branch operations, comparisons, stash actions, diff controls, history scope, opening a branch's pull request page and preferences. Commands show their keyboard shortcuts where available.",
        ],
        keys: [{ label: 'Open the palette', keys: ['Ctrl', 'Shift', 'P'] }],
        shots: [{ image: 'oak-commands', title: "Oak's command palette showing matching commands and keyboard shortcuts", caption: 'Search for an action without locating it in a menu.' }],
      },
      {
        id: 'keyboard',
        name: 'Navigate by keyboard',
        text: ['Move between history, files and diffs using the keyboard. Tab steps through the controls inside a pane, such as the buttons in a file list. F6 switches panes.'],
        keys: [
          { label: 'Find in a list, diff or file', keys: ['Ctrl', 'F'] },
          { label: 'All shortcuts', keys: ['Ctrl', '/'] },
          { label: 'Switch panes', keys: ['F6'] },
        ],
        points: ['Arrow keys move in lists, diffs and menus', 'Slash or Ctrl F searches the focused list, a diff or a file preview; type :120 to go to a line', 'Optional h, j, k and l keys work alongside the arrows'],
      },
      {
        id: 'focus',
        name: 'Give the diff the window',
        text: ['Expand the code area. The sidebar and, in History, the commit graph step aside and the file list stays beside the diff. Press F to hide or show that list. Press F11 again, or Escape when nothing else is selected, to restore your layout, focus and pane sizes.', 'While reading a diff, Alt PageUp and Alt PageDown move between files. The toolbar\'s expand button does the same as F11. Outside focus mode, Ctrl [ collapses the sidebar to a strip of view icons.'],
        keys: [
          { label: 'Expand or restore', keys: ['F11'] },
          { label: 'Hide or show the file list', keys: ['F'] },
          { label: 'Collapse the sidebar to icons', keys: ['Ctrl', '['] },
          { label: 'Previous or next file', keys: ['Alt', 'PageUp / PageDown'] },
        ],
        shots: [{ image: 'oak-focus', title: 'Oak with the code area expanded to fill the window', caption: 'After pressing F11, the diff fills the window.' }],
      },
      {
        id: 'resize',
        name: 'Resize with the keyboard',
        text: ['Move the divider of the pane you are in. Dragging a divider still works.'],
        keys: [{ label: 'Move the nearest divider', keys: ['Shift', 'Alt', '←→↑↓'] }],
        points: ['Focus a pane', 'Press Shift Alt and an arrow key', 'The nearest divider moves'],
      },
    ],
  },
  {
    id: 'git',
    number: '4',
    name: 'Git',
    blurb: 'Your own setup',
    color: 'orange',
    stops: [
      {
        id: 'conflicts',
        name: 'Conflicts in your merge tool',
        text: ['When a merge stops with conflicts, Oak switches to Changes and shows a banner. Open the conflicted files one after another in the merge tool set in Preferences.'],
        points: ['A merge stops with conflicts, and a banner appears in Changes', 'Open each conflicted file in your merge tool', 'Marking a file resolved warns you if conflict markers remain'],
      },
      {
        id: 'installed-git',
        name: 'Uses your installed Git',
        text: ['Oak runs the Git CLI. It uses your existing credentials, configuration, hooks and Git LFS setup.', 'The working tree refreshes automatically when local files change and when you return to the window. Fetch checks for changes on the remote.'],
        points: ['Your credentials', 'Your configuration', 'Your hooks', 'Your Git LFS setup'],
      },
    ],
  },
]

export const planned: { name: string; text: string }[] = [
  { name: 'Smoother conflicts', text: 'Say which side is ours and theirs, handle modify and delete conflicts, and bring Pull and Rebase conflicts into the same flow.' },
  { name: 'Interactive rebase', text: 'Reorder, squash, edit and drop commits from the history graph.' },
  { name: 'Pull request review', text: "Fetch a pull request's branches and open the comparison in Oak. Comments and approvals would stay on the provider's website at first." },
  { name: 'Open and preview more files', text: 'Preview images, PDFs and other safe files, and open anything else in its default app or show it in its folder.' },
  { name: 'Git command log', text: 'A list of every command Oak ran, with its output.' },
  { name: 'Signed installer', text: 'Code-sign the Windows installer so it no longer needs unblocking.' },
]
