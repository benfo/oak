# Changelog

Notable changes to Oak, newest first. Each release also has notes on its [GitHub release page](https://github.com/benfo/oak/releases).

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
