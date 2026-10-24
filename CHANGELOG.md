# Changelog

Notable changes to Oak, newest first. Each release also has notes on its [GitHub release page](https://github.com/benfo/oak/releases).

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
