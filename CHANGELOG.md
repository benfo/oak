# Changelog

Notable changes to Oak, newest first. Each release also has notes on its [GitHub release page](https://github.com/benfo/oak/releases).

## 0.1.22

### Added

- SVG preview. An SVG in Changes or History opens as a picture, with a Diff | Preview switch at the start of the title to see the text diff instead. Before and after sit side by side on a checkerboard at the file's own proportions, and an added or deleted file shows one side. Press Ctrl+Shift+V, or search the command palette for Toggle preview, to switch. SVGs are drawn as images, so scripts inside them never run.
- Open in editor. Open a file at the cursor's line, or the repository, in VS Code, Cursor, Sublime Text, Notepad++ or a custom command, chosen in Preferences under External tools. Files an editor cannot edit, such as images, documents and archives, offer Open with default app instead.
- Open in browser, Open pull request and Copy link. Reach the repository, a branch, a commit, a file or a line on GitHub, GitLab, Bitbucket and Azure DevOps. Oak never offers a page that would not exist, such as a commit that has not been pushed.
- Commit options. A menu beside Amend with Skip hooks, Sign off, Sign commit (follow Git config, always or never) and Allow empty commit. The options apply to one commit, a label beside the button names any that are on, and Commit & Push also skips the push hook when hooks were skipped.
- WIP commits. The command palette has WIP commit (skip hooks), WIP commit and push (backup) and Undo WIP commit (keep changes): a save point that stages everything and commits it as WIP without hooks or signing.

### Changed

- Small windows. The diff toolbar wraps instead of switching layout at a fixed width, History drops its Commit, then Date, then Author columns as the list narrows, the file list and diff keep a minimum size, and the largest zoom steps are held back in a window too small for them.
- Side-by-side diffs scroll together sideways as well as vertically, and each side stops at its own end.
- Right-click menus use one order everywhere: actions, explore (compare, history, blame), go elsewhere (open in editor, browser), Copy, then destructive actions last.
- The staged, unstaged or untracked label is gone from the Changes diff title. The list section and the diff's buttons already say which one it is.

### Fixed

- History no longer shows two stacked horizontal scrollbars in a narrow window, and its column header now follows the list when it scrolls sideways.

## 0.1.21

### Added

- File type icons. Show an icon for each file and folder in Changes and in a commit's files. Choose Simple (quiet monochrome glyphs) or Colour in Preferences under Appearance, or search the command palette for File icons. They are off until you choose one, and rows keep their size either way. The Colour icons come from Material Icon Theme (MIT), credited in THIRD-PARTY-NOTICES.md.
- Focus mode keeps the file list. Press F11 to expand the code area and the file list stays beside the diff, in Changes and in History. Press F to hide or show that list, and F11 again to restore your layout.
- Sidebar icon rail. Ctrl+[ collapses the sidebar to a strip of view icons: Changes with its count, History and Blame. Ctrl+1 to Ctrl+3 switch between them, and Ctrl+[ again brings the sidebar back.

### Fixed

- Escape leaves focus mode while the History All files tree has focus.

## 0.1.20

### Added

- Ignore whitespace changes. Hide edits that only change spaces, tabs or line endings from the diff options menu, in Changes and in History. Added and removed blank lines stay visible, and a file with only whitespace changes stays in the list with a way to show them. The filter is off again when Oak restarts.
- Branch and tag menus in History. Right-click a branch or tag label on a commit to open the menu for that ref, or press Shift+Menu on the selected commit. A commit with several refs offers a short list first. The commit menu no longer opens other menus.

### Fixed

- Long commit messages scroll on their own, with the subject and author kept in view.
- Tooltips look and behave the same everywhere.

## 0.1.19

### Added

- Find in diffs and file previews. Press Ctrl+F in History or Changes to search inline and side-by-side diffs and commit file previews, step through matches, and jump to a line with `:N`. Escape closes find.
- The shortcut reference (Ctrl+/) searches by the keys you press and says which view or control owns each shortcut.

### Fixed

- Escape exits a file's history, as it does for a comparison, from the commit list or the banner.
- The command palette layout is tidier.

## 0.1.18

### Added

- Blame. See who last changed each line, step back to the version before a line's commit, find text in the file, and open the commit in History at the file and line it changed. Open it from a file's menu or the palette (Blame file...); Ctrl+3 returns to it.
- Optional markers for spaces and tabs in diffs and Blame, from Preferences, the diff toolbar or the palette.

## 0.1.17

### Added

- Hide noisy branches. Hide branches by pattern (for example `dependabot/*`) or hide remote-only branches, per repository, in the sidebar and the History graph. Set them in the new Repository tab in Preferences, which previews the matches. The checked-out branch is never hidden and History shows how many are hidden.

### Fixed

- The History commit menu keeps everyday actions flat and groups the rest under Compare, Merge / Rebase, Undo and More. Branch and tag menus use the same order.
- Merging a branch that the current branch already contains says there is nothing to merge.
- V switches the changed-files list or tree view from the diff as well as from the file lists.
- Opening Oak with flags before the folder now opens the right folder.

## 0.1.16

### Added

- Transit-map look. The Light and Dark themes are restyled as a transit map, and the commit graph draws stations as rings with filled dots for merges.

### Fixed

- The diff toolbar hides the file counter when only one file is shown.
- Long lists in the graph, History files and diff are virtualized for smoother scrolling.

## 0.1.15

### Added

- List or tree for changed files. Press V in a file list, or use the button in its header, to group changed files by folder in Changes and in a commit's files in History. Selecting a folder in Changes selects every file in it.

### Fixed

- The commit message box clears a pre-filled merge message when the merge ends without using Oak's Commit button.
- History no longer flashes a flat file list before the tree appears when stepping between commits.
